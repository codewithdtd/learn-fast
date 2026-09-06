from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read safe local-development settings from the backend environment."""

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_origin: str = "http://localhost:3000"
    database_url: str = "sqlite:///./data/app.db"
    
    # JWT authentication settings
    # In production, secret_key should be set via environment variable with high entropy
    secret_key: str = "dev-secret-key-change-in-production-learn-fast-auth-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days for development ease

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
