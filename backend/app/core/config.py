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

    # Cờ tương thích cấu hình cũ. Quyền admin luôn được kiểm tra, không phụ thuộc cờ này;
    # sheet public demo nằm riêng ở frontend để admin không bị khóa thao tác nhầm.
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

    # Speaking uses Gemini only for transcription; the existing text provider grades transcripts.
    gemini_api_key: str = ""
    gemini_asr_model: str = "gemini-3.5-transcribe"
    speaking_daily_ai_quota: int = 5
    speaking_max_audio_bytes: int = 20 * 1024 * 1024
    speaking_provider_timeout: float = 150.0
    speaking_grading_timeout: float = 90.0
    speaking_timezone: str = "Asia/Bangkok"

    # Video practice uses a transcript provider only for captions; no video/audio is downloaded or stored.
    youtube_transcript_api_key: str = ""
    youtube_transcript_api_url: str = "https://getyoutubetranscript.com/api/v1/transcript"
    video_practice_provider_timeout: float = 20.0
    video_practice_requests_per_minute: int = 30
    video_dictionary_api_url: str = "https://api.dictionaryapi.dev/api/v2/entries/en"
    video_translation_api_url: str = "https://api.mymemory.translated.net/get"

    # Neo vào thư mục backend để chạy uvicorn từ root vẫn đọc đúng quota và cấu hình local.
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

