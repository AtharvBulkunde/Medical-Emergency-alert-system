# MEDIGUARD / MedAlert — Medical Emergency Alert System

**Every Second Matters.**

This repository contains the existing static MEDIGUARD project landing page at the root and a full-stack web application in `medalert/`.

## Full-stack app features

- White, blue and red responsive medical dashboard
- Register / sign in using server-side password hashing (Argon2)
- Short-lived JWT access tokens held in browser memory
- Emergency contact create/list/delete with per-user authorization
- SOS workflow with confirmation and optional browser GPS coordinates
- Alert history with map links where coordinates were saved
- Opt-in experimental browser motion-sensor fall-like movement prompt
- FastAPI backend, SQLite local database, server-side request validation, basic rate limit and security headers

## Important emergency and safety notice

This learning prototype saves alerts to the app database only. **It does not send SMS, phone calls, or ambulance dispatch.** It does not reliably detect falls and is not a certified medical alert service. Do not rely on this software for life-critical response. In India, call **112** directly for emergency assistance.

The fall feature is an experimental motion heuristic. It is off by default, requires compatible hardware/browser and an open page, may be unavailable on desktops, can miss falls, and can produce false alarms. It asks the user to confirm before creating a fall-related alert. It is not a replacement for validated fall-detection devices.

## Run the full-stack web app on Windows

Install Python 3.11 or newer. In PowerShell, from the repository root:

```powershell
cd medalert
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the generated value into `medalert/.env` as the value of `SECRET_KEY` (replace the placeholder). Then start the server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000**. Local development API docs are at **http://127.0.0.1:8000/api/docs**.

If PowerShell path activation is disabled, the above commands use the virtual environment's Python directly and do not require activation. Geolocation and device motion sensor support normally require HTTPS or localhost and explicit browser permission.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/me` | Current user |
| GET / POST | `/api/contacts` | List or add your own emergency contacts |
| DELETE | `/api/contacts/{id}` | Delete your own contact |
| GET / POST | `/api/alerts` | List / create your own alerts |

Authenticated API calls use `Authorization: Bearer <access_token>`. Access tokens expire after 30 minutes by default and are kept in page memory rather than localStorage; refreshing the page requires signing in again.

## Project structure

```text
Medical-Emergency-alert-system/
├── index.html                 # Existing MEDIGUARD static landing page
├── README.md
└── medalert/
    ├── .env.example
    ├── requirements.txt
    ├── README.md
    └── app/
        ├── __init__.py
        ├── config.py
        ├── database.py
        ├── main.py
        ├── models.py
        ├── notifications.py
        ├── schemas.py
        ├── security.py
        └── static/
            ├── index.html
            ├── styles.css
            └── app.js
```

## Security before deployment

- Run behind HTTPS and set a strong `SECRET_KEY` through your deployment secret manager.
- Set `ENVIRONMENT=production`; API documentation is disabled in production mode and the server refuses a default/short secret.
- Set `CORS_ORIGINS` to the exact trusted origin(s) and never use a wildcard as a shortcut.
- Replace SQLite with managed PostgreSQL and use schema migrations and tested backups.
- Add per-IP auth rate limiting, login abuse detection, secure account recovery, verified contact data, audit logging, observability and automated tests.
- Keep provider credentials on the server, never in `app/static/`; implement notifications only after consent, delivery callbacks, retries and rate limits are in place.
- Minimize sensitive health/location data, define retention/deletion rules, encrypt backups and restrict staff access.
- Conduct independent security, privacy, accessibility and legal/regulatory reviews before real-world use.

## Notification integration

`app/notifications.py` intentionally returns a clear "not configured" status without sending messages. Add an SMS provider only using server-side secrets and verified end-to-end delivery. Do not label an alert as dispatched unless a real authorized dispatch integration confirms that result.

## Reset local demo data

Stop the server and delete `medalert/medalert.db`. This permanently removes local demo accounts, contacts and alerts.
