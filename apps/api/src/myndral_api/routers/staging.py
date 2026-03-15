"""
Staging router — review queue and archive management for all catalog entities.

Entity lifecycle (consistent for artists, albums, and tracks):
  Creator submits → status = 'review' (appears in staging)
  Reviewer approves → status = 'published'  (appears in player)
  Reviewer rejects  → status = 'archived'   (appears in archive, recoverable)
  Reviewer requests revision → status stays 'review', notification sent to creator

Hierarchy enforcement on track approval:
  Approving a track also publishes its parent album and grandparent artist if
  they are not already published.  This prevents approved tracks from being
  silently invisible in the player due to an unpublished parent.

Polymorphic staging_reviews / notifications:
  Both tables carry an entity_type discriminator ('artist' | 'album' | 'track')
  and a nullable FK per entity type with an XOR constraint (exactly one set).
"""

from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db

router = APIRouter()

_INTERNAL_ROLES: set[str] = {"content_editor", "content_reviewer", "admin"}
_REVIEWER_ROLES: set[str] = {"content_reviewer", "admin"}

EntityType = Literal["artist", "album", "track"]


# ── Pydantic models ────────────────────────────────────────────────────────────

class _CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ReviewNoteRequest(_CamelModel):
    notes: str = Field(min_length=1, max_length=2000)


class RevokeRequest(_CamelModel):
    """Optional notes explaining why a published item is being pulled back to staging."""
    notes: str | None = Field(default=None, max_length=2000)


# ── Auth helpers ───────────────────────────────────────────────────────────────

async def _require_internal(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in _INTERNAL_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Internal users only.")
    return current_user


async def _require_reviewer(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in _REVIEWER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Publisher or admin role required.",
        )
    return current_user


async def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required.")
    return current_user


# ── Serialisers ────────────────────────────────────────────────────────────────

def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _latest_review(row: Any) -> dict[str, Any] | None:
    if not row["latest_review_action"]:
        return None
    return {
        "action": row["latest_review_action"],
        "notes": row["latest_review_notes"],
        "reviewerName": row["latest_reviewer_name"],
        "createdAt": _iso(row["latest_review_created_at"]),
    }


def _serialize_staging_artist(row: Any) -> dict[str, Any]:
    return {
        "entityType": "artist",
        "id": str(row["id"]),
        "name": row["name"],
        "slug": row["slug"],
        "imageUrl": row["image_url"],
        "bio": row["bio"],
        "styleTags": row["style_tags"] or [],
        "status": row["status"],
        "createdById": str(row["created_by_id"]),
        "createdByName": row["created_by_name"],
        "createdByRole": row["created_by_role"],
        "createdAt": _iso(row["created_at"]),
        "latestReview": _latest_review(row),
    }


def _serialize_staging_album(row: Any) -> dict[str, Any]:
    return {
        "entityType": "album",
        "id": str(row["id"]),
        "title": row["title"],
        "slug": row["slug"],
        "artistId": str(row["artist_id"]),
        "artistName": row["artist_name"],
        "coverUrl": row["cover_url"],
        "albumType": row["album_type"],
        "releaseDate": _iso(row["release_date"]),
        "trackCount": row["track_count"],
        "status": row["status"],
        "createdById": str(row["created_by_id"]),
        "createdByName": row["created_by_name"],
        "createdByRole": row["created_by_role"],
        "createdAt": _iso(row["created_at"]),
        "latestReview": _latest_review(row),
    }


def _serialize_staging_track(row: Any) -> dict[str, Any]:
    return {
        "entityType": "track",
        "id": str(row["id"]),
        "title": row["title"],
        "status": row["status"],
        "explicit": row["explicit"],
        "durationMs": row["duration_ms"],
        "albumId": str(row["album_id"]),
        "albumTitle": row["album_title"],
        "albumType": row["album_type"],
        "primaryArtistId": str(row["primary_artist_id"]),
        "primaryArtistName": row["primary_artist_name"],
        "createdById": str(row["created_by_id"]),
        "createdByName": row["created_by_name"],
        "createdByRole": row["created_by_role"],
        "outputStorageUrl": row["output_storage_url"],
        "createdAt": _iso(row["created_at"]),
        "latestReview": _latest_review(row),
    }


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def _fetch_entity(
    db: AsyncSession,
    entity_type: EntityType,
    entity_id: str,
    *,
    require_status: str | None = "review",
) -> Any:
    """Fetch a catalog entity row, optionally asserting its status."""
    table = {"artist": "artists", "album": "albums", "track": "tracks"}[entity_type]
    row = (
        await db.execute(
            text(f"SELECT id, status::text AS status, created_by FROM {table} WHERE id = CAST(:id AS uuid)"),
            {"id": entity_id},
        )
    ).mappings().first()

    label = entity_type.capitalize()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found.")
    if require_status and row["status"] != require_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{label} is not in staging (current status: {row['status']}).",
        )
    return row


async def _insert_staging_review(
    db: AsyncSession,
    *,
    entity_type: EntityType,
    entity_id: str,
    reviewer_id: str,
    action: str,
    notes: str | None = None,
) -> None:
    """Write a staging_reviews audit row for any entity type."""
    fk_col = f"{entity_type}_id"
    await db.execute(
        text(
            f"""
INSERT INTO staging_reviews ({fk_col}, reviewer_id, action, notes, entity_type)
VALUES (CAST(:{fk_col} AS uuid), CAST(:reviewer_id AS uuid), :action, :notes, :entity_type)
"""
        ),
        {fk_col: entity_id, "reviewer_id": reviewer_id, "action": action, "notes": notes, "entity_type": entity_type},
    )


async def _notify(
    db: AsyncSession,
    *,
    recipient_id: str,
    entity_type: EntityType,
    entity_id: str,
    message: str,
) -> None:
    """Insert a notification for any entity type."""
    fk_col = f"{entity_type}_id"
    await db.execute(
        text(
            f"""
INSERT INTO notifications (recipient_id, {fk_col}, message, entity_type)
VALUES (CAST(:recipient_id AS uuid), CAST(:{fk_col} AS uuid), :message, :entity_type)
"""
        ),
        {"recipient_id": recipient_id, fk_col: entity_id, "message": message[:500], "entity_type": entity_type},
    )


async def _reviewer_display_name(current_user: dict) -> str:
    return current_user.get("display_name") or current_user.get("username") or "A reviewer"


# ── Staging list ───────────────────────────────────────────────────────────────

_ARTIST_STAGING_SQL = """
SELECT
  a.id,
  a.name,
  a.slug,
  a.image_url,
  a.bio,
  a.style_tags,
  a.status::text       AS status,
  a.created_by         AS created_by_id,
  u.display_name       AS created_by_name,
  u.role::text         AS created_by_role,
  a.created_at,
  sr.action            AS latest_review_action,
  sr.notes             AS latest_review_notes,
  ru.display_name      AS latest_reviewer_name,
  sr.created_at        AS latest_review_created_at
FROM artists a
JOIN users u ON u.id = a.created_by
LEFT JOIN LATERAL (
  SELECT sr2.action, sr2.notes, sr2.reviewer_id, sr2.created_at
  FROM   staging_reviews sr2
  WHERE  sr2.artist_id = a.id
  ORDER  BY sr2.created_at DESC
  LIMIT  1
) sr ON true
LEFT JOIN users ru ON ru.id = sr.reviewer_id
WHERE a.status = :status_filter
ORDER BY a.created_at DESC
"""

_ALBUM_STAGING_SQL = """
SELECT
  a.id,
  a.title,
  a.slug,
  a.artist_id,
  ar.name              AS artist_name,
  a.cover_url,
  a.album_type::text   AS album_type,
  a.release_date,
  a.track_count,
  a.status::text       AS status,
  a.created_by         AS created_by_id,
  u.display_name       AS created_by_name,
  u.role::text         AS created_by_role,
  a.created_at,
  sr.action            AS latest_review_action,
  sr.notes             AS latest_review_notes,
  ru.display_name      AS latest_reviewer_name,
  sr.created_at        AS latest_review_created_at
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
JOIN users   u  ON u.id  = a.created_by
LEFT JOIN LATERAL (
  SELECT sr2.action, sr2.notes, sr2.reviewer_id, sr2.created_at
  FROM   staging_reviews sr2
  WHERE  sr2.album_id = a.id
  ORDER  BY sr2.created_at DESC
  LIMIT  1
) sr ON true
LEFT JOIN users ru ON ru.id = sr.reviewer_id
WHERE a.status = :status_filter
ORDER BY a.created_at DESC
"""

_TRACK_STAGING_SQL = """
SELECT
  t.id,
  t.title,
  t.status::text       AS status,
  t.explicit,
  t.duration_ms,
  t.album_id,
  a.title              AS album_title,
  a.album_type::text   AS album_type,
  t.primary_artist_id,
  ar.name              AS primary_artist_name,
  t.created_by         AS created_by_id,
  u.display_name       AS created_by_name,
  u.role::text         AS created_by_role,
  (
    SELECT taf.storage_url
    FROM   track_audio_files taf
    WHERE  taf.track_id = t.id
    ORDER  BY taf.created_at DESC
    LIMIT  1
  ) AS output_storage_url,
  t.created_at,
  sr.action            AS latest_review_action,
  sr.notes             AS latest_review_notes,
  ru.display_name      AS latest_reviewer_name,
  sr.created_at        AS latest_review_created_at
FROM tracks t
JOIN albums  a  ON a.id  = t.album_id
JOIN artists ar ON ar.id = t.primary_artist_id
JOIN users   u  ON u.id  = t.created_by
LEFT JOIN LATERAL (
  SELECT sr2.action, sr2.notes, sr2.reviewer_id, sr2.created_at
  FROM   staging_reviews sr2
  WHERE  sr2.track_id = t.id
  ORDER  BY sr2.created_at DESC
  LIMIT  1
) sr ON true
LEFT JOIN users ru ON ru.id = sr.reviewer_id
WHERE t.status = :status_filter
ORDER BY t.created_at DESC
"""


@router.get("/staging", summary="List all catalog entities pending review (staging queue)")
async def list_staging(
    current_user: dict = Depends(_require_internal),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Returns three separate lists — artists, albums, tracks — all in 'review' status."""
    params = {"status_filter": "review"}
    artist_rows = (await db.execute(text(_ARTIST_STAGING_SQL), params)).mappings().all()
    album_rows  = (await db.execute(text(_ALBUM_STAGING_SQL),  params)).mappings().all()
    track_rows  = (await db.execute(text(_TRACK_STAGING_SQL),  params)).mappings().all()

    return {
        "artists": [_serialize_staging_artist(r) for r in artist_rows],
        "albums":  [_serialize_staging_album(r)  for r in album_rows],
        "tracks":  [_serialize_staging_track(r)  for r in track_rows],
        "totalArtists": len(artist_rows),
        "totalAlbums":  len(album_rows),
        "totalTracks":  len(track_rows),
    }


# ── Artist staging actions ─────────────────────────────────────────────────────

@router.post("/staging/artists/{artist_id}/approve", summary="Approve a staged artist (publish it)")
async def approve_artist(
    artist_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    entity = await _fetch_entity(db, "artist", artist_id)
    creator_id = str(entity["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    await db.execute(
        text("UPDATE artists SET status = 'published', published_at = now() WHERE id = CAST(:id AS uuid)"),
        {"id": artist_id},
    )
    await _insert_staging_review(db, entity_type="artist", entity_id=artist_id,
                                 reviewer_id=current_user["id"], action="approved")
    await _notify(db, recipient_id=creator_id, entity_type="artist", entity_id=artist_id,
                  message=f'{reviewer} approved your artist and it is now live in the player.')
    await db.commit()
    return {"artistId": artist_id, "action": "approved"}


@router.post("/staging/artists/{artist_id}/reject", summary="Reject a staged artist (archive it)")
async def reject_artist(
    artist_id: str,
    payload: ReviewNoteRequest,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    entity = await _fetch_entity(db, "artist", artist_id)
    creator_id = str(entity["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    await db.execute(
        text("UPDATE artists SET status = 'archived', archived_at = now() WHERE id = CAST(:id AS uuid)"),
        {"id": artist_id},
    )
    await _insert_staging_review(db, entity_type="artist", entity_id=artist_id,
                                 reviewer_id=current_user["id"], action="rejected", notes=payload.notes)
    await _notify(db, recipient_id=creator_id, entity_type="artist", entity_id=artist_id,
                  message=f'{reviewer} rejected your artist: {payload.notes}')
    await db.commit()
    return {"artistId": artist_id, "action": "rejected"}


@router.post("/staging/artists/{artist_id}/review", summary="Send a staged artist back for revision")
async def review_artist(
    artist_id: str,
    payload: ReviewNoteRequest,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    entity = await _fetch_entity(db, "artist", artist_id)
    creator_id = str(entity["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    await _insert_staging_review(db, entity_type="artist", entity_id=artist_id,
                                 reviewer_id=current_user["id"], action="sent_for_review", notes=payload.notes)
    await _notify(db, recipient_id=creator_id, entity_type="artist", entity_id=artist_id,
                  message=f'{reviewer} requested revisions on your artist: {payload.notes}')
    await db.commit()
    return {"artistId": artist_id, "action": "sent_for_review"}


# ── Album staging actions ──────────────────────────────────────────────────────

@router.post("/staging/albums/{album_id}/approve", summary="Approve a staged album (publish it)")
async def approve_album(
    album_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    entity = await _fetch_entity(db, "album", album_id)
    creator_id = str(entity["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    # Publish the album
    await db.execute(
        text("UPDATE albums SET status = 'published', published_at = now() WHERE id = CAST(:id AS uuid)"),
        {"id": album_id},
    )

    # Auto-publish the parent artist if not already published
    await db.execute(
        text(
            """
UPDATE artists
SET status = 'published', published_at = now()
WHERE id = (SELECT artist_id FROM albums WHERE id = CAST(:album_id AS uuid))
  AND status != 'published'
"""
        ),
        {"album_id": album_id},
    )

    await _insert_staging_review(db, entity_type="album", entity_id=album_id,
                                 reviewer_id=current_user["id"], action="approved")
    await _notify(db, recipient_id=creator_id, entity_type="album", entity_id=album_id,
                  message=f'{reviewer} approved your album and it is now live in the player.')
    await db.commit()
    return {"albumId": album_id, "action": "approved"}


@router.post("/staging/albums/{album_id}/reject", summary="Reject a staged album (archive it)")
async def reject_album(
    album_id: str,
    payload: ReviewNoteRequest,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    entity = await _fetch_entity(db, "album", album_id)
    creator_id = str(entity["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    await db.execute(
        text("UPDATE albums SET status = 'archived', archived_at = now() WHERE id = CAST(:id AS uuid)"),
        {"id": album_id},
    )
    await _insert_staging_review(db, entity_type="album", entity_id=album_id,
                                 reviewer_id=current_user["id"], action="rejected", notes=payload.notes)
    await _notify(db, recipient_id=creator_id, entity_type="album", entity_id=album_id,
                  message=f'{reviewer} rejected your album: {payload.notes}')
    await db.commit()
    return {"albumId": album_id, "action": "rejected"}


@router.post("/staging/albums/{album_id}/review", summary="Send a staged album back for revision")
async def review_album(
    album_id: str,
    payload: ReviewNoteRequest,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    entity = await _fetch_entity(db, "album", album_id)
    creator_id = str(entity["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    await _insert_staging_review(db, entity_type="album", entity_id=album_id,
                                 reviewer_id=current_user["id"], action="sent_for_review", notes=payload.notes)
    await _notify(db, recipient_id=creator_id, entity_type="album", entity_id=album_id,
                  message=f'{reviewer} requested revisions on your album: {payload.notes}')
    await db.commit()
    return {"albumId": album_id, "action": "sent_for_review"}


# ── Track staging actions ──────────────────────────────────────────────────────

@router.post("/staging/{track_id}/approve", summary="Approve a staged track (publish it)")
async def approve_track(
    track_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # Fetch the track with its album and artist for cascade publishing
    track_row = (
        await db.execute(
            text(
                """
SELECT t.id, t.status::text AS status, t.created_by,
       t.album_id,
       a.artist_id,
       a.status::text AS album_status,
       ar.status::text AS artist_status
FROM tracks t
JOIN albums  a  ON a.id  = t.album_id
JOIN artists ar ON ar.id = a.artist_id
WHERE t.id = CAST(:track_id AS uuid)
"""
            ),
            {"track_id": track_id},
        )
    ).mappings().first()

    if track_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")
    if track_row["status"] != "review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Track is not in staging (current status: {track_row['status']}).",
        )

    creator_id = str(track_row["created_by"])
    album_id = str(track_row["album_id"])
    artist_id = str(track_row["artist_id"])
    reviewer = await _reviewer_display_name(current_user)

    # Publish the track
    await db.execute(
        text("UPDATE tracks SET status = 'published', published_at = now() WHERE id = CAST(:id AS uuid)"),
        {"id": track_id},
    )

    # Cascade: publish album if not already published
    if track_row["album_status"] != "published":
        await db.execute(
            text("UPDATE albums SET status = 'published', published_at = now() WHERE id = CAST(:id AS uuid)"),
            {"id": album_id},
        )

    # Cascade: publish artist if not already published
    if track_row["artist_status"] != "published":
        await db.execute(
            text("UPDATE artists SET status = 'published', published_at = now() WHERE id = CAST(:id AS uuid)"),
            {"id": artist_id},
        )

    # Recompute album track_count (non-archived tracks only)
    await db.execute(
        text(
            """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid) AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
        ),
        {"album_id": album_id},
    )

    await _insert_staging_review(db, entity_type="track", entity_id=track_id,
                                 reviewer_id=current_user["id"], action="approved")
    await _notify(db, recipient_id=creator_id, entity_type="track", entity_id=track_id,
                  message=f'{reviewer} approved your track — it is now live in the player.')
    await db.commit()
    return {"trackId": track_id, "action": "approved"}


@router.post("/staging/{track_id}/reject", summary="Reject a staged track (archive it)")
async def reject_track(
    track_id: str,
    payload: ReviewNoteRequest,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    track = await _fetch_entity(db, "track", track_id)
    creator_id = str(track["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    await db.execute(
        text("UPDATE tracks SET status = 'archived', archived_at = now() WHERE id = CAST(:id AS uuid)"),
        {"id": track_id},
    )

    # Recompute album track_count
    album_row = (
        await db.execute(text("SELECT album_id FROM tracks WHERE id = CAST(:id AS uuid)"), {"id": track_id})
    ).mappings().first()
    if album_row:
        await db.execute(
            text(
                """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid) AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
            ),
            {"album_id": str(album_row["album_id"])},
        )

    await _insert_staging_review(db, entity_type="track", entity_id=track_id,
                                 reviewer_id=current_user["id"], action="rejected", notes=payload.notes)
    await _notify(db, recipient_id=creator_id, entity_type="track", entity_id=track_id,
                  message=f'{reviewer} rejected your track: {payload.notes}')
    await db.commit()
    return {"trackId": track_id, "action": "rejected"}


@router.post("/staging/{track_id}/review", summary="Send a staged track back for revision with notes")
async def send_track_for_review(
    track_id: str,
    payload: ReviewNoteRequest,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    track = await _fetch_entity(db, "track", track_id)
    creator_id = str(track["created_by"])
    reviewer = await _reviewer_display_name(current_user)

    await _insert_staging_review(db, entity_type="track", entity_id=track_id,
                                 reviewer_id=current_user["id"], action="sent_for_review", notes=payload.notes)
    await _notify(db, recipient_id=creator_id, entity_type="track", entity_id=track_id,
                  message=f'{reviewer} requested revisions on your track: {payload.notes}')
    await db.commit()
    return {"trackId": track_id, "action": "sent_for_review"}


# ── Revoke (published → review) ────────────────────────────────────────────────
#
# Admin-only operation: pull a published item back into the staging queue so it
# can be updated and re-reviewed.  A staging_review record is written so the
# audit trail is complete; the creator is notified if notes are provided.

@router.post("/artists/{artist_id}/revoke", summary="Revoke a published artist back to staging (admin only)")
async def revoke_artist(
    artist_id: str,
    payload: RevokeRequest = None,
    current_user: dict = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if payload is None:
        payload = RevokeRequest()
    row = await _fetch_entity(db, "artist", artist_id, require_status="published")
    reviewer_name = await _reviewer_display_name(current_user)

    await db.execute(
        text("UPDATE artists SET status = 'review', published_at = NULL WHERE id = CAST(:id AS uuid)"),
        {"id": artist_id},
    )
    await _insert_staging_review(
        db, entity_type="artist", entity_id=artist_id,
        reviewer_id=current_user["id"], action="sent_for_review", notes=payload.notes,
    )
    creator_id = str(row["created_by"])
    if creator_id != current_user["id"]:
        msg_parts = [f"{reviewer_name} revoked the publication of your artist and returned it to staging for re-review."]
        if payload.notes:
            msg_parts.append(f"Note: {payload.notes}")
        await _notify(db, recipient_id=creator_id, entity_type="artist", entity_id=artist_id, message=" ".join(msg_parts))

    await db.commit()
    return {"artistId": artist_id, "action": "revoked"}


@router.post("/albums/{album_id}/revoke", summary="Revoke a published album back to staging (admin only)")
async def revoke_album(
    album_id: str,
    payload: RevokeRequest = None,
    current_user: dict = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if payload is None:
        payload = RevokeRequest()
    row = await _fetch_entity(db, "album", album_id, require_status="published")
    reviewer_name = await _reviewer_display_name(current_user)

    await db.execute(
        text("UPDATE albums SET status = 'review', published_at = NULL WHERE id = CAST(:id AS uuid)"),
        {"id": album_id},
    )
    await _insert_staging_review(
        db, entity_type="album", entity_id=album_id,
        reviewer_id=current_user["id"], action="sent_for_review", notes=payload.notes,
    )
    creator_id = str(row["created_by"])
    if creator_id != current_user["id"]:
        msg_parts = [f"{reviewer_name} revoked the publication of your album and returned it to staging for re-review."]
        if payload.notes:
            msg_parts.append(f"Note: {payload.notes}")
        await _notify(db, recipient_id=creator_id, entity_type="album", entity_id=album_id, message=" ".join(msg_parts))

    await db.commit()
    return {"albumId": album_id, "action": "revoked"}


@router.post("/{track_id}/revoke", summary="Revoke a published track back to staging (admin only)")
async def revoke_track(
    track_id: str,
    payload: RevokeRequest = None,
    current_user: dict = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if payload is None:
        payload = RevokeRequest()
    row = await _fetch_entity(db, "track", track_id, require_status="published")
    reviewer_name = await _reviewer_display_name(current_user)

    await db.execute(
        text("UPDATE tracks SET status = 'review', published_at = NULL WHERE id = CAST(:id AS uuid)"),
        {"id": track_id},
    )
    await _insert_staging_review(
        db, entity_type="track", entity_id=track_id,
        reviewer_id=current_user["id"], action="sent_for_review", notes=payload.notes,
    )
    creator_id = str(row["created_by"])
    if creator_id != current_user["id"]:
        msg_parts = [f"{reviewer_name} revoked the publication of your track and returned it to staging for re-review."]
        if payload.notes:
            msg_parts.append(f"Note: {payload.notes}")
        await _notify(db, recipient_id=creator_id, entity_type="track", entity_id=track_id, message=" ".join(msg_parts))

    await db.commit()
    return {"trackId": track_id, "action": "revoked"}


# ── Archive list ───────────────────────────────────────────────────────────────

@router.get("/archive", summary="List archived catalog entities")
async def list_archive(
    current_user: dict = Depends(_require_internal),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Returns archived artists, albums, and tracks with their last review action."""
    params = {"status_filter": "archived"}
    artist_rows = (await db.execute(text(_ARTIST_STAGING_SQL), params)).mappings().all()
    album_rows  = (await db.execute(text(_ALBUM_STAGING_SQL),  params)).mappings().all()
    track_rows  = (await db.execute(text(_TRACK_STAGING_SQL),  params)).mappings().all()

    return {
        "artists": [_serialize_staging_artist(r) for r in artist_rows],
        "albums":  [_serialize_staging_album(r)  for r in album_rows],
        "tracks":  [_serialize_staging_track(r)  for r in track_rows],
        "totalArtists": len(artist_rows),
        "totalAlbums":  len(album_rows),
        "totalTracks":  len(track_rows),
    }


# ── Archive restore ────────────────────────────────────────────────────────────

@router.post("/archive/artists/{artist_id}/restore", summary="Restore an archived artist back to staging")
async def restore_artist(
    artist_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _fetch_entity(db, "artist", artist_id, require_status="archived")
    await db.execute(
        text("UPDATE artists SET status = 'review', archived_at = NULL WHERE id = CAST(:id AS uuid)"),
        {"id": artist_id},
    )
    await db.commit()
    return {"artistId": artist_id, "action": "restored"}


@router.post("/archive/albums/{album_id}/restore", summary="Restore an archived album back to staging")
async def restore_album(
    album_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _fetch_entity(db, "album", album_id, require_status="archived")
    await db.execute(
        text("UPDATE albums SET status = 'review', archived_at = NULL WHERE id = CAST(:id AS uuid)"),
        {"id": album_id},
    )
    await db.commit()
    return {"albumId": album_id, "action": "restored"}


@router.post("/archive/tracks/{track_id}/restore", summary="Restore an archived track back to staging")
async def restore_track(
    track_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _fetch_entity(db, "track", track_id, require_status="archived")
    await db.execute(
        text("UPDATE tracks SET status = 'review', archived_at = NULL WHERE id = CAST(:id AS uuid)"),
        {"id": track_id},
    )
    # Recompute album track_count (restored track is no longer archived)
    album_row = (
        await db.execute(text("SELECT album_id FROM tracks WHERE id = CAST(:id AS uuid)"), {"id": track_id})
    ).mappings().first()
    if album_row:
        await db.execute(
            text(
                """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid) AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
            ),
            {"album_id": str(album_row["album_id"])},
        )
    await db.commit()
    return {"trackId": track_id, "action": "restored"}
