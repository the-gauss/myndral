from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
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
    elevenlabs_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("ELEVENLABS_API_KEY", "LYRIA_3_API_KEY"),
    )
    elevenlabs_model: str = Field(
        default="music_v1",
        validation_alias=AliasChoices("ELEVENLABS_MODEL", "LYRIA_MODEL"),
    )
    elevenlabs_output_subdir: str = Field(
        default="generated/music",
        validation_alias=AliasChoices("ELEVENLABS_OUTPUT_SUBDIR", "LYRIA_OUTPUT_SUBDIR"),
    )
    elevenlabs_output_format: str = Field(
        default="mp3_44100_128",
        validation_alias=AliasChoices("ELEVENLABS_OUTPUT_FORMAT"),
    )

    # Storage — GCS bucket for images and audio in production.
    # Empty string → use local data/ directory (dev default).
    gcs_bucket_name: str = ""

    # Studio access tokens — JSON object mapping token string → role name.
    # Stored in Secret Manager (myndral-studio-tokens) and injected as an env
    # var at runtime.  Empty object disables studio self-registration.
    studio_access_tokens: str = "{}"

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
