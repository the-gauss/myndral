from fastapi import APIRouter, Depends, HTTPException, status

from myndral_api.auth_utils import get_current_user

router = APIRouter()


@router.get("/me", summary="Get current user profile")
async def get_me(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user


@router.patch("/me", summary="Update current user profile")
async def update_me() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )


@router.get("/me/tracks", summary="Get current user's liked tracks")
async def get_liked_tracks() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )


@router.get("/me/albums", summary="Get current user's saved albums")
async def get_saved_albums() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )


@router.get("/me/artists", summary="Get artists followed by current user")
async def get_followed_artists() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )


@router.get("/me/playlists", summary="Get current user's playlists")
async def get_my_playlists() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )


@router.get("/me/history", summary="Get listening history")
async def get_history() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )
