import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import (
    create_access_token,
    fetch_user_for_login,
    hash_password,
    to_public_user,
    verify_password,
)
from myndral_api.config import get_settings
from myndral_api.db.session import get_db

# Roles that grant access to the internal studio.
_STUDIO_ROLES = {"content_editor", "content_reviewer", "admin"}

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # Display name is optional; defaults to username if omitted.
    display_name: str | None = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


@router.post("/register", summary="Register a new user account", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    # Enforce uniqueness up-front with a clear 409 rather than letting the DB
    # constraint bubble up as an opaque 500.
    conflict = await db.execute(
        text(
            "SELECT 1 FROM users WHERE lower(username) = lower(:u) OR lower(email) = lower(:e) LIMIT 1"
        ),
        {"u": payload.username, "e": str(payload.email)},
    )
    if conflict.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered.",
        )

    hashed_password = hash_password(payload.password)
    display_name = (payload.display_name or "").strip() or payload.username

    result = await db.execute(
        text(
            """
            INSERT INTO users (username, email, display_name, hashed_password, role, is_active)
            VALUES (:username, :email, :display_name, :hashed_password, 'listener', true)
            RETURNING
              id::text,
              username,
              email,
              display_name,
              avatar_url,
              role::text,
              is_active,
              created_at
            """
        ),
        {
            "username": payload.username,
            "email": str(payload.email),
            "display_name": display_name,
            "hashed_password": hashed_password,
        },
    )
    await db.commit()

    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User creation failed.")

    # New accounts always start on the free plan (no subscription row yet).
    user_data = {**row, "subscription_plan": "free"}

    access_token, expires_in = create_access_token(row["id"])
    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "expiresIn": expires_in,
        "user": to_public_user(user_data),
    }


@router.post("/login", summary="Login and obtain JWT tokens")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    identity = payload.username.strip()
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username/email or password",
    )
    if not identity:
        raise invalid_credentials

    user = await fetch_user_for_login(db, identity)
    if user is None or not user["is_active"]:
        raise invalid_credentials

    if not verify_password(payload.password, user["hashed_password"]):
        raise invalid_credentials

    access_token, expires_in = create_access_token(user["id"])
    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "expiresIn": expires_in,
        "user": to_public_user(user),
    }


def _resolve_studio_token(access_token: str) -> str:
    """Validate a studio access token and return the role it grants.

    Raises 403 if the token is not recognised or the token map is empty.
    """
    raw = get_settings().studio_access_tokens.strip()
    token_map: dict[str, str] = json.loads(raw) if raw else {}
    role = token_map.get(access_token)
    if not role or role not in _STUDIO_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid studio access token.",
        )
    return role


class StudioRegisterRequest(BaseModel):
    """Register a brand-new user account and immediately grant a studio role."""
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=100)
    # The pre-shared token that determines which role is granted.
    studio_access_token: str = Field(min_length=1)


class StudioClaimRequest(BaseModel):
    """Let an existing user (e.g. a listener) claim a studio role."""
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)
    studio_access_token: str = Field(min_length=1)


@router.post(
    "/studio-register",
    summary="Register a new account with a studio access token",
    status_code=status.HTTP_201_CREATED,
)
async def studio_register(payload: StudioRegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    # Validate the token first — fail fast before touching the DB.
    role = _resolve_studio_token(payload.studio_access_token)

    conflict = await db.execute(
        text(
            "SELECT 1 FROM users WHERE lower(username) = lower(:u) OR lower(email) = lower(:e) LIMIT 1"
        ),
        {"u": payload.username, "e": str(payload.email)},
    )
    if conflict.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered.",
        )

    hashed_password = hash_password(payload.password)
    display_name = (payload.display_name or "").strip() or payload.username

    result = await db.execute(
        text(
            """
            INSERT INTO users (username, email, display_name, hashed_password, role, is_active)
            VALUES (:username, :email, :display_name, :hashed_password, :role, true)
            RETURNING
              id::text,
              username,
              email,
              display_name,
              avatar_url,
              role::text,
              is_active,
              created_at
            """
        ),
        {
            "username": payload.username,
            "email": str(payload.email),
            "display_name": display_name,
            "hashed_password": hashed_password,
            "role": role,
        },
    )
    await db.commit()

    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User creation failed.")

    user_data = {**row, "subscription_plan": "free"}
    access_token, expires_in = create_access_token(row["id"])
    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "expiresIn": expires_in,
        "user": to_public_user(user_data),
    }


@router.post(
    "/studio-claim",
    summary="Upgrade an existing user's role using a studio access token",
)
async def studio_claim(payload: StudioClaimRequest, db: AsyncSession = Depends(get_db)) -> dict:
    # Validate the token first.
    new_role = _resolve_studio_token(payload.studio_access_token)

    identity = payload.username.strip()
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username/email or password.",
    )

    user = await fetch_user_for_login(db, identity)
    if user is None or not user["is_active"]:
        raise invalid_credentials
    if not verify_password(payload.password, user["hashed_password"]):
        raise invalid_credentials

    # Apply the role.  Always write so the token acts as an explicit grant even
    # if the user already has that role (idempotent, safe to re-run).
    await db.execute(
        text("UPDATE users SET role = :role WHERE id = :uid"),
        {"role": new_role, "uid": user["id"]},
    )
    await db.commit()

    # Re-fetch so the returned user object reflects the updated role.
    from myndral_api.auth_utils import fetch_user_by_id
    updated = await fetch_user_by_id(db, user["id"])
    if updated is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Role update failed.")

    access_token, expires_in = create_access_token(updated["id"])
    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "expiresIn": expires_in,
        "user": to_public_user(updated),
    }


@router.post("/refresh", summary="Refresh access token")
async def refresh() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Refresh endpoint is not implemented yet.",
    )


@router.post("/logout", summary="Invalidate refresh token")
async def logout() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Logout endpoint is not implemented yet.",
    )
