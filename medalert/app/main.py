from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select
from .config import settings
from .database import Base, engine, get_db
from .models import User, EmergencyContact, EmergencyAlert
from .schemas import RegisterIn, LoginIn, ContactIn, ContactOut, AlertIn
from .security import hash_password, verify_password, create_access_token, current_user
from .notifications import notify_emergency_contacts

if settings.environment == "production" and (
    len(settings.secret_key) < 32 or settings.secret_key == "unsafe-development-key-change-me"
):
    raise RuntimeError("Set a strong SECRET_KEY before production deployment.")

Base.metadata.create_all(bind=engine)
app = FastAPI(title=settings.app_name, docs_url="/api/docs" if settings.environment != "production" else None,
              redoc_url=None)
origins = [value.strip() for value in settings.cors_origins.split(",") if value.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), accelerometer=(self), gyroscope=(self)"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}

@app.post("/api/auth/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(full_name=data.full_name.strip(), email=email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id), "token_type": "bearer",
            "user": {"id": user.id, "full_name": user.full_name, "email": user.email}}

@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return {"access_token": create_access_token(user.id), "token_type": "bearer",
            "user": {"id": user.id, "full_name": user.full_name, "email": user.email}}

@app.get("/api/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "full_name": user.full_name, "email": user.email}

@app.get("/api/contacts", response_model=list[ContactOut])
def list_contacts(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(EmergencyContact).where(EmergencyContact.user_id == user.id)
                           .order_by(EmergencyContact.id.desc())))

@app.post("/api/contacts", response_model=ContactOut, status_code=201)
def add_contact(data: ContactIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    contacts = list(db.scalars(select(EmergencyContact).where(EmergencyContact.user_id == user.id)))
    if len(contacts) >= 10:
        raise HTTPException(status_code=400, detail="You can save up to 10 emergency contacts.")
    contact = EmergencyContact(user_id=user.id, name=data.name.strip(), phone=data.phone.strip(),
                               relationship_label=data.relationship_label.strip())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

@app.delete("/api/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    contact = db.scalar(select(EmergencyContact).where(
        EmergencyContact.id == contact_id, EmergencyContact.user_id == user.id))
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")
    db.delete(contact)
    db.commit()

def serialize_alert(alert: EmergencyAlert):
    created = alert.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return {"id": alert.id, "status": alert.status, "latitude": alert.latitude,
            "longitude": alert.longitude, "location_accuracy": alert.location_accuracy,
            "message": alert.message, "created_at": created.isoformat()}

@app.get("/api/alerts")
def list_alerts(user: User = Depends(current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(EmergencyAlert).where(EmergencyAlert.user_id == user.id)
                         .order_by(EmergencyAlert.id.desc()).limit(50))
    return [serialize_alert(record) for record in records]

@app.post("/api/alerts", status_code=201)
def create_alert(data: AlertIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    recent = list(db.scalars(select(EmergencyAlert).where(EmergencyAlert.user_id == user.id)
                             .order_by(EmergencyAlert.id.desc()).limit(3)))
    count = 0
    for item in recent:
        created = item.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if created >= cutoff:
            count += 1
    if count >= 3:
        raise HTTPException(status_code=429,
            detail="Too many alerts in a short period. If this is a real emergency, call 112 directly.")
    alert = EmergencyAlert(user_id=user.id, status="created", latitude=data.latitude,
                           longitude=data.longitude, location_accuracy=data.location_accuracy,
                           message=data.message.strip() or "Emergency assistance requested")
    db.add(alert)
    db.commit()
    db.refresh(alert)
    contacts = list(db.scalars(select(EmergencyContact).where(EmergencyContact.user_id == user.id)))
    delivery = notify_emergency_contacts(contacts=contacts, user_name=user.full_name,
        alert_id=alert.id, latitude=alert.latitude, longitude=alert.longitude)
    return {"alert": serialize_alert(alert), "contacts_saved": len(contacts), "notification": delivery,
            "notice": "Alert saved to the dashboard only. Contacts have NOT been texted. For immediate help in India, call 112."}
