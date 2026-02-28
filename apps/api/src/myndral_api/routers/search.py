from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.db.session import get_db

router = APIRouter()


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _empty_page(limit: int, offset: int) -> dict[str, Any]:
    return {"items": [], "total": 0, "limit": limit, "offset": offset}


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


def _serialize_album(row: Any) -> dict[str, Any]:
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
    return {
        "id": row["id"],
        "title": row["title"],
        "artistId": row["artist_id"],
        "artist": artist,
        "coverUrl": row["cover_url"],
        "releaseDate": _iso(row["release_date"]),
        "albumType": row["album_type"],
        "genreTags": row["genre_tags"] or [],
        "trackCount": int(row["track_count"] or 0),
    }


def _serialize_track(row: Any) -> dict[str, Any]:
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
        "id": row["id"],
        "title": row["title"],
        "albumId": row["album_id"],
        "album": album,
        "artistId": row["artist_id"],
        "artist": artist,
        "trackNumber": int(row["track_number"] or 1),
        "durationMs": int(row["duration_ms"] or 0),
        "audioUrl": row["audio_url"],
        "playCount": int(row["play_count"] or 0),
        "explicit": bool(row["explicit"]),
    }


def _serialize_playlist(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "coverUrl": row["cover_url"],
        "ownerId": row["owner_id"],
        "isPublic": bool(row["is_public"]),
        "isAiCurated": bool(row["is_ai_curated"]),
        "tracks": [],
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }


def _normalize_types(raw_types: str) -> set[str]:
    aliases = {
        "track": "track",
        "tracks": "track",
        "song": "track",
        "songs": "track",
        "album": "album",
        "albums": "album",
        "artist": "artist",
        "artists": "artist",
        "playlist": "playlist",
        "playlists": "playlist",
    }
    resolved: set[str] = set()
    for value in raw_types.split(","):
        key = value.strip().lower()
        if key in aliases:
            resolved.add(aliases[key])
    if not resolved:
        return {"track", "album", "artist", "playlist"}
    return resolved


@router.get("/", summary="Search across artists, albums, tracks, and playlists")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    requested_types: str = Query(
        "track,album,artist,playlist",
        alias="type",
        description="Comma-separated result types",
    ),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    query = q.strip()
    if not query:
        empty = _empty_page(limit, offset)
        return {"tracks": empty, "albums": empty, "artists": empty, "playlists": empty}

    include = _normalize_types(requested_types)
    sql_params = {
        "q": query,
        "q_prefix": f"{query}%",
        "pattern": f"%{query}%",
        "limit": limit,
        "offset": offset,
    }

    artists = await _search_artists(db, sql_params, include, limit, offset)
    albums = await _search_albums(db, sql_params, include, limit, offset)
    tracks = await _search_tracks(db, sql_params, include, limit, offset)
    playlists = await _search_playlists(db, sql_params, include, limit, offset)

    return {
        "tracks": tracks,
        "albums": albums,
        "artists": artists,
        "playlists": playlists,
    }


async def _search_artists(
    db: AsyncSession,
    params: dict[str, Any],
    include: set[str],
    limit: int,
    offset: int,
) -> dict[str, Any]:
    if "artist" not in include:
        return _empty_page(limit, offset)

    filter_sql = """
WHERE a.status = 'published'
  AND (
    lower(a.name) LIKE lower(:pattern)
    OR lower(COALESCE(a.bio, '')) LIKE lower(:pattern)
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(a.style_tags, ARRAY[]::text[])) AS style_tag
      WHERE lower(style_tag) LIKE lower(:pattern)
    )
  )
"""
    rows = (
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
"""
                + filter_sql
                + """
ORDER BY
  CASE
    WHEN lower(a.name) = lower(:q) THEN 0
    WHEN lower(a.name) LIKE lower(:q_prefix) THEN 1
    ELSE 2
  END,
  a.monthly_listeners DESC,
  a.name ASC
LIMIT :limit OFFSET :offset
"""
            ),
            params,
        )
    ).mappings().all()
    total = int((await db.execute(text("SELECT count(*) FROM artists a " + filter_sql), params)).scalar_one())
    return {"items": [_serialize_artist(row) for row in rows], "total": total, "limit": limit, "offset": offset}


async def _search_albums(
    db: AsyncSession,
    params: dict[str, Any],
    include: set[str],
    limit: int,
    offset: int,
) -> dict[str, Any]:
    if "album" not in include:
        return _empty_page(limit, offset)

    filter_sql = """
WHERE al.status = 'published'
  AND ar.status = 'published'
  AND (
    lower(al.title) LIKE lower(:pattern)
    OR lower(ar.name) LIKE lower(:pattern)
    OR lower(COALESCE(al.description, '')) LIKE lower(:pattern)
  )
"""
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
  al.release_date,
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
"""
                + filter_sql
                + """
ORDER BY
  CASE
    WHEN lower(al.title) = lower(:q) THEN 0
    WHEN lower(al.title) LIKE lower(:q_prefix) THEN 1
    ELSE 2
  END,
  al.release_date DESC NULLS LAST,
  al.created_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            params,
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
"""
                    + filter_sql
                ),
                params,
            )
        ).scalar_one()
    )
    return {"items": [_serialize_album(row) for row in rows], "total": total, "limit": limit, "offset": offset}


async def _search_tracks(
    db: AsyncSession,
    params: dict[str, Any],
    include: set[str],
    limit: int,
    offset: int,
) -> dict[str, Any]:
    if "track" not in include:
        return _empty_page(limit, offset)

    filter_sql = """
WHERE t.status = 'published'
  AND al.status = 'published'
  AND pa.status = 'published'
  AND aa.status = 'published'
  AND (
    lower(t.title) LIKE lower(:pattern)
    OR lower(pa.name) LIKE lower(:pattern)
    OR lower(al.title) LIKE lower(:pattern)
  )
"""
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
FROM tracks t
JOIN artists pa ON pa.id = t.primary_artist_id
JOIN albums al ON al.id = t.album_id
JOIN artists aa ON aa.id = al.artist_id
"""
                + filter_sql
                + """
ORDER BY
  CASE
    WHEN lower(t.title) = lower(:q) THEN 0
    WHEN lower(t.title) LIKE lower(:q_prefix) THEN 1
    ELSE 2
  END,
  t.play_count DESC,
  t.created_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            params,
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
"""
                    + filter_sql
                ),
                params,
            )
        ).scalar_one()
    )
    return {"items": [_serialize_track(row) for row in rows], "total": total, "limit": limit, "offset": offset}


async def _search_playlists(
    db: AsyncSession,
    params: dict[str, Any],
    include: set[str],
    limit: int,
    offset: int,
) -> dict[str, Any]:
    if "playlist" not in include:
        return _empty_page(limit, offset)

    filter_sql = """
WHERE p.is_public = true
  AND (
    lower(p.name) LIKE lower(:pattern)
    OR lower(COALESCE(p.description, '')) LIKE lower(:pattern)
  )
"""
    rows = (
        await db.execute(
            text(
                """
SELECT
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
"""
                + filter_sql
                + """
ORDER BY
  CASE
    WHEN lower(p.name) = lower(:q) THEN 0
    WHEN lower(p.name) LIKE lower(:q_prefix) THEN 1
    ELSE 2
  END,
  p.updated_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            params,
        )
    ).mappings().all()
    total = int((await db.execute(text("SELECT count(*) FROM playlists p " + filter_sql), params)).scalar_one())
    return {
        "items": [_serialize_playlist(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
