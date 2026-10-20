from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "MedAlert"
    environment: str = "development"
    secret_key: str = "unsafe-development-key-change-me"
    database_url: str = "sqlite:///./medalert.db"
    access_token_minutes: int = 30
    cors_origins: str = "http://127.0.0.1:8000,http://localhost:8000"
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
