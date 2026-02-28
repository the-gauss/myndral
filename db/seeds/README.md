# db/seeds/

Seed files run in numeric order after `db/schema.sql` has been applied.

| File | Contents | Environment |
|---|---|---|
| `01_genres.sql` | Full genre taxonomy (~60 genres, hierarchical) | All |
| `02_subscription_plans.sql` | Free, Premium Monthly, Premium Annual plans | All |
| `03_dev_catalog.sql` | 5 AI artists, 10 albums, ~40 tracks, sample users + playlists | **Dev / Staging only** |

## Running seeds

```bash
# Fresh bootstrap (run from repo root)
psql $DATABASE_URL -f db/schema.sql
psql $DATABASE_URL -f db/seeds/01_genres.sql
psql $DATABASE_URL -f db/seeds/02_subscription_plans.sql

# Dev / staging only
psql $DATABASE_URL -f db/seeds/03_dev_catalog.sql
```

All seed files are **idempotent** — safe to re-run. `01_genres.sql` and
`02_subscription_plans.sql` use `ON CONFLICT DO NOTHING` / `DO UPDATE`.
`03_dev_catalog.sql` uses existence checks so re-runs skip already-created rows.

## Production notes

- Never run `03_dev_catalog.sql` in production. The file contains a guard that
  raises an exception if `app.environment = 'production'`.
- `02_subscription_plans.sql` uses `ON CONFLICT DO UPDATE` so plan features
  stay in sync with the seed file — run it during deployments to propagate
  plan changes.
- `01_genres.sql` uses `ON CONFLICT DO NOTHING` — existing genre rows are
  never modified by re-running.

## Dev accounts

| Username | Role | Notes |
|---|---|---|
| `system` | admin | Content attribution for seeded catalog; no real password |
| `alice_dev` | listener | Active Premium subscription |
| `bob_dev` | listener | Free subscription |

Passwords are placeholder bcrypt hashes. Use the API's `/v1/auth/register`
endpoint to create real accounts in local development.
