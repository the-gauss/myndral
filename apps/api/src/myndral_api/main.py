from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from myndral_api.config import get_settings
from myndral_api.routers import albums, artists, auth, health, playlists, search, stream, tracks, users

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="AI-generated music streaming platform — every artist, album, and track is created by AI.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(health.router)
app.include_router(auth.router,      prefix="/v1/auth",      tags=["auth"])
app.include_router(users.router,     prefix="/v1/users",     tags=["users"])
app.include_router(artists.router,   prefix="/v1/artists",   tags=["artists"])
app.include_router(albums.router,    prefix="/v1/albums",    tags=["albums"])
app.include_router(tracks.router,    prefix="/v1/tracks",    tags=["tracks"])
app.include_router(playlists.router, prefix="/v1/playlists", tags=["playlists"])
app.include_router(search.router,    prefix="/v1/search",    tags=["search"])
app.include_router(stream.router,    prefix="/v1/stream",    tags=["stream"])
