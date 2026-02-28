from fastapi import APIRouter

router = APIRouter()


@router.get("/", summary="List artists (paginated)")
async def list_artists() -> dict:
    raise NotImplementedError


@router.get("/{artist_id}", summary="Get artist by ID")
async def get_artist(artist_id: str) -> dict:
    raise NotImplementedError


@router.get("/{artist_id}/albums", summary="Get artist's albums")
async def get_artist_albums(artist_id: str) -> dict:
    raise NotImplementedError


@router.get("/{artist_id}/top-tracks", summary="Get artist's top tracks")
async def get_artist_top_tracks(artist_id: str) -> dict:
    raise NotImplementedError


@router.put("/{artist_id}/follow", summary="Follow an artist")
async def follow_artist(artist_id: str) -> dict:
    raise NotImplementedError


@router.delete("/{artist_id}/follow", summary="Unfollow an artist")
async def unfollow_artist(artist_id: str) -> dict:
    raise NotImplementedError
