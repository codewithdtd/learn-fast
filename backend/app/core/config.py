from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read safe local-development settings from the backend environment."""

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_origin: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
