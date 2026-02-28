# services/

Future home for dedicated microservices as the platform scales.

Planned services (Spotify-inspired):

| Service | Responsibility |
|---|---|
| `auth` | JWT issuance, refresh, OAuth |
| `catalog` | Artists, albums, tracks metadata CRUD |
| `streaming` | Audio delivery, byte-range serving |
| `search` | Full-text + semantic search (Postgres FTS / Typesense) |
| `recommendations` | Personalised discovery, radio queues |
| `generation` | LangGraph agent orchestration (AI content creation) |
| `user` | Profiles, library, follow graph |
| `ingestion` | Receives generated audio/metadata and stores to object storage |

For the initial MVP these responsibilities live inside `apps/api`.
