# MyndralAI — Architecture

## Overview

MyndralAI is a fully AI-generated music streaming platform. All content (artists, albums, tracks, lyrics) is produced by AI agents and served through a Spotify-like product experience.

## High-level diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/web (React)                      │
│   Sidebar | TopBar | Player | Pages (Home/Search/Library…)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / REST
┌──────────────────────────▼──────────────────────────────────┐
│                       apps/api (FastAPI)                     │
│  /v1/artists  /v1/albums  /v1/tracks  /v1/playlists         │
│  /v1/search   /v1/users   /v1/stream  /v1/auth              │
└──────────┬───────────────────────────────────┬──────────────┘
           │                                   │
┌──────────▼──────────┐           ┌────────────▼────────────┐
│   PostgreSQL 16      │           │       Redis 7            │
│   (primary store)    │           │  (sessions, cache, pub/  │
│                      │           │   sub for generation     │
└──────────────────────┘           │   events)               │
                                   └─────────────────────────┘
           ▲
           │  writes generated content
┌──────────┴──────────────────────────────────────────────────┐
│                    agents/ (LangGraph)                       │
│  ArtistAgent | AlbumAgent | TrackAgent | LyricAgent         │
│  PersonaAgent | RecommendationAgent                         │
└─────────────────────────────────────────────────────────────┘
```

## Data model (summary)

- **users** — registered listeners
- **artists** — AI personas with genre, style, biography
- **albums** — grouped releases belonging to an artist
- **tracks** — individual songs with audio URL and duration
- **lyrics** — per-track AI-generated lyrics
- **playlists** — user-curated or AI-curated track collections
- **play_history** — event log for personalisation signals

## Key design decisions

1. **Single FastAPI app for MVP** — all domains in `apps/api`; split to `services/` when traffic demands it.
2. **Async throughout** — `asyncpg` + SQLAlchemy async session; `redis.asyncio` for cache.
3. **LangGraph agents are decoupled** — they write to Postgres/Redis via internal API calls, not direct DB access from the agent process.
4. **Audio storage** — out of scope for local MVP; placeholder `audio_url` field will point to object storage (S3/R2) in production.
