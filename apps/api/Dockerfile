# Build context must be the monorepo root so that uv can resolve the workspace.
# Example: docker buildx build --platform linux/amd64 -f apps/api/Dockerfile .

# ── Stage 1: build wheel + install all deps ───────────────────────────────────
FROM python:3.12-slim AS deps

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Use /app as WORKDIR so the venv lives at /app/.venv — shebangs will point
# to /app/.venv/bin/python, which is the same path in the runtime stage.
WORKDIR /app

# Workspace manifests first (cache layer only invalidated by dep changes).
COPY pyproject.toml uv.lock ./

# Full API package — hatchling needs src/ to build the myndral_api wheel.
# Copying the whole apps/api/ directory lets uv build a proper non-editable
# wheel that embeds the source into site-packages.
COPY apps/api/ apps/api/

# --no-dev: exclude pytest/ruff.
# --no-editable: install as a normal wheel so the runtime stage needs no src mount.
RUN uv sync --frozen --no-dev --no-editable


# ── Stage 2: minimal runtime image ───────────────────────────────────────────
FROM python:3.12-slim AS runtime

RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

# The venv contains the installed myndral_api wheel in site-packages — no
# separate src copy needed in the runtime image.
COPY --from=deps /app/.venv /app/.venv

# Cloud Run convention: port 8080.
ENV PORT=8080
# Local data dir for ephemeral staging (used before GCS upload in production).
# /tmp is writable by all users on Cloud Run's ephemeral filesystem.
ENV DATA_DIR=/tmp/myndral-data

USER app

CMD ["/app/.venv/bin/uvicorn", "myndral_api.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
