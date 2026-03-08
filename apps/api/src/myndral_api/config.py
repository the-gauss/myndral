from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]
ENV_FILES = [
    REPO_ROOT / ".env",  # monorepo root (default)
    REPO_ROOT / ".env.local",
    REPO_ROOT / "apps" / "api" / ".env",  # app-local override (optional)
    ".env",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "MyndralAI API"
    environment: str = "development"
    debug: bool = False
    secret_key: str = "change-me-to-a-secure-random-string-at-least-32-chars"

    # Database
    database_url: str = "postgresql+asyncpg://myndral:myndral@localhost:5432/myndral"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Auth
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # AI
    anthropic_api_key: str = ""
    lyria_3_api_key: str = ""
    lyria_model: str = "models/lyria-realtime-exp"
    lyria_output_subdir: str = "generated/music"

    # CORS — comma-separated origins
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:4173,"
        "http://127.0.0.1:4173"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
