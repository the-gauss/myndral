from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import create_access_token, fetch_user_for_login, to_public_user, verify_password
from myndral_api.db.session import get_db

router = APIRouter()


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


@router.post("/register", summary="Register a new user")
async def register() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Registration endpoint is not implemented yet.",
    )


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
