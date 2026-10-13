from pathlib import Path

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

    # Demo Showcase Read-Only Mode
    # When enabled, database mutations (workbook import, delete, rename, register) are blocked.
    demo_mode: bool = False

    # 9Router Local AI Configuration
    # Kết nối endpoint OpenAI-compatible của 9router local để tự động sinh flashcards
    ai_base_url: str = "http://localhost:20128/v1"
    ai_api_key: str = ""
    ai_model: str = "Anti_2"
    ai_request_timeout: float = 90.0

    # Writing AI is capped per user per local calendar day to keep provider cost predictable.
    writing_daily_ai_quota: int = 5
    writing_topic_generation_daily_quota: int = 3
    writing_max_words: int = 300
    writing_max_characters: int = 4000
    writing_grading_timeout: float = 90.0
    writing_timezone: str = "Asia/Bangkok"

    # Neo vào thư mục backend để chạy uvicorn từ root vẫn đọc đúng quota và cấu hình local.
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

