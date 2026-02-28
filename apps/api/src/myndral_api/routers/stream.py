from fastapi import APIRouter

router = APIRouter()


@router.get("/{track_id}", summary="Stream audio for a track")
async def stream_track(track_id: str) -> None:
    # TODO: validate auth, fetch audio_url from DB, proxy or redirect to object storage.
    # Support byte-range requests for seek support.
    raise NotImplementedError
