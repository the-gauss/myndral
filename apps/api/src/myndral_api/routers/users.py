from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import get_current_user
from myndral_api.db.session import get_db
from myndral_api.routers.playlists import _fetch_playlist_tracks, _serialize_playlist

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
async def get_my_playlists(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    user_id = current_user["id"]
    rows = (
        await db.execute(
            text(
                """
SELECT DISTINCT
  p.id::text AS id,
  p.name,
  p.description,
  p.cover_url,
  p.owner_id::text AS owner_id,
  p.is_public,
  p.is_ai_curated,
  p.created_at,
  p.updated_at
FROM playlists p
LEFT JOIN user_followed_playlists ufp
  ON ufp.playlist_id = p.id
  AND ufp.user_id = :user_id
WHERE p.owner_id = :user_id
  OR p.is_public = true
  OR ufp.user_id IS NOT NULL
ORDER BY p.updated_at DESC
LIMIT :limit OFFSET :offset
"""
            ),
            {"user_id": user_id, "limit": limit, "offset": offset},
        )
    ).mappings().all()
    total = int(
        (
            await db.execute(
                text(
                    """
SELECT count(*)
FROM playlists p
LEFT JOIN user_followed_playlists ufp
  ON ufp.playlist_id = p.id
  AND ufp.user_id = :user_id
WHERE p.owner_id = :user_id
  OR p.is_public = true
  OR ufp.user_id IS NOT NULL
"""
                ),
                {"user_id": user_id},
            )
        ).scalar_one()
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        tracks = await _fetch_playlist_tracks(db, row["id"])
        items.append(_serialize_playlist(row, tracks))
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/me/history", summary="Get listening history")
async def get_history() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint is not implemented yet.",
    )
