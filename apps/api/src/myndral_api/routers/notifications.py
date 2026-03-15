from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db

router = APIRouter()

_INTERNAL_ROLES: set[str] = {"content_editor", "content_reviewer", "admin"}


async def _require_internal(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in _INTERNAL_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Internal users only.")
    return current_user


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _serialize_notification(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "trackId": str(row["track_id"]) if row["track_id"] else None,
        "trackTitle": row["track_title"],
        "message": row["message"],
        "isRead": row["is_read"],
        "createdAt": _iso(row["created_at"]),
    }


@router.get("/notifications", summary="List in-app notifications for the current user")
async def list_notifications(
    unread_only: bool = Query(default=False, alias="unreadOnly"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(_require_internal),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rows = await db.execute(
        text(
            """
SELECT
  n.id,
  n.track_id,
  t.title  AS track_title,
  n.message,
  n.is_read,
  n.created_at
FROM notifications n
LEFT JOIN tracks t ON t.id = n.track_id
WHERE n.recipient_id = CAST(:recipient_id AS uuid)
  AND (:unread_only = false OR n.is_read = false)
ORDER BY n.created_at DESC
LIMIT :limit OFFSET :offset
"""
        ),
        {
            "recipient_id": current_user["id"],
            "unread_only": unread_only,
            "limit": limit,
            "offset": offset,
        },
    )

    count_row = await db.execute(
        text(
            """
SELECT count(*) FROM notifications
WHERE recipient_id = CAST(:recipient_id AS uuid)
  AND (:unread_only = false OR is_read = false)
"""
        ),
        {"recipient_id": current_user["id"], "unread_only": unread_only},
    )
    total = int(count_row.scalar_one())

    unread_row = await db.execute(
        text(
            "SELECT count(*) FROM notifications WHERE recipient_id = CAST(:id AS uuid) AND NOT is_read"
        ),
        {"id": current_user["id"]},
    )
    unread_count = int(unread_row.scalar_one())

    return {
        "items": [_serialize_notification(r) for r in rows.mappings().all()],
        "total": total,
        "unreadCount": unread_count,
        "limit": limit,
        "offset": offset,
    }


@router.patch(
    "/notifications/{notification_id}/read",
    summary="Mark a single notification as read",
)
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(_require_internal),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
UPDATE notifications
SET is_read = true
WHERE id = CAST(:notification_id AS uuid)
  AND recipient_id = CAST(:recipient_id AS uuid)
RETURNING id::text
"""
        ),
        {"notification_id": notification_id, "recipient_id": current_user["id"]},
    )
    await db.commit()
    if result.first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return {"id": notification_id, "isRead": True}


@router.post(
    "/notifications/read-all",
    summary="Mark all notifications as read for the current user",
)
async def mark_all_notifications_read(
    current_user: dict = Depends(_require_internal),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
UPDATE notifications
SET is_read = true
WHERE recipient_id = CAST(:recipient_id AS uuid)
  AND is_read = false
"""
        ),
        {"recipient_id": current_user["id"]},
    )
    await db.commit()
    updated = result.rowcount
    return {"markedRead": updated}
