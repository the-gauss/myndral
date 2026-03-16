from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db
from myndral_api.routers import albums as albums_router
from myndral_api.routers import artists as artists_router
from myndral_api.routers import tracks as tracks_router
from myndral_api.routers.playlists import _fetch_playlist_tracks, _serialize_playlist

router = APIRouter()


ALBUM_SELECT_BASE = """
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
"""


ARTIST_SELECT_BASE = """
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
"""


def _is_admin(current_user: dict[str, Any]) -> bool:
    return current_user.get("role") == "admin"


def _dedupe_ids(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        candidate = value.strip()
        if not candidate or candidate in seen:
            continue
        deduped.append(candidate)
        seen.add(candidate)
    return deduped


async def _fetch_matching_ids(
    db: AsyncSession,
    query: str,
    *,
    user_id: str,
    ids: list[str],
) -> list[str]:
    if not ids:
        return []
    stmt = text(query).bindparams(bindparam("ids", expanding=True))
    rows = (await db.execute(stmt, {"user_id": user_id, "ids": ids})).scalars().all()
    return [str(row) for row in rows]


async def _ensure_track_available(db: AsyncSession, track_id: str) -> None:
    row = (
        await db.execute(
            text(
                """
SELECT 1
FROM tracks t
JOIN albums al ON al.id = t.album_id
JOIN artists pa ON pa.id = t.primary_artist_id
JOIN artists aa ON aa.id = al.artist_id
WHERE t.id = :track_id
  AND t.status = 'published'
  AND al.status = 'published'
  AND pa.status = 'published'
  AND aa.status = 'published'
LIMIT 1
"""
            ),
            {"track_id": track_id},
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found")


async def _ensure_album_available(db: AsyncSession, album_id: str) -> None:
    row = (
        await db.execute(
            text(
                """
SELECT 1
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
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found")


async def _ensure_artist_available(db: AsyncSession, artist_id: str) -> None:
    row = (
        await db.execute(
            text(
                """
SELECT 1
FROM artists a
WHERE a.id = :artist_id
  AND a.status = 'published'
LIMIT 1
"""
            ),
            {"artist_id": artist_id},
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found")


async def _ensure_playlist_accessible(
    db: AsyncSession,
    playlist_id: str,
    current_user: dict[str, Any],
) -> Any:
    row = (
        await db.execute(
            text(
                """
SELECT
  p.id::text AS id,
  p.owner_id::text AS owner_id,
  p.is_public
FROM playlists p
WHERE p.id = :playlist_id
  AND (
    p.is_public = true
    OR p.owner_id = :user_id
    OR :is_admin = true
    OR EXISTS (
      SELECT 1
      FROM playlist_collaborators pc
      WHERE pc.playlist_id = p.id
        AND pc.user_id = :user_id
        AND pc.accepted_at IS NOT NULL
    )
  )
LIMIT 1
"""
            ),
            {
                "playlist_id": playlist_id,
                "user_id": current_user["id"],
                "is_admin": _is_admin(current_user),
            },
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return row


async def _list_library_playlists(
    *,
    limit: int,
    offset: int,
    editable_only: bool,
    current_user: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    user_id = current_user["id"]
    params = {
        "user_id": user_id,
        "is_admin": _is_admin(current_user),
        "limit": limit,
        "offset": offset,
    }
    if editable_only:
        where_clause = """
(
  p.owner_id = :user_id
  OR :is_admin = true
  OR EXISTS (
    SELECT 1
    FROM playlist_collaborators pce
    WHERE pce.playlist_id = p.id
      AND pce.user_id = :user_id
      AND pce.accepted_at IS NOT NULL
      AND pce.role = 'editor'
  )
)
"""
    else:
        where_clause = """
(
  p.owner_id = :user_id
  OR EXISTS (
    SELECT 1
    FROM user_followed_playlists ufp
    WHERE ufp.playlist_id = p.id
      AND ufp.user_id = :user_id
  )
  OR EXISTS (
    SELECT 1
    FROM playlist_collaborators pc
    WHERE pc.playlist_id = p.id
      AND pc.user_id = :user_id
      AND pc.accepted_at IS NOT NULL
  )
)
"""

    rows = (
        await db.execute(
            text(
                f"""
SELECT DISTINCT
  p.id::text AS id,
  p.name,
  p.description,
  p.cover_url,
  p.owner_id::text AS owner_id,
  p.is_public,
  p.is_ai_curated,
  p.track_count,
  p.follower_count,
  p.total_duration_ms,
  p.created_at,
  p.updated_at,
  owner.display_name AS owner_display_name,
  (
    p.owner_id = :user_id
    OR :is_admin = true
    OR EXISTS (
      SELECT 1
      FROM playlist_collaborators pce
      WHERE pce.playlist_id = p.id
        AND pce.user_id = :user_id
        AND pce.accepted_at IS NOT NULL
        AND pce.role = 'editor'
    )
  ) AS can_edit,
  true AS is_in_library
FROM playlists p
JOIN users owner ON owner.id = p.owner_id
WHERE {where_clause}
ORDER BY p.updated_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            params,
        )
    ).mappings().all()
    total = int(
        (
            await db.execute(
                text(f"SELECT count(*) FROM playlists p WHERE {where_clause}"),
                {"user_id": user_id, "is_admin": _is_admin(current_user)},
            )
        ).scalar_one()
    )

    items: list[dict[str, Any]] = []
    for row in rows:
        tracks = await _fetch_playlist_tracks(db, row["id"])
        items.append(_serialize_playlist(row, tracks))
    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def _list_tracks_for_relation(
    *,
    db: AsyncSession,
    table_name: str,
    timestamp_column: str,
    user_id: str,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    rows = (
        await db.execute(
            text(
                tracks_router.TRACK_SELECT_BASE
                + f"""
AND EXISTS (
  SELECT 1
  FROM {table_name} rel
  WHERE rel.user_id = :user_id
    AND rel.track_id = t.id
)
ORDER BY (
  SELECT max(rel.{timestamp_column})
  FROM {table_name} rel
  WHERE rel.user_id = :user_id
    AND rel.track_id = t.id
) DESC NULLS LAST, t.created_at DESC
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
                    f"""
SELECT count(*)
FROM tracks t
JOIN artists pa ON pa.id = t.primary_artist_id
JOIN albums al ON al.id = t.album_id
JOIN artists aa ON aa.id = al.artist_id
WHERE t.status = 'published'
  AND al.status = 'published'
  AND pa.status = 'published'
  AND aa.status = 'published'
  AND EXISTS (
    SELECT 1
    FROM {table_name} rel
    WHERE rel.user_id = :user_id
      AND rel.track_id = t.id
  )
"""
                ),
                {"user_id": user_id},
            )
        ).scalar_one()
    )
    return {
        "items": [tracks_router._serialize_track(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def _list_albums_for_relation(
    *,
    db: AsyncSession,
    table_name: str,
    timestamp_column: str,
    user_id: str,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    rows = (
        await db.execute(
            text(
                ALBUM_SELECT_BASE
                + f"""
  AND EXISTS (
    SELECT 1
    FROM {table_name} rel
    WHERE rel.user_id = :user_id
      AND rel.album_id = al.id
  )
ORDER BY (
  SELECT max(rel.{timestamp_column})
  FROM {table_name} rel
  WHERE rel.user_id = :user_id
    AND rel.album_id = al.id
) DESC NULLS LAST, al.created_at DESC
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
                    f"""
SELECT count(*)
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
WHERE al.status = 'published'
  AND ar.status = 'published'
  AND EXISTS (
    SELECT 1
    FROM {table_name} rel
    WHERE rel.user_id = :user_id
      AND rel.album_id = al.id
  )
"""
                ),
                {"user_id": user_id},
            )
        ).scalar_one()
    )
    return {
        "items": [albums_router._serialize_album(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def _list_artists_for_relation(
    *,
    db: AsyncSession,
    table_name: str,
    timestamp_column: str,
    user_id: str,
    limit: int,
    offset: int,
) -> dict[str, Any]:
    rows = (
        await db.execute(
            text(
                ARTIST_SELECT_BASE
                + f"""
  AND EXISTS (
    SELECT 1
    FROM {table_name} rel
    WHERE rel.user_id = :user_id
      AND rel.artist_id = a.id
  )
ORDER BY (
  SELECT max(rel.{timestamp_column})
  FROM {table_name} rel
  WHERE rel.user_id = :user_id
    AND rel.artist_id = a.id
) DESC NULLS LAST, a.created_at DESC
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
                    f"""
SELECT count(*)
FROM artists a
WHERE a.status = 'published'
  AND EXISTS (
    SELECT 1
    FROM {table_name} rel
    WHERE rel.user_id = :user_id
      AND rel.artist_id = a.id
  )
"""
                ),
                {"user_id": user_id},
            )
        ).scalar_one()
    )
    return {
        "items": [artists_router._serialize_artist(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/me", summary="Get current user profile")
async def get_me(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


@router.patch("/me", summary="Update current user profile")
async def update_me() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )


@router.get("/me/collection-state", summary="Get library and favorite state for visible entities")
async def get_collection_state(
    track_ids: list[str] = Query(default_factory=list, alias="trackIds"),
    album_ids: list[str] = Query(default_factory=list, alias="albumIds"),
    artist_ids: list[str] = Query(default_factory=list, alias="artistIds"),
    playlist_ids: list[str] = Query(default_factory=list, alias="playlistIds"),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    user_id = current_user["id"]
    normalized_track_ids = _dedupe_ids(track_ids)
    normalized_album_ids = _dedupe_ids(album_ids)
    normalized_artist_ids = _dedupe_ids(artist_ids)
    normalized_playlist_ids = _dedupe_ids(playlist_ids)

    library_track_ids = await _fetch_matching_ids(
        db,
        """
SELECT track_id::text
FROM user_saved_tracks
WHERE user_id = :user_id
  AND track_id::text IN :ids
""",
        user_id=user_id,
        ids=normalized_track_ids,
    )
    favorite_track_ids = await _fetch_matching_ids(
        db,
        """
SELECT track_id::text
FROM user_liked_tracks
WHERE user_id = :user_id
  AND track_id::text IN :ids
""",
        user_id=user_id,
        ids=normalized_track_ids,
    )
    library_album_ids = await _fetch_matching_ids(
        db,
        """
SELECT album_id::text
FROM user_saved_albums
WHERE user_id = :user_id
  AND album_id::text IN :ids
""",
        user_id=user_id,
        ids=normalized_album_ids,
    )
    favorite_album_ids = await _fetch_matching_ids(
        db,
        """
SELECT album_id::text
FROM user_liked_albums
WHERE user_id = :user_id
  AND album_id::text IN :ids
""",
        user_id=user_id,
        ids=normalized_album_ids,
    )
    library_artist_ids = await _fetch_matching_ids(
        db,
        """
SELECT artist_id::text
FROM user_followed_artists
WHERE user_id = :user_id
  AND artist_id::text IN :ids
""",
        user_id=user_id,
        ids=normalized_artist_ids,
    )
    favorite_artist_ids = await _fetch_matching_ids(
        db,
        """
SELECT artist_id::text
FROM user_liked_artists
WHERE user_id = :user_id
  AND artist_id::text IN :ids
""",
        user_id=user_id,
        ids=normalized_artist_ids,
    )
    library_playlist_ids = await _fetch_matching_ids(
        db,
        """
SELECT p.id::text
FROM playlists p
WHERE p.id::text IN :ids
  AND (
    p.owner_id = :user_id
    OR EXISTS (
      SELECT 1
      FROM user_followed_playlists ufp
      WHERE ufp.playlist_id = p.id
        AND ufp.user_id = :user_id
    )
    OR EXISTS (
      SELECT 1
      FROM playlist_collaborators pc
      WHERE pc.playlist_id = p.id
        AND pc.user_id = :user_id
        AND pc.accepted_at IS NOT NULL
    )
  )
""",
        user_id=user_id,
        ids=normalized_playlist_ids,
    )

    return {
        "library": {
            "trackIds": library_track_ids,
            "albumIds": library_album_ids,
            "artistIds": library_artist_ids,
            "playlistIds": library_playlist_ids,
        },
        "favorites": {
            "trackIds": favorite_track_ids,
            "albumIds": favorite_album_ids,
            "artistIds": favorite_artist_ids,
        },
    }


@router.get("/me/library/tracks", summary="Get tracks saved to the current user's library")
async def get_library_tracks(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_tracks_for_relation(
        db=db,
        table_name="user_saved_tracks",
        timestamp_column="saved_at",
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )


@router.put("/me/library/tracks/{track_id}", summary="Save a track to the current user's library")
async def save_track_to_library(
    track_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _ensure_track_available(db, track_id)
    await db.execute(
        text(
            """
INSERT INTO user_saved_tracks (user_id, track_id)
VALUES (:user_id, :track_id)
ON CONFLICT (user_id, track_id) DO NOTHING
"""
        ),
        {"user_id": current_user["id"], "track_id": track_id},
    )
    return {"trackId": track_id, "inLibrary": True}


@router.delete("/me/library/tracks/{track_id}", summary="Remove a track from the current user's library")
async def remove_track_from_library(
    track_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("DELETE FROM user_saved_tracks WHERE user_id = :user_id AND track_id = :track_id"),
        {"user_id": current_user["id"], "track_id": track_id},
    )
    return {"trackId": track_id, "inLibrary": False}


@router.get("/me/library/albums", summary="Get albums saved to the current user's library")
async def get_library_albums(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_albums_for_relation(
        db=db,
        table_name="user_saved_albums",
        timestamp_column="saved_at",
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )


@router.put("/me/library/albums/{album_id}", summary="Save an album to the current user's library")
async def save_album_to_library(
    album_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _ensure_album_available(db, album_id)
    await db.execute(
        text(
            """
INSERT INTO user_saved_albums (user_id, album_id)
VALUES (:user_id, :album_id)
ON CONFLICT (user_id, album_id) DO NOTHING
"""
        ),
        {"user_id": current_user["id"], "album_id": album_id},
    )
    return {"albumId": album_id, "inLibrary": True}


@router.delete("/me/library/albums/{album_id}", summary="Remove an album from the current user's library")
async def remove_album_from_library(
    album_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("DELETE FROM user_saved_albums WHERE user_id = :user_id AND album_id = :album_id"),
        {"user_id": current_user["id"], "album_id": album_id},
    )
    return {"albumId": album_id, "inLibrary": False}


@router.get("/me/library/artists", summary="Get artists saved to the current user's library")
async def get_library_artists(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_artists_for_relation(
        db=db,
        table_name="user_followed_artists",
        timestamp_column="followed_at",
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )


@router.put("/me/library/artists/{artist_id}", summary="Save an artist to the current user's library")
async def save_artist_to_library(
    artist_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _ensure_artist_available(db, artist_id)
    await db.execute(
        text(
            """
INSERT INTO user_followed_artists (user_id, artist_id)
VALUES (:user_id, :artist_id)
ON CONFLICT (user_id, artist_id) DO NOTHING
"""
        ),
        {"user_id": current_user["id"], "artist_id": artist_id},
    )
    return {"artistId": artist_id, "inLibrary": True}


@router.delete("/me/library/artists/{artist_id}", summary="Remove an artist from the current user's library")
async def remove_artist_from_library(
    artist_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("DELETE FROM user_followed_artists WHERE user_id = :user_id AND artist_id = :artist_id"),
        {"user_id": current_user["id"], "artist_id": artist_id},
    )
    return {"artistId": artist_id, "inLibrary": False}


@router.get("/me/library/playlists", summary="Get playlists saved to the current user's library")
async def get_library_playlists(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_library_playlists(
        limit=limit,
        offset=offset,
        editable_only=False,
        current_user=current_user,
        db=db,
    )


@router.put("/me/library/playlists/{playlist_id}", summary="Save a playlist to the current user's library")
async def save_playlist_to_library(
    playlist_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    playlist = await _ensure_playlist_accessible(db, playlist_id, current_user)
    if playlist["owner_id"] == current_user["id"]:
        return {"playlistId": playlist_id, "inLibrary": True, "owned": True}
    await db.execute(
        text(
            """
INSERT INTO user_followed_playlists (user_id, playlist_id)
VALUES (:user_id, :playlist_id)
ON CONFLICT (user_id, playlist_id) DO NOTHING
"""
        ),
        {"user_id": current_user["id"], "playlist_id": playlist_id},
    )
    await db.execute(
        text(
            """
UPDATE playlists
SET follower_count = (
  SELECT count(*)
  FROM user_followed_playlists
  WHERE playlist_id = :playlist_id
)
WHERE id = :playlist_id
"""
        ),
        {"playlist_id": playlist_id},
    )
    return {"playlistId": playlist_id, "inLibrary": True}


@router.delete("/me/library/playlists/{playlist_id}", summary="Remove a playlist from the current user's library")
async def remove_playlist_from_library(
    playlist_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    playlist = await _ensure_playlist_accessible(db, playlist_id, current_user)
    if playlist["owner_id"] == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owned playlists always stay in your library.",
        )
    await db.execute(
        text("DELETE FROM user_followed_playlists WHERE user_id = :user_id AND playlist_id = :playlist_id"),
        {"user_id": current_user["id"], "playlist_id": playlist_id},
    )
    await db.execute(
        text(
            """
UPDATE playlists
SET follower_count = (
  SELECT count(*)
  FROM user_followed_playlists
  WHERE playlist_id = :playlist_id
)
WHERE id = :playlist_id
"""
        ),
        {"playlist_id": playlist_id},
    )
    return {"playlistId": playlist_id, "inLibrary": False}


@router.get("/me/favorites/tracks", summary="Get the current user's favorite tracks")
async def get_favorite_tracks(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_tracks_for_relation(
        db=db,
        table_name="user_liked_tracks",
        timestamp_column="liked_at",
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )


@router.put("/me/favorites/tracks/{track_id}", summary="Favorite a track")
async def favorite_track(
    track_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _ensure_track_available(db, track_id)
    await db.execute(
        text(
            """
INSERT INTO user_liked_tracks (user_id, track_id)
VALUES (:user_id, :track_id)
ON CONFLICT (user_id, track_id) DO NOTHING
"""
        ),
        {"user_id": current_user["id"], "track_id": track_id},
    )
    return {"trackId": track_id, "isFavorite": True}


@router.delete("/me/favorites/tracks/{track_id}", summary="Unfavorite a track")
async def unfavorite_track(
    track_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("DELETE FROM user_liked_tracks WHERE user_id = :user_id AND track_id = :track_id"),
        {"user_id": current_user["id"], "track_id": track_id},
    )
    return {"trackId": track_id, "isFavorite": False}


@router.get("/me/favorites/albums", summary="Get the current user's favorite albums")
async def get_favorite_albums(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_albums_for_relation(
        db=db,
        table_name="user_liked_albums",
        timestamp_column="liked_at",
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )


@router.put("/me/favorites/albums/{album_id}", summary="Favorite an album")
async def favorite_album(
    album_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _ensure_album_available(db, album_id)
    await db.execute(
        text(
            """
INSERT INTO user_liked_albums (user_id, album_id)
VALUES (:user_id, :album_id)
ON CONFLICT (user_id, album_id) DO NOTHING
"""
        ),
        {"user_id": current_user["id"], "album_id": album_id},
    )
    return {"albumId": album_id, "isFavorite": True}


@router.delete("/me/favorites/albums/{album_id}", summary="Unfavorite an album")
async def unfavorite_album(
    album_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("DELETE FROM user_liked_albums WHERE user_id = :user_id AND album_id = :album_id"),
        {"user_id": current_user["id"], "album_id": album_id},
    )
    return {"albumId": album_id, "isFavorite": False}


@router.get("/me/favorites/artists", summary="Get the current user's favorite artists")
async def get_favorite_artists(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_artists_for_relation(
        db=db,
        table_name="user_liked_artists",
        timestamp_column="liked_at",
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
    )


@router.put("/me/favorites/artists/{artist_id}", summary="Favorite an artist")
async def favorite_artist(
    artist_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _ensure_artist_available(db, artist_id)
    await db.execute(
        text(
            """
INSERT INTO user_liked_artists (user_id, artist_id)
VALUES (:user_id, :artist_id)
ON CONFLICT (user_id, artist_id) DO NOTHING
"""
        ),
        {"user_id": current_user["id"], "artist_id": artist_id},
    )
    return {"artistId": artist_id, "isFavorite": True}


@router.delete("/me/favorites/artists/{artist_id}", summary="Unfavorite an artist")
async def unfavorite_artist(
    artist_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await db.execute(
        text("DELETE FROM user_liked_artists WHERE user_id = :user_id AND artist_id = :artist_id"),
        {"user_id": current_user["id"], "artist_id": artist_id},
    )
    return {"artistId": artist_id, "isFavorite": False}


@router.get("/me/tracks", summary="Get current user's liked tracks")
async def get_liked_tracks(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await get_favorite_tracks(limit=limit, offset=offset, current_user=current_user, db=db)


@router.get("/me/albums", summary="Get current user's saved albums")
async def get_saved_albums(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await get_library_albums(limit=limit, offset=offset, current_user=current_user, db=db)


@router.get("/me/artists", summary="Get artists followed by current user")
async def get_followed_artists(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await get_library_artists(limit=limit, offset=offset, current_user=current_user, db=db)


@router.get("/me/playlists", summary="Get current user's playlists")
async def get_my_playlists(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    editable_only: bool = Query(False, alias="editableOnly"),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _list_library_playlists(
        limit=limit,
        offset=offset,
        editable_only=editable_only,
        current_user=current_user,
        db=db,
    )


@router.get("/me/history", summary="Get listening history")
async def get_history() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )
