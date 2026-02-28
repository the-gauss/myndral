from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.db.session import get_db
from myndral_api.media_utils import normalize_audio_url

router = APIRouter()


@router.get("/", summary="List artists (paginated)")
async def list_artists(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    session = db
    rows = (
        await session.execute(
            text(
                """
SELECT
  a.id::text AS id,
  a.name,
  a.slug,
  a.bio,
  a.image_url,
  a.monthly_listeners,
  a.style_tags
FROM artists a
WHERE a.status = 'published'
ORDER BY a.monthly_listeners DESC, a.name ASC
LIMIT :limit OFFSET :offset
"""
            ),
            {"limit": limit, "offset": offset},
        )
    ).mappings().all()
    total = int(
        (
            await session.execute(
                text("SELECT count(*) FROM artists WHERE status = 'published'"),
            )
        ).scalar_one()
    )
    return {
        "items": [_serialize_artist(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{artist_id}", summary="Get artist by ID")
async def get_artist(artist_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    session = db
    row = (
        await session.execute(
            text(
                """
SELECT
  a.id::text AS id,
  a.name,
  a.slug,
  a.bio,
  a.image_url,
  a.monthly_listeners,
  a.style_tags
FROM artists a
WHERE a.id = :artist_id
  AND a.status = 'published'
LIMIT 1
"""
            ),
            {"artist_id": artist_id},
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    return _serialize_artist(row)


@router.get("/{artist_id}/albums", summary="Get artist's albums")
async def get_artist_albums(
    artist_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    session = db
    artist = await _fetch_artist(session, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")

    rows = (
        await session.execute(
            text(
                """
SELECT
  al.id::text AS id,
  al.title,
  al.artist_id::text AS artist_id,
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
WHERE al.artist_id = :artist_id
  AND al.status = 'published'
ORDER BY al.release_date DESC NULLS LAST, al.created_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            {"artist_id": artist_id, "limit": limit, "offset": offset},
        )
    ).mappings().all()
    total = int(
        (
            await session.execute(
                text(
                    """
SELECT count(*)
FROM albums
WHERE artist_id = :artist_id
  AND status = 'published'
"""
                ),
                {"artist_id": artist_id},
            )
        ).scalar_one()
    )
    return {
        "items": [_serialize_album(row, artist) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{artist_id}/top-tracks", summary="Get artist's top tracks")
async def get_artist_top_tracks(
    artist_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    session = db
    artist = await _fetch_artist(session, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")

    rows = (
        await session.execute(
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
  al.title AS album_title,
  al.cover_url AS album_cover_url,
  COALESCE(al.release_date::text, CURRENT_DATE::text) AS album_release_date,
  al.album_type::text AS album_type,
  al.track_count AS album_track_count,
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
FROM tracks t
JOIN albums al ON al.id = t.album_id
WHERE t.primary_artist_id = :artist_id
  AND t.status = 'published'
  AND al.status = 'published'
ORDER BY t.play_count DESC, t.created_at DESC
LIMIT :limit
"""
            ),
            {"artist_id": artist_id, "limit": limit},
        )
    ).mappings().all()
    items = [_serialize_track(row, artist) for row in rows]
    return {
        "items": items,
        "total": len(items),
        "limit": limit,
        "offset": 0,
    }


@router.put("/{artist_id}/follow", summary="Follow an artist")
async def follow_artist(artist_id: str) -> dict:
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{artist_id}/follow", summary="Unfollow an artist")
async def unfollow_artist(artist_id: str) -> dict:
    raise HTTPException(status_code=501, detail="Not implemented")


async def _fetch_artist(db: AsyncSession, artist_id: str) -> dict[str, Any] | None:
    row = (
        await db.execute(
            text(
                """
SELECT
  a.id::text AS id,
  a.name,
  a.slug,
  a.bio,
  a.image_url,
  a.monthly_listeners,
  a.style_tags
FROM artists a
WHERE a.id = :artist_id
  AND a.status = 'published'
LIMIT 1
"""
            ),
            {"artist_id": artist_id},
        )
    ).mappings().first()
    return _serialize_artist(row) if row else None


def _serialize_artist(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "bio": row["bio"],
        "imageUrl": row["image_url"],
        "monthlyListeners": int(row["monthly_listeners"] or 0),
        "verified": True,
        "styleTags": row["style_tags"] or [],
    }


def _serialize_album(row: Any, artist: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "artistId": row["artist_id"],
        "artist": artist,
        "coverUrl": row["cover_url"],
        "releaseDate": row["release_date"],
        "albumType": row["album_type"],
        "genreTags": row["genre_tags"] or [],
        "trackCount": int(row["track_count"] or 0),
    }


def _serialize_track(row: Any, artist: dict[str, Any]) -> dict[str, Any]:
    track_id = row["id"]
    album = {
        "id": row["album_id"],
        "title": row["album_title"],
        "artistId": row["artist_id"],
        "artist": artist,
        "coverUrl": row["album_cover_url"],
        "releaseDate": row["album_release_date"],
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
