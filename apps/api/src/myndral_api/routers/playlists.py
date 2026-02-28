from fastapi import APIRouter

router = APIRouter()


@router.post("/", summary="Create a playlist")
async def create_playlist() -> dict:
    raise NotImplementedError


@router.get("/{playlist_id}", summary="Get playlist by ID")
async def get_playlist(playlist_id: str) -> dict:
    raise NotImplementedError


@router.patch("/{playlist_id}", summary="Update playlist metadata")
async def update_playlist(playlist_id: str) -> dict:
    raise NotImplementedError


@router.delete("/{playlist_id}", summary="Delete a playlist")
async def delete_playlist(playlist_id: str) -> dict:
    raise NotImplementedError


@router.post("/{playlist_id}/tracks", summary="Add tracks to playlist")
async def add_tracks(playlist_id: str) -> dict:
    raise NotImplementedError


@router.delete("/{playlist_id}/tracks", summary="Remove tracks from playlist")
async def remove_tracks(playlist_id: str) -> dict:
    raise NotImplementedError


@router.put("/{playlist_id}/tracks/reorder", summary="Reorder playlist tracks")
async def reorder_tracks(playlist_id: str) -> dict:
    raise NotImplementedError
