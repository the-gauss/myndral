import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.db.session import get_db
from myndral_api.media_utils import (
    guess_media_type,
    is_remote_storage_url,
    resolve_local_storage_path,
)

router = APIRouter()

# Matches the standard HTTP Range header value, e.g. "bytes=0-1023" or "bytes=512-"
_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)", re.IGNORECASE)


@router.get("/{track_id}", summary="Stream audio for a track")
async def stream_track(
    track_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            text(
                """
SELECT
  taf.storage_url,
  taf.format::text AS format
FROM track_audio_files taf
JOIN tracks t ON t.id = taf.track_id
JOIN albums a ON a.id = t.album_id
JOIN artists ar ON ar.id = t.primary_artist_id
WHERE taf.track_id = :track_id
  AND t.status = 'published'
  AND a.status = 'published'
  AND ar.status = 'published'
ORDER BY CASE taf.quality
  WHEN 'high_320' THEN 1
  WHEN 'lossless' THEN 2
  WHEN 'standard_256' THEN 3
  WHEN 'low_128' THEN 4
  ELSE 5
END
LIMIT 1
"""
            ),
            {"track_id": track_id},
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track audio not found")

    storage_url = str(row["storage_url"])
    audio_format = row["format"]

    # ── Local file (dev) ──────────────────────────────────────────────────────
    local_path = resolve_local_storage_path(storage_url)
    if local_path is not None:
        return FileResponse(
            path=local_path,
            media_type=guess_media_type(local_path, audio_format),
            filename=local_path.name,
        )

    # ── GCS (production) — proxy with HTTP Range support ─────────────────────
    # We proxy rather than redirect to a public URL so that:
    #  1. No public-read IAM policy is needed on the bucket.
    #  2. Published-status enforcement in this handler cannot be bypassed by
    #     guessing a GCS object path directly.
    # Range request support is required for the browser seek bar.
    if storage_url.startswith("gs://"):
        from myndral_api.gcs_utils import download_gcs_bytes

        range_header = request.headers.get("range", "")
        media_type = _gcs_audio_media_type(storage_url, audio_format)

        m = _RANGE_RE.match(range_header.strip()) if range_header else None
        if m:
            start = int(m.group(1)) if m.group(1) else 0
            # GCS end is *inclusive*; if the header omits end we request None (→ EOF)
            end: int | None = int(m.group(2)) if m.group(2) else None

            data, total_size = download_gcs_bytes(storage_url, start=start, end=end)
            actual_end = (end if end is not None else total_size - 1)
            return Response(
                content=data,
                status_code=206,
                headers={
                    "Content-Range": f"bytes {start}-{actual_end}/{total_size}",
                    "Content-Length": str(len(data)),
                    "Content-Type": media_type,
                    "Accept-Ranges": "bytes",
                },
            )

        # Full download
        data, total_size = download_gcs_bytes(storage_url)
        return Response(
            content=data,
            status_code=200,
            headers={
                "Content-Length": str(total_size),
                "Content-Type": media_type,
                "Accept-Ranges": "bytes",
            },
        )

    # ── External HTTPS CDN URL ────────────────────────────────────────────────
    if is_remote_storage_url(storage_url):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(storage_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Unsupported storage URL for track audio",
    )


def _gcs_audio_media_type(gs_url: str, db_format: str | None) -> str:
    """Derive a MIME type from the GCS object path extension, falling back to db_format."""
    from pathlib import Path

    object_name = gs_url[5:].partition("/")[2]   # strip "gs://bucket/"
    return guess_media_type(Path(object_name), db_format)
