from fastapi import APIRouter

router = APIRouter()


@router.get("/", summary="List tracks (paginated)")
async def list_tracks() -> dict:
    raise NotImplementedError


@router.get("/{track_id}", summary="Get track by ID")
async def get_track(track_id: str) -> dict:
    raise NotImplementedError


@router.get("/{track_id}/lyrics", summary="Get track lyrics")
async def get_lyrics(track_id: str) -> dict:
    raise NotImplementedError


@router.put("/{track_id}/like", summary="Like a track")
async def like_track(track_id: str) -> dict:
    raise NotImplementedError


@router.delete("/{track_id}/like", summary="Unlike a track")
async def unlike_track(track_id: str) -> dict:
    raise NotImplementedError


@router.post("/{track_id}/play", summary="Record a play event")
async def record_play(track_id: str) -> dict:
    # TODO: write to play_history, increment play_count
    raise NotImplementedError
