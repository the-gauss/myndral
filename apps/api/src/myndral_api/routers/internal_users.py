from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db

router = APIRouter()

UserRole = Literal["listener", "content_editor", "content_reviewer", "admin"]
SubscriptionPlan = Literal["free", "premium_monthly", "premium_annual"]


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class AdminUserUpdateRequest(CamelModel):
    role: UserRole | None = None
    subscription_plan: SubscriptionPlan | None = Field(default=None, alias="subscriptionPlan")
    is_active: bool | None = Field(default=None, alias="isActive")


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _derive_privileges(role: str, subscription_plan: str) -> list[str]:
    privileges = {
        "stream_music",
        "create_playlists",
        "library_management",
        "favorites_management",
    }
    if role in {"content_editor", "content_reviewer", "admin"}:
        privileges.update({"studio_access", "catalog_read"})
    if role in {"content_editor", "admin"}:
        privileges.update({"catalog_write", "music_generation"})
    if role in {"content_reviewer", "admin"}:
        privileges.update({"staging_review", "archive_restore"})
    if role == "admin":
        privileges.update({"user_management", "subscription_override", "platform_admin"})
    if subscription_plan in {"premium_monthly", "premium_annual"}:
        privileges.update({"premium_exports", "premium_themes", "premium_audio"})
    return sorted(privileges)


async def _require_admin_user(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )
    return current_user


def _base_user_select() -> str:
    return """
SELECT
  u.id::text AS id,
  u.username,
  u.email,
  u.display_name,
  u.avatar_url,
  u.role::text AS role,
  u.is_active,
  u.created_at,
  COALESCE((
    SELECT sp.slug
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.user_id = u.id
      AND s.status IN ('trialing', 'active', 'past_due')
      AND (s.current_period_end = 'infinity'::timestamptz OR s.current_period_end > now())
    ORDER BY s.current_period_end DESC
    LIMIT 1
  ), 'free') AS subscription_plan
FROM users u
"""


def _serialize_user(row: Any) -> dict[str, Any]:
    subscription_plan = row["subscription_plan"]
    role = row["role"]
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "displayName": row["display_name"],
        "avatarUrl": row["avatar_url"],
        "role": role,
        "subscriptionPlan": subscription_plan,
        "isActive": bool(row["is_active"]),
        "createdAt": _iso(row["created_at"]),
        "privileges": _derive_privileges(role, subscription_plan),
    }


async def _fetch_user_row(db: AsyncSession, user_id: str) -> Any | None:
    row = (
        await db.execute(
            text(_base_user_select() + "\nWHERE u.id = :user_id\nLIMIT 1\n"),
            {"user_id": user_id},
        )
    ).mappings().first()
    return row


async def _set_subscription_plan(db: AsyncSession, user_id: str, plan_slug: str) -> None:
    if plan_slug == "free":
        await db.execute(
            text(
                """
UPDATE subscriptions
SET
  status = 'expired',
  current_period_end = now(),
  cancel_at_period_end = true,
  cancelled_at = COALESCE(cancelled_at, now())
WHERE user_id = :user_id
  AND status IN ('trialing', 'active', 'past_due')
  AND (current_period_end = 'infinity'::timestamptz OR current_period_end > now())
"""
            ),
            {"user_id": user_id},
        )
        return

    plan_id = (
        await db.execute(
            text(
                """
SELECT id::text
FROM subscription_plans
WHERE slug = :slug
  AND is_active = true
LIMIT 1
"""
            ),
            {"slug": plan_slug},
        )
    ).scalar_one_or_none()
    if plan_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription plan does not exist.",
        )

    await db.execute(
        text(
            """
UPDATE subscriptions
SET
  status = 'expired',
  current_period_end = now(),
  cancel_at_period_end = true,
  cancelled_at = COALESCE(cancelled_at, now())
WHERE user_id = :user_id
  AND status IN ('trialing', 'active', 'past_due')
  AND (current_period_end = 'infinity'::timestamptz OR current_period_end > now())
"""
        ),
        {"user_id": user_id},
    )
    await db.execute(
        text(
            """
INSERT INTO subscriptions (
  user_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end
)
VALUES (
  :user_id,
  :plan_id,
  'active',
  now(),
  'infinity'::timestamptz,
  false
)
"""
        ),
        {"user_id": user_id, "plan_id": plan_id},
    )


@router.get("/subscription-plans", summary="List active subscription plans for admin tooling")
async def list_subscription_plans(
    _: dict[str, Any] = Depends(_require_admin_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            text(
                """
SELECT
  slug,
  display_name,
  price_cents,
  currency,
  billing_interval::text AS billing_interval,
  features,
  sort_order
FROM subscription_plans
WHERE is_active = true
ORDER BY sort_order ASC, display_name ASC
"""
            )
        )
    ).mappings().all()
    return [
        {
            "slug": row["slug"],
            "displayName": row["display_name"],
            "priceCents": int(row["price_cents"] or 0),
            "currency": row["currency"],
            "billingInterval": row["billing_interval"],
            "features": row["features"] or {},
            "sortOrder": int(row["sort_order"] or 0),
        }
        for row in rows
    ]


@router.get("/users", summary="List platform users for admin management")
async def list_users(
    q: str | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    subscription_plan: SubscriptionPlan | None = Query(default=None, alias="subscriptionPlan"),
    is_active: bool | None = Query(default=None, alias="isActive"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: dict[str, Any] = Depends(_require_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    normalized_query = q.strip().lower() if q else None
    where_clauses: list[str] = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if normalized_query:
        where_clauses.append(
            """
(
  lower(username) LIKE :pattern
  OR lower(email) LIKE :pattern
  OR lower(display_name) LIKE :pattern
)
"""
        )
        params["pattern"] = f"%{normalized_query}%"
    if role is not None:
        where_clauses.append("role = :role")
        params["role"] = role
    if subscription_plan is not None:
        where_clauses.append("subscription_plan = :subscription_plan")
        params["subscription_plan"] = subscription_plan
    if is_active is not None:
        where_clauses.append("is_active = :is_active")
        params["is_active"] = is_active

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query_sql = f"""
WITH user_rows AS (
  {_base_user_select()}
)
SELECT *
FROM user_rows
{where_sql}
ORDER BY created_at DESC, username ASC
LIMIT :limit OFFSET :offset
"""
    rows = (await db.execute(text(query_sql), params)).mappings().all()
    total = int(
        (
            await db.execute(
                text(
                    f"""
WITH user_rows AS (
  {_base_user_select()}
)
SELECT count(*)
FROM user_rows
{where_sql}
"""
                ),
                params,
            )
        ).scalar_one()
    )
    return {
        "items": [_serialize_user(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/users/{user_id}", summary="Update a user's role, plan, or active status")
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    current_user: dict[str, Any] = Depends(_require_admin_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    existing = await _fetch_user_row(db, user_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_id == current_user["id"]:
        if payload.role is not None and payload.role != existing["role"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins cannot change their own role from this panel.",
            )
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins cannot deactivate themselves from this panel.",
            )

    if payload.role is not None and payload.role != existing["role"]:
        await db.execute(
            text("UPDATE users SET role = :role WHERE id = :user_id"),
            {"role": payload.role, "user_id": user_id},
        )
    if payload.is_active is not None and payload.is_active != existing["is_active"]:
        await db.execute(
            text("UPDATE users SET is_active = :is_active WHERE id = :user_id"),
            {"is_active": payload.is_active, "user_id": user_id},
        )
    if payload.subscription_plan is not None and payload.subscription_plan != existing["subscription_plan"]:
        await _set_subscription_plan(db, user_id, payload.subscription_plan)

    updated = await _fetch_user_row(db, user_id)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User update failed.",
        )
    return _serialize_user(updated)
