# myndral-api

FastAPI backend for MyndralAI.

## Development

```bash
# from repo root
cd apps/api
uv sync
uv run uvicorn myndral_api.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`.

## Structure

```
src/myndral_api/
├── main.py          # App factory, middleware, router registration
├── config.py        # Settings (pydantic-settings, loaded from .env)
├── db/
│   └── session.py   # Async SQLAlchemy engine + session factory
├── models/          # SQLAlchemy ORM models
└── routers/         # One file per domain (artists, albums, tracks…)
```
