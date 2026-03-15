from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db
from myndral_api.media_utils import DATA_DIR, resolve_local_storage_path

router = APIRouter()

_PREMIUM_PLANS = {"premium_monthly", "premium_annual"}

# Pricing for business licenses (in cents).
# TODO: wire these into a Stripe price lookup when payment processor is integrated.
BUSINESS_TRACK_PRICE_CENTS = 99   # $0.99
BUSINESS_ALBUM_PRICE_CENTS = 499  # $4.99


class _CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class LicenseRequest(_CamelModel):
    license_type: str = Field(alias="licenseType")


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _require_premium(current_user: dict) -> None:
    """Raises 402 if the user does not hold an active premium subscription."""
    plan = current_user.get("subscription_plan", "free")
    if plan not in _PREMIUM_PLANS:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="A Premium subscription is required to export tracks.",
        )


async def _require_auth(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


def _serialize_license(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "licenseType": row["license_type"],
        "subjectType": row["subject_type"],
        "subjectId": str(row["subject_id"]),
        "pricePaidCents": row["price_paid_cents"],
        "paymentStatus": row["payment_status"],
        "createdAt": _iso(row["created_at"]),
    }


async def _upsert_personal_track_license(
    db: AsyncSession, user_id: str, track_id: str
) -> str:
    """Insert a personal track license if one doesn't exist. Returns the license id."""
    result = await db.execute(
        text(
            """
INSERT INTO export_licenses
  (user_id, license_type, subject_type, subject_id, price_paid_cents, payment_status)
VALUES
  (CAST(:user_id AS uuid), 'personal', 'track', CAST(:subject_id AS uuid), 0, 'completed')
ON CONFLICT (user_id, license_type, subject_type, subject_id)
  WHERE payment_status = 'completed'
  DO UPDATE SET created_at = export_licenses.created_at  -- no-op, just return existing
RETURNING id::text
"""
        ),
        {"user_id": user_id, "subject_id": track_id},
    )
    row = result.first()
    if row:
        return str(row[0])
    # Conflict branch: fetch existing
    existing = await db.execute(
        text(
            """
SELECT id::text FROM export_licenses
WHERE user_id = CAST(:user_id AS uuid)
  AND license_type = 'personal'
  AND subject_type = 'track'
  AND subject_id = CAST(:subject_id AS uuid)
  AND payment_status = 'completed'
"""
        ),
        {"user_id": user_id, "subject_id": track_id},
    )
    return str(existing.scalar_one())


# ── Track license ─────────────────────────────────────────────────────────────

@router.post("/export/track/{track_id}/license", summary="Grant an export license for a track")
async def grant_track_license(
    track_id: str,
    payload: LicenseRequest,
    current_user: dict = Depends(_require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if payload.license_type == "business":
        # TODO: integrate Stripe checkout here.
        # When ready: create a Stripe PaymentIntent for BUSINESS_TRACK_PRICE_CENTS,
        # insert an export_license with payment_status='pending' and payment_reference=intent_id,
        # then return the Stripe checkout URL. A webhook handler marks it 'completed'.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Business licenses are coming soon. Stay tuned.",
        )

    if payload.license_type != "personal":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid licenseType.")

    _require_premium(current_user)

    # Verify track exists and is published
    track_row = await db.execute(
        text(
            """
SELECT t.id::text, t.title, taf.storage_url
FROM tracks t
LEFT JOIN track_audio_files taf ON taf.track_id = t.id
WHERE t.id = CAST(:track_id AS uuid)
  AND t.status = 'published'
ORDER BY taf.created_at DESC
LIMIT 1
"""
        ),
        {"track_id": track_id},
    )
    track = track_row.mappings().first()
    if track is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found.")
    if not track["storage_url"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No audio file available for this track.",
        )

    license_id = await _upsert_personal_track_license(db, current_user["id"], track_id)
    await db.commit()

    return {
        "licenseId": license_id,
        "licenseType": "personal",
        "subjectType": "track",
        "subjectId": track_id,
        "trackTitle": track["title"],
        "downloadUrl": f"/v1/export/track/{track_id}/download",
    }


# ── Album license ─────────────────────────────────────────────────────────────

@router.post("/export/album/{album_id}/license", summary="Grant export licenses for all tracks in an album")
async def grant_album_license(
    album_id: str,
    payload: LicenseRequest,
    current_user: dict = Depends(_require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if payload.license_type == "business":
        # TODO: integrate Stripe checkout here.
        # When ready: create a Stripe PaymentIntent for BUSINESS_ALBUM_PRICE_CENTS,
        # insert an export_license with subject_type='album', payment_status='pending',
        # and grant individual track licenses on webhook completion.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Business licenses are coming soon. Stay tuned.",
        )

    if payload.license_type != "personal":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid licenseType.")

    _require_premium(current_user)

    # Verify album exists and is published
    album_row = await db.execute(
        text(
            "SELECT id::text, title FROM albums WHERE id = CAST(:album_id AS uuid) AND status = 'published'"
        ),
        {"album_id": album_id},
    )
    album = album_row.mappings().first()
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found.")

    # Fetch all published tracks in the album that have audio files
    tracks_row = await db.execute(
        text(
            """
SELECT
  t.id::text    AS track_id,
  t.title       AS title,
  t.track_number,
  taf.storage_url
FROM tracks t
JOIN (
  SELECT DISTINCT ON (track_id) track_id, storage_url
  FROM track_audio_files
  ORDER BY track_id, created_at DESC
) taf ON taf.track_id = t.id
WHERE t.album_id = CAST(:album_id AS uuid)
  AND t.status = 'published'
ORDER BY t.track_number
"""
        ),
        {"album_id": album_id},
    )
    tracks = tracks_row.mappings().all()

    if not tracks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No downloadable tracks found in this album.",
        )

    # Grant personal license for each track
    # TODO: Make album downloads a ZIP file. For now, each track is licensed
    # and downloaded individually by the client.
    track_licenses = []
    for t in tracks:
        license_id = await _upsert_personal_track_license(db, current_user["id"], t["track_id"])
        track_licenses.append({
            "licenseId": license_id,
            "trackId": t["track_id"],
            "trackTitle": t["title"],
            "trackNumber": t["track_number"],
            "downloadUrl": f"/v1/export/track/{t['track_id']}/download",
        })

    await db.commit()

    return {
        "licenseType": "personal",
        "subjectType": "album",
        "albumId": album_id,
        "albumTitle": album["title"],
        "tracks": track_licenses,
    }


# ── Download ──────────────────────────────────────────────────────────────────

@router.get("/export/track/{track_id}/download", summary="Download a licensed track as MP3")
async def download_track(
    track_id: str,
    current_user: dict = Depends(_require_auth),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    # Verify a completed personal license exists for this user + track
    license_row = await db.execute(
        text(
            """
SELECT id FROM export_licenses
WHERE user_id    = CAST(:user_id AS uuid)
  AND license_type = 'personal'
  AND subject_type = 'track'
  AND subject_id  = CAST(:track_id AS uuid)
  AND payment_status = 'completed'
LIMIT 1
"""
        ),
        {"user_id": current_user["id"], "track_id": track_id},
    )
    if license_row.first() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No valid export license found for this track. Grant a license first.",
        )

    # Fetch the audio file path
    audio_row = await db.execute(
        text(
            """
SELECT taf.storage_url, t.title
FROM track_audio_files taf
JOIN tracks t ON t.id = taf.track_id
WHERE taf.track_id = CAST(:track_id AS uuid)
  AND t.status = 'published'
ORDER BY taf.created_at DESC
LIMIT 1
"""
        ),
        {"track_id": track_id},
    )
    audio = audio_row.mappings().first()
    if audio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file not found.")

    file_path = resolve_local_storage_path(audio["storage_url"])
    if file_path is None or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file is not available for download.",
        )

    # Derive a clean filename from the track title
    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in audio["title"]).strip()
    filename = f"{safe_title or 'track'}{file_path.suffix}"

    return FileResponse(
        path=str(file_path),
        media_type="audio/mpeg",
        filename=filename,
        content_disposition_type="attachment",
    )


# ── List licenses ─────────────────────────────────────────────────────────────

@router.get("/export/licenses", summary="List the current user's export licenses")
async def list_export_licenses(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(_require_auth),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = await db.execute(
        text(
            """
SELECT
  el.id,
  el.license_type,
  el.subject_type,
  el.subject_id,
  el.price_paid_cents,
  el.payment_status,
  el.created_at,
  CASE el.subject_type
    WHEN 'track' THEN (SELECT title FROM tracks  WHERE id = el.subject_id)
    WHEN 'album' THEN (SELECT title FROM albums  WHERE id = el.subject_id)
  END AS subject_title
FROM export_licenses el
WHERE el.user_id = CAST(:user_id AS uuid)
  AND el.payment_status = 'completed'
ORDER BY el.created_at DESC
LIMIT :limit OFFSET :offset
"""
        ),
        {"user_id": current_user["id"], "limit": limit, "offset": offset},
    )
    count_row = await db.execute(
        text(
            """
SELECT count(*) FROM export_licenses
WHERE user_id = CAST(:user_id AS uuid) AND payment_status = 'completed'
"""
        ),
        {"user_id": current_user["id"]},
    )
    items = rows.mappings().all()
    return {
        "items": [
            {**_serialize_license(r), "subjectTitle": r["subject_title"]}
            for r in items
        ],
        "total": int(count_row.scalar_one()),
        "limit": limit,
        "offset": offset,
    }
