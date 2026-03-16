#!/usr/bin/env python3
"""
One-shot DB migration runner.

Applies all SQL files in db/migrations/ that have not yet been recorded in the
`schema_migrations` tracking table.  Files are applied in lexicographic order
(YYYYMMDD_NN prefix guarantees chronological ordering).

Intended to run as a Cloud Run Job before each deployment.  Can also be
executed locally:

    DATABASE_URL=postgresql://... python infra/migrate/run_migrations.py

Environment variables:
    DATABASE_URL  — standard libpq connection string (required)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras

# In the container: script is at /app/run_migrations.py, migrations at /app/db/migrations/
MIGRATIONS_DIR = Path(__file__).resolve().parent / "db" / "migrations"

CREATE_TRACKING_TABLE = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def main() -> None:
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # psycopg2 uses postgresql:// not postgresql+asyncpg://
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False

    with conn.cursor() as cur:
        cur.execute(CREATE_TRACKING_TABLE)
        conn.commit()

        cur.execute("SELECT filename FROM schema_migrations")
        applied: set[str] = {row[0] for row in cur.fetchall()}

    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    pending = [f for f in sql_files if f.name not in applied]

    if not pending:
        print("No pending migrations.")
        return

    for path in pending:
        print(f"Applying {path.name} ...", end=" ", flush=True)
        sql = path.read_text()
        with conn.cursor() as cur:
            try:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,)
                )
                conn.commit()
                print("done.")
            except Exception as exc:
                conn.rollback()
                print(f"FAILED: {exc}", file=sys.stderr)
                sys.exit(1)

    conn.close()
    print(f"Applied {len(pending)} migration(s).")


if __name__ == "__main__":
    main()
