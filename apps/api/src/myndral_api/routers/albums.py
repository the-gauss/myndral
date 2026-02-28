from fastapi import APIRouter

router = APIRouter()


@router.get("/", summary="List albums (paginated)")
async def list_albums() -> dict:
    raise NotImplementedError


@router.get("/new-releases", summary="Get new releases")
async def get_new_releases() -> dict:
    raise NotImplementedError


@router.get("/{album_id}", summary="Get album by ID")
async def get_album(album_id: str) -> dict:
    raise NotImplementedError


@router.get("/{album_id}/tracks", summary="Get album tracks")
async def get_album_tracks(album_id: str) -> dict:
    raise NotImplementedError


@router.put("/{album_id}/save", summary="Save album to library")
async def save_album(album_id: str) -> dict:
    raise NotImplementedError


@router.delete("/{album_id}/save", summary="Remove album from library")
async def unsave_album(album_id: str) -> dict:
    raise NotImplementedError
