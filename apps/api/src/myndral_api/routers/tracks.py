from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.db.session import get_db
from myndral_api.media_utils import normalize_audio_url

router = APIRouter()


def _serialize_artist(row: Any) -> dict[str, Any]:
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
        "releaseDate": row["album_release_date"],
        "albumType": row["album_type"],
        "genreTags": row["album_genre_tags"] or [],
        "trackCount": int(row["album_track_count"] or 0),
    }


def _serialize_track(row: Any) -> dict[str, Any]:
    track_id = row["id"]
    return {
        "id": track_id,
        "title": row["title"],
        "albumId": row["album_id"],
        "album": _serialize_album(row),
        "artistId": row["artist_id"],
        "artist": _serialize_artist(row),
        "trackNumber": int(row["track_number"] or 1),
        "durationMs": int(row["duration_ms"] or 0),
        "audioUrl": normalize_audio_url(track_id, row["audio_url"]),
        "playCount": int(row["play_count"] or 0),
        "explicit": bool(row["explicit"]),
    }


TRACK_SELECT_BASE = """
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
  COALESCE(al.release_date::text, CURRENT_DATE::text) AS album_release_date,
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
FROM tracks t
JOIN artists pa ON pa.id = t.primary_artist_id
JOIN albums al ON al.id = t.album_id
JOIN artists aa ON aa.id = al.artist_id
WHERE t.status = 'published'
  AND al.status = 'published'
  AND pa.status = 'published'
  AND aa.status = 'published'
"""


@router.get("/", summary="List tracks (paginated)")
async def list_tracks(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = (
        await db.execute(
            text(
                TRACK_SELECT_BASE
                + """
ORDER BY t.play_count DESC, t.created_at DESC
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
FROM tracks t
JOIN artists pa ON pa.id = t.primary_artist_id
JOIN albums al ON al.id = t.album_id
JOIN artists aa ON aa.id = al.artist_id
WHERE t.status = 'published'
  AND al.status = 'published'
  AND pa.status = 'published'
  AND aa.status = 'published'
"""
                )
            )
        ).scalar_one()
    )
    return {
        "items": [_serialize_track(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/featured", summary="Get featured tracks")
async def featured_tracks(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = (
        await db.execute(
            text(
                TRACK_SELECT_BASE
                + """
ORDER BY t.play_count DESC, t.created_at DESC
LIMIT :limit
"""
            ),
            {"limit": limit},
        )
    ).mappings().all()
    items = [_serialize_track(row) for row in rows]
    return {"items": items, "total": len(items), "limit": limit, "offset": 0}


@router.get("/{track_id}", summary="Get track by ID")
async def get_track(track_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    row = (
        await db.execute(
            text(TRACK_SELECT_BASE + "\nAND t.id = :track_id\nLIMIT 1\n"),
            {"track_id": track_id},
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found")
    return _serialize_track(row)


@router.get("/{track_id}/lyrics", summary="Get track lyrics")
async def get_lyrics(track_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    row = (
        await db.execute(
            text(
                """
SELECT
  l.track_id::text AS track_id,
  l.content,
  l.language
FROM lyrics l
JOIN tracks t ON t.id = l.track_id
WHERE l.track_id = :track_id
  AND t.status = 'published'
LIMIT 1
"""
            ),
            {"track_id": track_id},
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Lyrics not found")
    return {"trackId": row["track_id"], "content": row["content"], "language": row["language"]}


@router.put("/{track_id}/like", summary="Like a track")
async def like_track(track_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.delete("/{track_id}/like", summary="Unlike a track")
async def unlike_track(track_id: str) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")


@router.post("/{track_id}/play", summary="Record a play event")
async def record_play(track_id: str) -> dict:
    # TODO: write to play_history, increment play_count
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Not implemented")
