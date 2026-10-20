from pydantic import BaseModel, EmailStr, Field, ConfigDict

class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^[+()0-9 .-]{7,30}$")
    relationship_label: str = Field(default="Emergency contact", min_length=2, max_length=50)

class ContactOut(ContactIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class AlertIn(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_accuracy: float | None = Field(default=None, ge=0, le=100000)
    message: str = Field(default="Emergency assistance requested", max_length=500)
