from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.db.session import get_db
from myndral_api.media_utils import normalize_audio_url

router = APIRouter()


@router.get("/", summary="List albums (paginated)")
async def list_albums(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = (
        await db.execute(
            text(
                """
SELECT
  al.id::text AS id,
  al.title,
  al.artist_id::text AS artist_id,
  ar.name AS artist_name,
  ar.slug AS artist_slug,
  ar.bio AS artist_bio,
  ar.image_url AS artist_image_url,
  ar.monthly_listeners AS artist_monthly_listeners,
  ar.style_tags AS artist_style_tags,
  al.cover_url,
  COALESCE(al.release_date::text, CURRENT_DATE::text) AS release_date,
  al.album_type::text AS album_type,
  al.track_count,
  COALESCE((
    SELECT array_agg(g.name ORDER BY g.name)
    FROM album_genres ag
    JOIN genres g ON g.id = ag.genre_id
    WHERE ag.album_id = al.id
  ), ARRAY[]::text[]) AS genre_tags
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
WHERE al.status = 'published'
  AND ar.status = 'published'
ORDER BY al.release_date DESC NULLS LAST, al.created_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            {"limit": limit, "offset": offset},
        )
    ).mappings().all()
    total = int(
        (
            await db.execute(
                text(
                    """
SELECT count(*)
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
WHERE al.status = 'published'
  AND ar.status = 'published'
"""
                )
            )
        ).scalar_one()
    )
    return {
        "items": [_serialize_album(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/new-releases", summary="Get new releases")
async def get_new_releases(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = (
        await db.execute(
            text(
                """
SELECT
  al.id::text AS id,
  al.title,
  al.artist_id::text AS artist_id,
  ar.name AS artist_name,
  ar.slug AS artist_slug,
  ar.bio AS artist_bio,
  ar.image_url AS artist_image_url,
  ar.monthly_listeners AS artist_monthly_listeners,
  ar.style_tags AS artist_style_tags,
  al.cover_url,
  COALESCE(al.release_date::text, CURRENT_DATE::text) AS release_date,
  al.album_type::text AS album_type,
  al.track_count,
  COALESCE((
    SELECT array_agg(g.name ORDER BY g.name)
    FROM album_genres ag
    JOIN genres g ON g.id = ag.genre_id
    WHERE ag.album_id = al.id
  ), ARRAY[]::text[]) AS genre_tags
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
WHERE al.status = 'published'
  AND ar.status = 'published'
ORDER BY al.release_date DESC NULLS LAST, al.created_at DESC
LIMIT :limit
"""
            ),
            {"limit": limit},
        )
    ).mappings().all()
    items = [_serialize_album(row) for row in rows]
    return {"items": items, "total": len(items), "limit": limit, "offset": 0}


@router.get("/{album_id}", summary="Get album by ID")
async def get_album(album_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    row = (
        await db.execute(
            text(
                """
SELECT
  al.id::text AS id,
  al.title,
  al.artist_id::text AS artist_id,
  ar.name AS artist_name,
  ar.slug AS artist_slug,
  ar.bio AS artist_bio,
  ar.image_url AS artist_image_url,
  ar.monthly_listeners AS artist_monthly_listeners,
  ar.style_tags AS artist_style_tags,
  al.cover_url,
  COALESCE(al.release_date::text, CURRENT_DATE::text) AS release_date,
  al.album_type::text AS album_type,
  al.track_count,
  COALESCE((
    SELECT array_agg(g.name ORDER BY g.name)
    FROM album_genres ag
    JOIN genres g ON g.id = ag.genre_id
    WHERE ag.album_id = al.id
  ), ARRAY[]::text[]) AS genre_tags
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
WHERE al.id = :album_id
  AND al.status = 'published'
  AND ar.status = 'published'
LIMIT 1
"""
            ),
            {"album_id": album_id},
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Album not found")
    return _serialize_album(row)


@router.get("/{album_id}/tracks", summary="Get album tracks")
async def get_album_tracks(
    album_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    album = await _fetch_album(db, album_id)
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    rows = (
        await db.execute(
            text(
                """
SELECT
  t.id::text AS id,
  t.title,
  t.album_id::text AS album_id,
  t.primary_artist_id::text AS artist_id,
  t.track_number,
  t.duration_ms,
  t.play_count,
  t.explicit,
  pa.name AS artist_name,
  pa.slug AS artist_slug,
  pa.bio AS artist_bio,
  pa.image_url AS artist_image_url,
  pa.monthly_listeners AS artist_monthly_listeners,
  pa.style_tags AS artist_style_tags,
  COALESCE((
    SELECT taf.storage_url
    FROM track_audio_files taf
    WHERE taf.track_id = t.id
    ORDER BY CASE taf.quality
      WHEN 'high_320' THEN 1
      WHEN 'lossless' THEN 2
      WHEN 'standard_256' THEN 3
      WHEN 'low_128' THEN 4
      ELSE 5
    END
    LIMIT 1
  ), NULL) AS audio_url
FROM tracks t
JOIN artists pa ON pa.id = t.primary_artist_id
WHERE t.album_id = :album_id
  AND t.status = 'published'
ORDER BY t.disc_number ASC, t.track_number ASC, t.created_at ASC
"""
            ),
            {"album_id": album_id},
        )
    ).mappings().all()
    items = [_serialize_track(row, album) for row in rows]
    return {
        "items": items,
        "total": len(items),
        "limit": len(items),
        "offset": 0,
    }


@router.put("/{album_id}/save", summary="Save album to library")
async def save_album(album_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.delete("/{album_id}/save", summary="Remove album from library")
async def unsave_album(album_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


async def _fetch_album(db: AsyncSession, album_id: str) -> dict[str, Any] | None:
    row = (
        await db.execute(
            text(
                """
SELECT
  al.id::text AS id,
  al.title,
  al.artist_id::text AS artist_id,
  ar.name AS artist_name,
  ar.slug AS artist_slug,
  ar.bio AS artist_bio,
  ar.image_url AS artist_image_url,
  ar.monthly_listeners AS artist_monthly_listeners,
  ar.style_tags AS artist_style_tags,
  al.cover_url,
  COALESCE(al.release_date::text, CURRENT_DATE::text) AS release_date,
  al.album_type::text AS album_type,
  al.track_count,
  COALESCE((
    SELECT array_agg(g.name ORDER BY g.name)
    FROM album_genres ag
    JOIN genres g ON g.id = ag.genre_id
    WHERE ag.album_id = al.id
  ), ARRAY[]::text[]) AS genre_tags
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
WHERE al.id = :album_id
  AND al.status = 'published'
  AND ar.status = 'published'
LIMIT 1
"""
            ),
            {"album_id": album_id},
        )
    ).mappings().first()
    return _serialize_album(row) if row else None


def _serialize_artist_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": row["artist_id"],
        "name": row["artist_name"],
        "slug": row["artist_slug"],
        "bio": row["artist_bio"],
        "imageUrl": row["artist_image_url"],
        "monthlyListeners": int(row["artist_monthly_listeners"] or 0),
        "verified": True,
        "styleTags": row["artist_style_tags"] or [],
    }


def _serialize_album(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "artistId": row["artist_id"],
        "artist": _serialize_artist_from_row(row),
        "coverUrl": row["cover_url"],
        "releaseDate": row["release_date"],
        "albumType": row["album_type"],
        "genreTags": row["genre_tags"] or [],
        "trackCount": int(row["track_count"] or 0),
    }


def _serialize_track(row: Any, album: dict[str, Any]) -> dict[str, Any]:
    track_id = row["id"]
    artist = _serialize_artist_from_row(row)
    return {
        "id": track_id,
        "title": row["title"],
        "albumId": row["album_id"],
        "album": album,
        "artistId": row["artist_id"],
        "artist": artist,
        "trackNumber": int(row["track_number"] or 1),
        "durationMs": int(row["duration_ms"] or 0),
        "audioUrl": normalize_audio_url(track_id, row["audio_url"]),
        "playCount": int(row["play_count"] or 0),
        "explicit": bool(row["explicit"]),
    }
