# MyndralAI

AI-generated music streaming platform. Every artist, album, track, and lyric is created by AI — no real artists, no copyright concerns.

## Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python 3.12) |
| Frontend | React 18 + Vite + TypeScript |
| AI / Agents | LangGraph |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Package manager (Python) | uv |
| Package manager (JS) | npm |

## Monorepo layout

```
myndral/
├── agents/          # LangGraph AI agents (artist, album, track, lyric generation)
├── apps/
│   ├── api/          # FastAPI backend
│   ├── ios/          # Native iOS client (planned)
│   ├── web/          # Listener-facing React + Vite app
│   └── internal-web/ # Internal employee studio (React + Vite)
├── db/
│   ├── migrations/  # Alembic migrations
│   └── seeds/       # Seed data scripts
├── docs/            # Architecture docs
├── infra/           # Docker Compose, Nginx config, etc.
├── services/        # Future microservices (streaming, search, recommendations…)
└── transform/       # ETL / data pipelines
```

## Quick start

### Prerequisites

- Python ≥ 3.12 with [uv](https://docs.astral.sh/uv/)
- Node ≥ 20 with npm
- Docker + Docker Compose

### 1. Clone & configure environment

```bash
cp .env.example .env
# edit .env with your values
```

### 2. Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 3. Run the API

```bash
cd apps/api
uv sync
uv run uvicorn myndral_api.main:app --reload --port 8000
```

### 4. Run the web app

```bash
cd apps/web
npm install
npm run dev
```

The web app will be available at `http://localhost:5173` and the API at `http://localhost:8000`.

### 5. Run the internal studio web app

```bash
cd apps/internal-web
npm install
npm run dev
```

The internal studio will be available at `http://127.0.0.1:5174`.

## Dev login account

After applying schema + seeds, you can log in with:

- Username: `admin_test`
- Password: `AdminPass123!`

This account is seeded by `db/seeds/03_dev_catalog.sql` with `admin` role and a premium plan.

## Internal studio login account

After running `db/seeds/03_dev_catalog.sql`, you can also use:

- Username: `editor_test`
- Password: `EditorPass123!`

This account is seeded with `content_editor` role for `/v1/internal/*` access.
