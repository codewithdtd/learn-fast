from pathlib import Path

from pydantic_settings import DotEnvSettingsSource

from app.core.config import Settings


def test_settings_uses_backend_env_independently_of_cwd(tmp_path, monkeypatch):
    requested_files = []

    def read_env(source):
        requested_files.append(Path(source.env_file))
        return {"writing_daily_ai_quota": "50"}

    monkeypatch.delenv("WRITING_DAILY_AI_QUOTA", raising=False)
    monkeypatch.setattr(DotEnvSettingsSource, "_read_env_files", read_env)
    monkeypatch.chdir(tmp_path)
    loaded = Settings()

    assert loaded.writing_daily_ai_quota == 50
    assert requested_files == [Path(__file__).resolve().parents[1] / ".env"]


def test_process_environment_still_overrides_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("WRITING_DAILY_AI_QUOTA=50\n", encoding="utf-8")
    monkeypatch.setenv("WRITING_DAILY_AI_QUOTA", "7")
    assert Settings(_env_file=env_file).writing_daily_ai_quota == 7
