from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.db.session import get_db
from myndral_api.media_utils import (
    guess_media_type,
    is_remote_storage_url,
    resolve_local_storage_path,
)

router = APIRouter()


@router.get("/{track_id}", summary="Stream audio for a track")
async def stream_track(
    track_id: str,
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
    local_path = resolve_local_storage_path(storage_url)
    if local_path is not None:
        return FileResponse(
            path=local_path,
            media_type=guess_media_type(local_path, row["format"]),
            filename=local_path.name,
        )

    if is_remote_storage_url(storage_url):
        # For remote URLs, rely on object storage/CDN streaming capabilities.
        return RedirectResponse(storage_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Unsupported storage URL for track audio",
    )
