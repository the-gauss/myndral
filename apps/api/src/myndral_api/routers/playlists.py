from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db
from myndral_api.media_utils import normalize_audio_url

router = APIRouter()


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _serialize_track(row: Any) -> dict[str, Any]:
    track_id = row["id"]
    artist = {
        "id": row["artist_id"],
        "name": row["artist_name"],
        "slug": row["artist_slug"],
        "bio": row["artist_bio"],
        "imageUrl": row["artist_image_url"],
        "monthlyListeners": int(row["artist_monthly_listeners"] or 0),
        "verified": True,
        "styleTags": row["artist_style_tags"] or [],
    }
    album = {
        "id": row["album_id"],
        "title": row["album_title"],
        "artistId": row["album_artist_id"],
        "artist": {
            "id": row["album_artist_id"],
            "name": row["album_artist_name"],
            "slug": row["album_artist_slug"],
            "bio": row["album_artist_bio"],
            "imageUrl": row["album_artist_image_url"],
            "monthlyListeners": int(row["album_artist_monthly_listeners"] or 0),
            "verified": True,
            "styleTags": row["album_artist_style_tags"] or [],
        },
        "coverUrl": row["album_cover_url"],
        "releaseDate": _iso(row["album_release_date"]),
        "albumType": row["album_type"],
        "genreTags": row["album_genre_tags"] or [],
        "trackCount": int(row["album_track_count"] or 0),
    }
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


def _serialize_playlist(row: Any, tracks: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "coverUrl": row["cover_url"],
        "ownerId": row["owner_id"],
        "isPublic": bool(row["is_public"]),
        "isAiCurated": bool(row["is_ai_curated"]),
        "tracks": tracks,
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }


async def _fetch_playlist_tracks(db: AsyncSession, playlist_id: str) -> list[dict[str, Any]]:
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
  al.title AS album_title,
  al.cover_url AS album_cover_url,
  al.release_date AS album_release_date,
  al.album_type::text AS album_type,
  al.track_count AS album_track_count,
  aa.id::text AS album_artist_id,
  aa.name AS album_artist_name,
  aa.slug AS album_artist_slug,
  aa.bio AS album_artist_bio,
  aa.image_url AS album_artist_image_url,
  aa.monthly_listeners AS album_artist_monthly_listeners,
  aa.style_tags AS album_artist_style_tags,
  COALESCE((
    SELECT array_agg(g.name ORDER BY g.name)
    FROM album_genres ag
    JOIN genres g ON g.id = ag.genre_id
    WHERE ag.album_id = al.id
  ), ARRAY[]::text[]) AS album_genre_tags,
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
FROM playlist_tracks pt
JOIN tracks t ON t.id = pt.track_id
JOIN artists pa ON pa.id = t.primary_artist_id
JOIN albums al ON al.id = t.album_id
JOIN artists aa ON aa.id = al.artist_id
WHERE pt.playlist_id = :playlist_id
  AND t.status = 'published'
  AND al.status = 'published'
  AND pa.status = 'published'
  AND aa.status = 'published'
ORDER BY pt.position ASC, pt.added_at ASC
"""
            ),
            {"playlist_id": playlist_id},
        )
    ).mappings().all()
    return [_serialize_track(row) for row in rows]


@router.get("/", summary="List accessible playlists (paginated)")
async def list_playlists(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    rows = (
        await db.execute(
            text(
                """
SELECT DISTINCT
  p.id::text AS id,
  p.name,
  p.description,
  p.cover_url,
  p.owner_id::text AS owner_id,
  p.is_public,
  p.is_ai_curated,
  p.created_at,
  p.updated_at
FROM playlists p
LEFT JOIN user_followed_playlists ufp
  ON ufp.playlist_id = p.id
  AND ufp.user_id = :user_id
WHERE p.is_public = true
  OR p.owner_id = :user_id
  OR ufp.user_id IS NOT NULL
ORDER BY p.updated_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            {"user_id": user_id, "limit": limit, "offset": offset},
        )
    ).mappings().all()
    total = int(
        (
            await db.execute(
                text(
                    """
SELECT count(*)
FROM playlists p
LEFT JOIN user_followed_playlists ufp
  ON ufp.playlist_id = p.id
  AND ufp.user_id = :user_id
WHERE p.is_public = true
  OR p.owner_id = :user_id
  OR ufp.user_id IS NOT NULL
"""
                ),
                {"user_id": user_id},
            )
        ).scalar_one()
    )

    items: list[dict[str, Any]] = []
    for row in rows:
        tracks = await _fetch_playlist_tracks(db, row["id"])
        items.append(_serialize_playlist(row, tracks))
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/", summary="Create a playlist")
async def create_playlist() -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.get("/{playlist_id}", summary="Get playlist by ID")
async def get_playlist(
    playlist_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    row = (
        await db.execute(
            text(
                """
SELECT DISTINCT
  p.id::text AS id,
  p.name,
  p.description,
  p.cover_url,
  p.owner_id::text AS owner_id,
  p.is_public,
  p.is_ai_curated,
  p.created_at,
  p.updated_at
FROM playlists p
LEFT JOIN user_followed_playlists ufp
  ON ufp.playlist_id = p.id
  AND ufp.user_id = :user_id
WHERE p.id = :playlist_id
  AND (
    p.is_public = true
    OR p.owner_id = :user_id
    OR ufp.user_id IS NOT NULL
  )
LIMIT 1
"""
            ),
            {"playlist_id": playlist_id, "user_id": user_id},
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")

    tracks = await _fetch_playlist_tracks(db, playlist_id)
    return _serialize_playlist(row, tracks)


@router.patch("/{playlist_id}", summary="Update playlist metadata")
async def update_playlist(playlist_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.delete("/{playlist_id}", summary="Delete a playlist")
async def delete_playlist(playlist_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.post("/{playlist_id}/tracks", summary="Add tracks to playlist")
async def add_tracks(playlist_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.delete("/{playlist_id}/tracks", summary="Remove tracks from playlist")
async def remove_tracks(playlist_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.put("/{playlist_id}/tracks/reorder", summary="Reorder playlist tracks")
async def reorder_tracks(playlist_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")
