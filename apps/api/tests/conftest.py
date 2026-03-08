import os

# Minimal configuration so Settings() loads during tests without external services.
os.environ.setdefault("ENVIRONMENT", "testing")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://myndral:testpass@localhost:5432/myndral_test",
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "30")
# Dummy key avoids validation errors when music settings are accessed in tests.
os.environ.setdefault("ELEVENLABS_API_KEY", "test-elevenlabs-key")
