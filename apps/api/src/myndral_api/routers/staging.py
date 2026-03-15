from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db

router = APIRouter()

_INTERNAL_ROLES: set[str] = {"content_editor", "content_reviewer", "admin"}
_REVIEWER_ROLES: set[str] = {"content_reviewer", "admin"}


class _CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ReviewNoteRequest(_CamelModel):
    notes: str = Field(min_length=1, max_length=2000)


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


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _serialize_staging_track(row: Any) -> dict[str, Any]:
    latest_action = row["latest_review_action"]
    return {
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
        "latestReview": {
            "action": latest_action,
            "notes": row["latest_review_notes"],
            "reviewerName": row["latest_reviewer_name"],
            "createdAt": _iso(row["latest_review_created_at"]),
        } if latest_action else None,
    }


@router.get("/staging", summary="List tracks in staging (review status)")
async def list_staging(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(_require_internal),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = await db.execute(
        text(
            """
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
  -- Latest audio file storage URL
  (
    SELECT taf.storage_url
    FROM   track_audio_files taf
    WHERE  taf.track_id = t.id
    ORDER  BY taf.created_at DESC
    LIMIT  1
  ) AS output_storage_url,
  t.created_at,
  -- Most recent staging review
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
WHERE t.status = 'review'
ORDER BY t.created_at DESC
LIMIT :limit OFFSET :offset
"""
        ),
        {"limit": limit, "offset": offset},
    )

    count_row = await db.execute(
        text("SELECT count(*) FROM tracks WHERE status = 'review'"),
    )
    total = int(count_row.scalar_one())

    return {
        "items": [_serialize_staging_track(r) for r in rows.mappings().all()],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/staging/{track_id}/approve", summary="Approve a staged track (publish it)")
async def approve_track(
    track_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    track = await _fetch_staging_track(db, track_id)

    await db.execute(
        text(
            """
UPDATE tracks
SET status = 'published', published_at = now()
WHERE id = CAST(:track_id AS uuid)
"""
        ),
        {"track_id": track_id},
    )
    await db.execute(
        text(
            """
INSERT INTO staging_reviews (track_id, reviewer_id, action)
VALUES (CAST(:track_id AS uuid), CAST(:reviewer_id AS uuid), 'approved')
"""
        ),
        {"track_id": track_id, "reviewer_id": current_user["id"]},
    )
    # Update album track_count to only count published/review tracks
    await db.execute(
        text(
            """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid)
    AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
        ),
        {"album_id": str(track["album_id"])},
    )
    await db.commit()
    return {"trackId": track_id, "action": "approved"}


@router.post("/staging/{track_id}/reject", summary="Reject a staged track (archive it)")
async def reject_track(
    track_id: str,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    track = await _fetch_staging_track(db, track_id)

    await db.execute(
        text(
            """
UPDATE tracks
SET status = 'archived'
WHERE id = CAST(:track_id AS uuid)
"""
        ),
        {"track_id": track_id},
    )
    await db.execute(
        text(
            """
INSERT INTO staging_reviews (track_id, reviewer_id, action)
VALUES (CAST(:track_id AS uuid), CAST(:reviewer_id AS uuid), 'rejected')
"""
        ),
        {"track_id": track_id, "reviewer_id": current_user["id"]},
    )
    await db.execute(
        text(
            """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid)
    AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
        ),
        {"album_id": str(track["album_id"])},
    )
    await db.commit()
    return {"trackId": track_id, "action": "rejected"}


@router.post(
    "/staging/{track_id}/review",
    summary="Send a staged track back for revision with notes",
)
async def send_for_review(
    track_id: str,
    payload: ReviewNoteRequest,
    current_user: dict = Depends(_require_reviewer),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    track = await _fetch_staging_track(db, track_id)
    creator_id = str(track["created_by"])
    track_title = str(track["title"])
    reviewer_name = current_user.get("display_name") or current_user.get("username") or "A reviewer"

    await db.execute(
        text(
            """
INSERT INTO staging_reviews (track_id, reviewer_id, action, notes)
VALUES (CAST(:track_id AS uuid), CAST(:reviewer_id AS uuid), 'sent_for_review', :notes)
"""
        ),
        {
            "track_id": track_id,
            "reviewer_id": current_user["id"],
            "notes": payload.notes,
        },
    )

    # Notify the creator
    message = f"{reviewer_name} sent \"{track_title}\" back for revision: {payload.notes}"
    await db.execute(
        text(
            """
INSERT INTO notifications (recipient_id, track_id, message)
VALUES (CAST(:recipient_id AS uuid), CAST(:track_id AS uuid), :message)
"""
        ),
        {
            "recipient_id": creator_id,
            "track_id": track_id,
            "message": message[:500],
        },
    )
    await db.commit()
    return {"trackId": track_id, "action": "sent_for_review"}


async def _fetch_staging_track(db: AsyncSession, track_id: str) -> Any:
    row = await db.execute(
        text(
            """
SELECT id, title, status::text AS status, album_id, created_by
FROM tracks
WHERE id = CAST(:track_id AS uuid)
"""
        ),
        {"track_id": track_id},
    )
    track = row.mappings().first()
    if track is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")
    if track["status"] != "review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Track is not in staging (current status: {track['status']}).",
        )
    return track
