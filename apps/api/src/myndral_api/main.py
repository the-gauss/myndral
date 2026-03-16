import mimetypes

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

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

# ── Image proxy ───────────────────────────────────────────────────────────────
# Serves locally uploaded images in dev and proxies from GCS in production.
# Both modes share the same /v1/images/<filename> URL so callers never need to
# know where the file lives.  Using a route (rather than StaticFiles) means
# we don't need a public-read GCS bucket — the API's service account handles
# access transparently.
_IMAGES_DIR = DATA_DIR / "images"
_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/v1/images/{filepath:path}", include_in_schema=False)
async def serve_image(filepath: str) -> Response:
    _settings = get_settings()
    if _settings.gcs_bucket_name:
        # Production: fetch from GCS using the service account's ADC credentials.
        from google.cloud import storage as _gcs  # lazy — not needed in dev

        try:
            blob = _gcs.Client().bucket(_settings.gcs_bucket_name).blob(f"images/{filepath}")
            data = blob.download_as_bytes()
        except Exception:
            raise HTTPException(status_code=404, detail="Image not found.")
        mime, _ = mimetypes.guess_type(filepath)
        return Response(content=data, media_type=mime or "application/octet-stream")
    else:
        # Dev: read from local data/images/ directory.
        local_path = _IMAGES_DIR / filepath
        if not local_path.exists() or not local_path.is_file():
            raise HTTPException(status_code=404, detail="Image not found.")
        return FileResponse(local_path)
