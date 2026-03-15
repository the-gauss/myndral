from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from myndral_api.config import get_settings
from myndral_api.media_utils import DATA_DIR
from myndral_api.routers import (
    albums,
    artists,
    auth,
    exports,
    health,
    internal,
    notifications,
    playlists,
    search,
    staging,
    stream,
    tracks,
    users,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "AI-generated music streaming platform — every artist, album, and track is created by AI."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(health.router)
app.include_router(auth.router,          prefix="/v1/auth",          tags=["auth"])
app.include_router(users.router,         prefix="/v1/users",         tags=["users"])
app.include_router(internal.router,      prefix="/v1/internal",      tags=["internal"])
app.include_router(staging.router,       prefix="/v1/internal",      tags=["staging"])
app.include_router(notifications.router, prefix="/v1/internal",      tags=["notifications"])
app.include_router(artists.router,       prefix="/v1/artists",       tags=["artists"])
app.include_router(albums.router,        prefix="/v1/albums",        tags=["albums"])
app.include_router(tracks.router,        prefix="/v1/tracks",        tags=["tracks"])
app.include_router(playlists.router,     prefix="/v1/playlists",     tags=["playlists"])
app.include_router(search.router,        prefix="/v1/search",        tags=["search"])
app.include_router(stream.router,        prefix="/v1/stream",        tags=["stream"])
app.include_router(exports.router,       prefix="/v1",               tags=["exports"])

# ── Static image assets ───────────────────────────────────────────────────────
# Locally uploaded images (artist portraits, album covers) are stored under
# data/images/ and served at /v1/images/<filename>.  The directory is created
# eagerly so StaticFiles does not raise at startup.  Both the web player and
# the internal studio proxy /v1 to this API, so the path resolves correctly in
# all environments.  Remote (CDN/S3) URLs are returned as-is from the DB and
# bypass this mount entirely.
_IMAGES_DIR = DATA_DIR / "images"
_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/v1/images", StaticFiles(directory=_IMAGES_DIR), name="images")
