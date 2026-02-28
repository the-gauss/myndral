from fastapi import APIRouter

router = APIRouter()


@router.post("/register", summary="Register a new user")
async def register() -> dict:
    # TODO: accept RegisterRequest schema, hash password, insert user, return tokens
    raise NotImplementedError


@router.post("/login", summary="Login and obtain JWT tokens")
async def login() -> dict:
    # TODO: validate credentials, return access + refresh tokens
    raise NotImplementedError


@router.post("/refresh", summary="Refresh access token")
async def refresh() -> dict:
    # TODO: validate refresh token, issue new access token
    raise NotImplementedError


@router.post("/logout", summary="Invalidate refresh token")
async def logout() -> dict:
    # TODO: revoke refresh token in Redis
    raise NotImplementedError
