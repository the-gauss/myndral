from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/", summary="Search across artists, albums, and tracks")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    type: str = Query("track,album,artist", description="Comma-separated result types"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> dict:
    # TODO: implement full-text search via pg_trgm or Typesense
    raise NotImplementedError
