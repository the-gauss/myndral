from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db
from myndral_api.media_utils import normalize_audio_url, normalize_image_url

router = APIRouter()


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class PlaylistCreateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    cover_url: str | None = Field(default=None, alias="coverUrl")
    is_public: bool = Field(default=True, alias="isPublic")
    track_ids: list[str] = Field(default_factory=list, alias="trackIds")


class PlaylistUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    cover_url: str | None = Field(default=None, alias="coverUrl")
    is_public: bool | None = Field(default=None, alias="isPublic")


class PlaylistTrackMutationRequest(CamelModel):
    track_ids: list[str] = Field(default_factory=list, alias="trackIds")


class PlaylistReorderRequest(CamelModel):
    track_ids: list[str] = Field(default_factory=list, alias="trackIds")


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _row_value(row: Any, key: str, default: Any = None) -> Any:
    try:
        return row[key]
    except Exception:
        return default


def _serialize_track(row: Any) -> dict[str, Any]:
    track_id = row["id"]
    artist = {
        "id": row["artist_id"],
        "name": row["artist_name"],
        "slug": row["artist_slug"],
        "bio": row["artist_bio"],
        "imageUrl": normalize_image_url(row["artist_image_url"]),
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
            "imageUrl": normalize_image_url(row["album_artist_image_url"]),
            "monthlyListeners": int(row["album_artist_monthly_listeners"] or 0),
            "verified": True,
            "styleTags": row["album_artist_style_tags"] or [],
        },
        "coverUrl": normalize_image_url(row["album_cover_url"]),
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
    payload = {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "coverUrl": normalize_image_url(row["cover_url"]),
        "ownerId": row["owner_id"],
        "isPublic": bool(row["is_public"]),
        "isAiCurated": bool(row["is_ai_curated"]),
        "tracks": tracks,
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
        "trackCount": int(_row_value(row, "track_count", len(tracks)) or 0),
        "followerCount": int(_row_value(row, "follower_count", 0) or 0),
        "totalDurationMs": int(_row_value(row, "total_duration_ms", 0) or 0),
        "canEdit": bool(_row_value(row, "can_edit", False)),
        "isInLibrary": bool(_row_value(row, "is_in_library", False)),
    }
    owner_display_name = _row_value(row, "owner_display_name")
    if owner_display_name:
        payload["ownerDisplayName"] = owner_display_name
    return payload


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


def _is_admin(current_user: dict[str, Any]) -> bool:
    return current_user.get("role") == "admin"


def _playlist_access_where(include_public: bool = True, editable_only: bool = False) -> str:
    public_clause = "p.is_public = true OR " if include_public else ""
    if editable_only:
        return """
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
    return f"""
(
  {public_clause}p.owner_id = :user_id
  OR :is_admin = true
  OR EXISTS (
    SELECT 1
    FROM user_followed_playlists ufp2
    WHERE ufp2.playlist_id = p.id
      AND ufp2.user_id = :user_id
  )
  OR EXISTS (
    SELECT 1
    FROM playlist_collaborators pc2
    WHERE pc2.playlist_id = p.id
      AND pc2.user_id = :user_id
      AND pc2.accepted_at IS NOT NULL
  )
)
"""


async def _fetch_playlist_row(
    db: AsyncSession,
    playlist_id: str,
    current_user: dict[str, Any],
    *,
    include_public: bool = True,
) -> Any | None:
    user_id = current_user["id"]
    row = (
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
  (
    p.owner_id = :user_id
    OR EXISTS (
      SELECT 1
      FROM user_followed_playlists ufp3
      WHERE ufp3.playlist_id = p.id
        AND ufp3.user_id = :user_id
    )
    OR EXISTS (
      SELECT 1
      FROM playlist_collaborators pc3
      WHERE pc3.playlist_id = p.id
        AND pc3.user_id = :user_id
        AND pc3.accepted_at IS NOT NULL
    )
  ) AS is_in_library
FROM playlists p
JOIN users owner ON owner.id = p.owner_id
WHERE p.id = :playlist_id
  AND {_playlist_access_where(include_public=include_public)}
LIMIT 1
"""
            ),
            {"playlist_id": playlist_id, "user_id": user_id, "is_admin": _is_admin(current_user)},
        )
    ).mappings().first()
    return row


async def _require_playlist_row(
    db: AsyncSession,
    playlist_id: str,
    current_user: dict[str, Any],
    *,
    include_public: bool = True,
) -> Any:
    row = await _fetch_playlist_row(
        db,
        playlist_id,
        current_user,
        include_public=include_public,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return row


async def _require_playlist_editor(
    db: AsyncSession,
    playlist_id: str,
    current_user: dict[str, Any],
) -> Any:
    row = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
    if not bool(row["can_edit"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this playlist.",
        )
    return row


def _normalize_track_ids(track_ids: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for track_id in track_ids:
        candidate = track_id.strip()
        if not candidate:
            continue
        if candidate in seen:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Track lists cannot contain duplicates.",
            )
        seen.add(candidate)
        normalized.append(candidate)
    return normalized


async def _ensure_tracks_are_playable(db: AsyncSession, track_ids: list[str]) -> None:
    if not track_ids:
        return
    stmt = text(
        """
SELECT t.id::text AS id
FROM tracks t
JOIN albums al ON al.id = t.album_id
JOIN artists pa ON pa.id = t.primary_artist_id
JOIN artists aa ON aa.id = al.artist_id
WHERE t.id::text IN :track_ids
  AND t.status = 'published'
  AND al.status = 'published'
  AND pa.status = 'published'
  AND aa.status = 'published'
"""
    ).bindparams(bindparam("track_ids", expanding=True))
    rows = (await db.execute(stmt, {"track_ids": track_ids})).scalars().all()
    if len(rows) != len(track_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more tracks are unavailable for playlists.",
        )


async def _refresh_playlist_rollups(db: AsyncSession, playlist_id: str) -> None:
    await db.execute(
        text(
            """
UPDATE playlists p
SET
  track_count = stats.track_count,
  total_duration_ms = stats.total_duration_ms,
  snapshot_id = encode(gen_random_bytes(8), 'hex')
FROM (
  SELECT
    CAST(:playlist_id AS uuid) AS playlist_id,
    count(pt.track_id)::int AS track_count,
    COALESCE(sum(t.duration_ms), 0)::bigint AS total_duration_ms
  FROM playlist_tracks pt
  LEFT JOIN tracks t ON t.id = pt.track_id
  WHERE pt.playlist_id = :playlist_id
) AS stats
WHERE p.id = stats.playlist_id
"""
        ),
        {"playlist_id": playlist_id},
    )


async def _reset_playlist_positions(
    db: AsyncSession,
    playlist_id: str,
    ordered_track_ids: list[str],
) -> None:
    temporary_base = len(ordered_track_ids) + 1000
    for index, track_id in enumerate(ordered_track_ids):
        await db.execute(
            text(
                """
UPDATE playlist_tracks
SET position = :temporary_position
WHERE playlist_id = :playlist_id
  AND track_id = :track_id
"""
            ),
            {
                "playlist_id": playlist_id,
                "track_id": track_id,
                "temporary_position": temporary_base + index,
            },
        )
    for index, track_id in enumerate(ordered_track_ids):
        await db.execute(
            text(
                """
UPDATE playlist_tracks
SET position = :position
WHERE playlist_id = :playlist_id
  AND track_id = :track_id
"""
            ),
            {"playlist_id": playlist_id, "track_id": track_id, "position": index},
        )


async def _fetch_playlist_track_ids(db: AsyncSession, playlist_id: str) -> list[str]:
    rows = (
        await db.execute(
            text(
                """
SELECT track_id::text AS track_id
FROM playlist_tracks
WHERE playlist_id = :playlist_id
ORDER BY position ASC, added_at ASC
"""
            ),
            {"playlist_id": playlist_id},
        )
    ).mappings().all()
    return [row["track_id"] for row in rows]


async def _insert_playlist_tracks(
    db: AsyncSession,
    playlist_id: str,
    track_ids: list[str],
    added_by: str,
) -> None:
    if not track_ids:
        return
    existing = set(await _fetch_playlist_track_ids(db, playlist_id))
    additions = [track_id for track_id in track_ids if track_id not in existing]
    if not additions:
        return
    start_position = len(existing)
    for offset, track_id in enumerate(additions):
        await db.execute(
            text(
                """
INSERT INTO playlist_tracks (playlist_id, track_id, position, added_by)
VALUES (:playlist_id, :track_id, :position, :added_by)
"""
            ),
            {
                "playlist_id": playlist_id,
                "track_id": track_id,
                "position": start_position + offset,
                "added_by": added_by,
            },
        )
        await db.execute(
            text(
                """
INSERT INTO playlist_track_edits (
  playlist_id,
  user_id,
  action,
  track_id,
  position_after,
  metadata
)
VALUES (
  :playlist_id,
  :user_id,
  'track_added',
  :track_id,
  :position_after,
  CAST(:metadata AS jsonb)
)
"""
            ),
            {
                "playlist_id": playlist_id,
                "user_id": added_by,
                "track_id": track_id,
                "position_after": start_position + offset,
                "metadata": '{"source":"listener_app"}',
            },
        )
    await _refresh_playlist_rollups(db, playlist_id)


@router.get("/", summary="List accessible playlists (paginated)")
async def list_playlists(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    params = {
        "user_id": user_id,
        "is_admin": _is_admin(current_user),
        "limit": limit,
        "offset": offset,
    }
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
  (
    p.owner_id = :user_id
    OR EXISTS (
      SELECT 1
      FROM user_followed_playlists ufp3
      WHERE ufp3.playlist_id = p.id
        AND ufp3.user_id = :user_id
    )
    OR EXISTS (
      SELECT 1
      FROM playlist_collaborators pc3
      WHERE pc3.playlist_id = p.id
        AND pc3.user_id = :user_id
        AND pc3.accepted_at IS NOT NULL
    )
  ) AS is_in_library
FROM playlists p
JOIN users owner ON owner.id = p.owner_id
WHERE {_playlist_access_where(include_public=True)}
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
                text(
                    f"""
SELECT count(*)
FROM playlists p
WHERE {_playlist_access_where(include_public=True)}
"""
                ),
                {"user_id": user_id, "is_admin": _is_admin(current_user)},
            )
        ).scalar_one()
    )

    items: list[dict[str, Any]] = []
    for row in rows:
        tracks = await _fetch_playlist_tracks(db, row["id"])
        items.append(_serialize_playlist(row, tracks))
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/", summary="Create a playlist", status_code=status.HTTP_201_CREATED)
async def create_playlist(
    payload: PlaylistCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is required.")

    track_ids = _normalize_track_ids(payload.track_ids)
    await _ensure_tracks_are_playable(db, track_ids)

    row = (
        await db.execute(
            text(
                """
INSERT INTO playlists (
  name,
  description,
  cover_url,
  owner_id,
  is_public,
  is_collaborative,
  is_ai_curated
)
VALUES (
  :name,
  :description,
  :cover_url,
  :owner_id,
  :is_public,
  false,
  false
)
RETURNING
  id::text AS id,
  name,
  description,
  cover_url,
  owner_id::text AS owner_id,
  is_public,
  is_ai_curated,
  track_count,
  follower_count,
  total_duration_ms,
  created_at,
  updated_at
"""
            ),
            {
                "name": name,
                "description": payload.description.strip() if payload.description else None,
                "cover_url": payload.cover_url.strip() if payload.cover_url else None,
                "owner_id": current_user["id"],
                "is_public": payload.is_public,
            },
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Playlist creation failed.")

    playlist_id = row["id"]
    if track_ids:
        await _insert_playlist_tracks(db, playlist_id, track_ids, current_user["id"])
        await db.execute(
            text(
                """
INSERT INTO playlist_track_edits (playlist_id, user_id, action, metadata)
VALUES (:playlist_id, :user_id, 'metadata_updated', CAST(:metadata AS jsonb))
"""
            ),
            {
                "playlist_id": playlist_id,
                "user_id": current_user["id"],
                "metadata": '{"event":"playlist_created"}',
            },
        )
    refreshed = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
    tracks = await _fetch_playlist_tracks(db, playlist_id)
    return _serialize_playlist(refreshed, tracks)


@router.get("/{playlist_id}", summary="Get playlist by ID")
async def get_playlist(
    playlist_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    row = await _require_playlist_row(db, playlist_id, current_user)
    tracks = await _fetch_playlist_tracks(db, playlist_id)
    return _serialize_playlist(row, tracks)


@router.patch("/{playlist_id}", summary="Update playlist metadata")
async def update_playlist(
    playlist_id: str,
    payload: PlaylistUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    await _require_playlist_editor(db, playlist_id, current_user)

    values = payload.model_dump(by_alias=False, exclude_unset=True)
    updates: list[str] = []
    params: dict[str, Any] = {"playlist_id": playlist_id}

    if "name" in values:
        name = (values["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is required.")
        params["name"] = name
        updates.append("name = :name")
    if "description" in values:
        params["description"] = values["description"].strip() if values["description"] else None
        updates.append("description = :description")
    if "cover_url" in values:
        params["cover_url"] = values["cover_url"].strip() if values["cover_url"] else None
        updates.append("cover_url = :cover_url")
    if "is_public" in values:
        params["is_public"] = bool(values["is_public"])
        updates.append("is_public = :is_public")

    if not updates:
        row = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
        tracks = await _fetch_playlist_tracks(db, playlist_id)
        return _serialize_playlist(row, tracks)

    await db.execute(
        text(f"UPDATE playlists SET {', '.join(updates)} WHERE id = :playlist_id"),
        params,
    )
    await db.execute(
        text(
            """
INSERT INTO playlist_track_edits (playlist_id, user_id, action, metadata)
VALUES (:playlist_id, :user_id, 'metadata_updated', CAST(:metadata AS jsonb))
"""
        ),
        {
            "playlist_id": playlist_id,
            "user_id": current_user["id"],
            "metadata": '{"source":"listener_app"}',
        },
    )
    row = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
    tracks = await _fetch_playlist_tracks(db, playlist_id)
    return _serialize_playlist(row, tracks)


@router.delete("/{playlist_id}", summary="Delete a playlist")
async def delete_playlist(
    playlist_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    row = await _require_playlist_editor(db, playlist_id, current_user)
    if row["owner_id"] != current_user["id"] and not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only playlist owners can delete playlists.",
        )

    await db.execute(text("DELETE FROM playlists WHERE id = :playlist_id"), {"playlist_id": playlist_id})
    return {"playlistId": playlist_id, "deleted": True}


@router.post("/{playlist_id}/tracks", summary="Add tracks to playlist")
async def add_tracks(
    playlist_id: str,
    payload: PlaylistTrackMutationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    await _require_playlist_editor(db, playlist_id, current_user)
    track_ids = _normalize_track_ids(payload.track_ids)
    if not track_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="trackIds must contain at least one track.",
        )
    await _ensure_tracks_are_playable(db, track_ids)
    await _insert_playlist_tracks(db, playlist_id, track_ids, current_user["id"])
    row = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
    tracks = await _fetch_playlist_tracks(db, playlist_id)
    return _serialize_playlist(row, tracks)


@router.delete("/{playlist_id}/tracks", summary="Remove tracks from playlist")
async def remove_tracks(
    playlist_id: str,
    payload: PlaylistTrackMutationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    await _require_playlist_editor(db, playlist_id, current_user)
    track_ids = _normalize_track_ids(payload.track_ids)
    if not track_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="trackIds must contain at least one track.",
        )

    stmt = text(
        """
SELECT track_id::text AS track_id
FROM playlist_tracks
WHERE playlist_id = :playlist_id
  AND track_id::text IN :track_ids
ORDER BY position ASC
"""
    ).bindparams(bindparam("track_ids", expanding=True))
    removable = (await db.execute(stmt, {"playlist_id": playlist_id, "track_ids": track_ids})).scalars().all()
    if not removable:
        row = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
        tracks = await _fetch_playlist_tracks(db, playlist_id)
        return _serialize_playlist(row, tracks)

    delete_stmt = text(
        """
DELETE FROM playlist_tracks
WHERE playlist_id = :playlist_id
  AND track_id::text IN :track_ids
"""
    ).bindparams(bindparam("track_ids", expanding=True))
    await db.execute(delete_stmt, {"playlist_id": playlist_id, "track_ids": removable})

    remaining_track_ids = await _fetch_playlist_track_ids(db, playlist_id)
    await _reset_playlist_positions(db, playlist_id, remaining_track_ids)
    await _refresh_playlist_rollups(db, playlist_id)

    for track_id in removable:
        await db.execute(
            text(
                """
INSERT INTO playlist_track_edits (playlist_id, user_id, action, track_id, metadata)
VALUES (:playlist_id, :user_id, 'track_removed', :track_id, CAST(:metadata AS jsonb))
"""
            ),
            {
                "playlist_id": playlist_id,
                "user_id": current_user["id"],
                "track_id": track_id,
                "metadata": '{"source":"listener_app"}',
            },
        )

    row = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
    tracks = await _fetch_playlist_tracks(db, playlist_id)
    return _serialize_playlist(row, tracks)


@router.put("/{playlist_id}/tracks/reorder", summary="Reorder playlist tracks")
async def reorder_tracks(
    playlist_id: str,
    payload: PlaylistReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    await _require_playlist_editor(db, playlist_id, current_user)
    track_ids = _normalize_track_ids(payload.track_ids)
    if not track_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="trackIds must contain the full playlist order.",
        )

    current_track_ids = await _fetch_playlist_track_ids(db, playlist_id)
    if set(track_ids) != set(current_track_ids) or len(track_ids) != len(current_track_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="trackIds must include every playlist track exactly once.",
        )

    await _reset_playlist_positions(db, playlist_id, track_ids)
    await _refresh_playlist_rollups(db, playlist_id)
    await db.execute(
        text(
            """
INSERT INTO playlist_track_edits (playlist_id, user_id, action, metadata)
VALUES (:playlist_id, :user_id, 'track_reordered', CAST(:metadata AS jsonb))
"""
        ),
        {
            "playlist_id": playlist_id,
            "user_id": current_user["id"],
            "metadata": '{"source":"listener_app"}',
        },
    )

    row = await _require_playlist_row(db, playlist_id, current_user, include_public=False)
    tracks = await _fetch_playlist_tracks(db, playlist_id)
    return _serialize_playlist(row, tracks)
