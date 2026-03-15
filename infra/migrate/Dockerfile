# Minimal image for the DB migration Cloud Run Job.
# Uses psycopg2 (synchronous) — no need for the full API stack.
FROM python:3.12-slim

RUN pip install --no-cache-dir psycopg2-binary==2.9.*

WORKDIR /app
COPY infra/migrate/run_migrations.py ./
COPY db/migrations/ ./db/migrations/

CMD ["python", "run_migrations.py"]
