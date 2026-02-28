from fastapi import APIRouter

router = APIRouter()


@router.get("/me", summary="Get current user profile")
async def get_me() -> dict:
    raise NotImplementedError


@router.patch("/me", summary="Update current user profile")
async def update_me() -> dict:
    raise NotImplementedError


@router.get("/me/tracks", summary="Get current user's liked tracks")
async def get_liked_tracks() -> dict:
    raise NotImplementedError


@router.get("/me/albums", summary="Get current user's saved albums")
async def get_saved_albums() -> dict:
    raise NotImplementedError


@router.get("/me/artists", summary="Get artists followed by current user")
async def get_followed_artists() -> dict:
    raise NotImplementedError


@router.get("/me/playlists", summary="Get current user's playlists")
async def get_my_playlists() -> dict:
    raise NotImplementedError


@router.get("/me/history", summary="Get listening history")
async def get_history() -> dict:
    raise NotImplementedError
