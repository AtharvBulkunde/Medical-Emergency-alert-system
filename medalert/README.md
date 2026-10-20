# MedAlert full-stack application

This folder contains the FastAPI web app. Read the repository root `README.md` for complete setup, security notes, API endpoints, and limitations.

Quick start in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

Replace the `.env` `SECRET_KEY` placeholder with the generated value, then run:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000. The app stores alert records in the database only; SMS, ambulance dispatch, and medically reliable fall detection are not implemented. For an actual emergency in India, call 112.
