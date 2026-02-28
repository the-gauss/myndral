from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.config import get_settings
from myndral_api.db.session import get_db

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"

USER_SELECT_BASE = """
SELECT
  u.id::text AS id,
  u.username,
  u.email,
  u.display_name,
  u.avatar_url,
  u.role::text AS role,
  u.hashed_password,
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


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Prefer direct bcrypt check first to avoid passlib backend incompatibility
    # warnings with newer bcrypt package versions.
    try:
        if bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8")):
            return True
    except Exception:
        pass

    try:
        if pwd_context.verify(plain_password, hashed_password):
            return True
    except Exception:
        return False

    return False


def create_access_token(user_id: str) -> tuple[str, int]:
    expires_in = settings.access_token_expire_minutes * 60
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
    payload = {"sub": user_id, "type": "access", "exp": expires_at}
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from exc

    if payload.get("type") != "access" or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token payload",
        )
    return payload


def to_public_user(row: RowMapping[str, Any]) -> dict[str, Any]:
    created_at = row["created_at"]
    created_at_str = created_at.isoformat() if isinstance(created_at, datetime) else str(created_at)
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "displayName": row["display_name"],
        "avatarUrl": row["avatar_url"],
        "role": row["role"],
        "subscriptionPlan": row["subscription_plan"],
        "createdAt": created_at_str,
    }


async def fetch_user_for_login(db: AsyncSession, identity: str) -> RowMapping[str, Any] | None:
    query = text(
        USER_SELECT_BASE
        + """
WHERE lower(u.username) = lower(:identity) OR lower(u.email) = lower(:identity)
LIMIT 1
"""
    )
    result = await db.execute(query, {"identity": identity})
    return result.mappings().first()


async def fetch_user_by_id(db: AsyncSession, user_id: str) -> RowMapping[str, Any] | None:
    query = text(USER_SELECT_BASE + "\nWHERE u.id = :user_id\nLIMIT 1\n")
    result = await db.execute(query, {"user_id": user_id})
    return result.mappings().first()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    payload = decode_access_token(credentials.credentials)
    user = await fetch_user_by_id(db, str(payload["sub"]))
    if user is None or not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is not available",
        )
    return to_public_user(user)
