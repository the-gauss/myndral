from datetime import UTC, date, datetime
import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import (
    create_access_token,
    fetch_user_for_login,
    get_current_user,
    to_public_user,
    verify_password,
)
from myndral_api.db.session import get_db
from myndral_api.media_utils import (
    infer_local_audio_metadata,
    is_local_storage_url,
    is_remote_storage_url,
)

router = APIRouter()

ContentStatus = Literal["draft", "review", "published", "archived"]
AlbumType = Literal["album", "single", "ep", "compilation"]
TrackArtistRole = Literal["primary", "featured", "producer", "remixer"]
AudioQuality = Literal["low_128", "standard_256", "high_320", "lossless"]
AudioFormat = Literal["mp3", "aac", "ogg", "flac", "opus"]
InternalRole = Literal["content_editor", "content_reviewer", "admin"]

INTERNAL_ROLES: set[str] = {"content_editor", "content_reviewer", "admin"}


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class LoginRequest(CamelModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


class ArtistCreateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = None
    image_url: str | None = Field(default=None, alias="imageUrl")
    header_image_url: str | None = Field(default=None, alias="headerImageUrl")
    status: ContentStatus = "draft"
    persona_prompt: str | None = Field(default=None, alias="personaPrompt")
    style_tags: list[str] = Field(default_factory=list, alias="styleTags")
    genre_ids: list[str] = Field(default_factory=list, alias="genreIds")


class ArtistUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = None
    image_url: str | None = Field(default=None, alias="imageUrl")
    header_image_url: str | None = Field(default=None, alias="headerImageUrl")
    status: ContentStatus | None = None
    persona_prompt: str | None = Field(default=None, alias="personaPrompt")
    style_tags: list[str] | None = Field(default=None, alias="styleTags")
    genre_ids: list[str] | None = Field(default=None, alias="genreIds")


class AlbumCreateRequest(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    artist_id: str = Field(alias="artistId")
    cover_url: str | None = Field(default=None, alias="coverUrl")
    description: str | None = None
    release_date: date | None = Field(default=None, alias="releaseDate")
    album_type: AlbumType = Field(default="album", alias="albumType")
    status: ContentStatus = "draft"
    genre_ids: list[str] = Field(default_factory=list, alias="genreIds")


class AlbumUpdateRequest(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    artist_id: str | None = Field(default=None, alias="artistId")
    cover_url: str | None = Field(default=None, alias="coverUrl")
    description: str | None = None
    release_date: date | None = Field(default=None, alias="releaseDate")
    album_type: AlbumType | None = Field(default=None, alias="albumType")
    status: ContentStatus | None = None
    genre_ids: list[str] | None = Field(default=None, alias="genreIds")


class TrackArtistLinkInput(CamelModel):
    artist_id: str = Field(alias="artistId")
    role: TrackArtistRole = "featured"
    display_order: int = Field(default=0, alias="displayOrder", ge=0)


class TrackAudioInput(CamelModel):
    quality: AudioQuality
    format: AudioFormat = "mp3"
    storage_url: str = Field(alias="storageUrl", min_length=1)
    bitrate_kbps: int | None = Field(default=None, alias="bitrateKbps", ge=1)
    sample_rate_hz: int | None = Field(default=None, alias="sampleRateHz", ge=1)
    channels: int = Field(default=2, ge=1, le=2)
    file_size_bytes: int | None = Field(default=None, alias="fileSizeBytes", ge=1)
    duration_ms: int | None = Field(default=None, alias="durationMs", ge=0)
    checksum_sha256: str | None = Field(default=None, alias="checksumSha256")


class AudioInspectRequest(CamelModel):
    storage_url: str = Field(alias="storageUrl", min_length=1)


class LyricsInput(CamelModel):
    content: str = Field(min_length=1)
    language: str = Field(default="en", min_length=2, max_length=2)
    has_timestamps: bool = Field(default=False, alias="hasTimestamps")


class TrackCreateRequest(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    album_id: str = Field(alias="albumId")
    primary_artist_id: str | None = Field(default=None, alias="primaryArtistId")
    track_number: int = Field(default=1, alias="trackNumber", ge=1)
    disc_number: int = Field(default=1, alias="discNumber", ge=1)
    duration_ms: int = Field(default=0, alias="durationMs", ge=0)
    explicit: bool = False
    status: ContentStatus = "draft"
    genre_ids: list[str] = Field(default_factory=list, alias="genreIds")
    artist_links: list[TrackArtistLinkInput] = Field(default_factory=list, alias="artistLinks")
    lyrics: LyricsInput | None = None
    audio_files: list[TrackAudioInput] = Field(default_factory=list, alias="audioFiles")


class TrackUpdateRequest(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    album_id: str | None = Field(default=None, alias="albumId")
    primary_artist_id: str | None = Field(default=None, alias="primaryArtistId")
    track_number: int | None = Field(default=None, alias="trackNumber", ge=1)
    disc_number: int | None = Field(default=None, alias="discNumber", ge=1)
    duration_ms: int | None = Field(default=None, alias="durationMs", ge=0)
    explicit: bool | None = None
    status: ContentStatus | None = None
    genre_ids: list[str] | None = Field(default=None, alias="genreIds")
    artist_links: list[TrackArtistLinkInput] | None = Field(default=None, alias="artistLinks")
    lyrics: LyricsInput | None = None
    clear_lyrics: bool = Field(default=False, alias="clearLyrics")
    audio_files: list[TrackAudioInput] | None = Field(default=None, alias="audioFiles")
    replace_audio_files: bool = Field(default=False, alias="replaceAudioFiles")


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _slugify(raw: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")
    return slug or "untitled"


def _is_internal_role(role: str) -> bool:
    return role in INTERNAL_ROLES


def _validate_audio_url(value: str) -> None:
    if is_local_storage_url(value) or is_remote_storage_url(value):
        return
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=(
            "audioFiles[].storageUrl must be a local data path "
            "('data/...', '/data/...', 'file://...') or remote URL."
        ),
    )


def _validate_media_url(value: str, field_name: str) -> None:
    if is_local_storage_url(value) or is_remote_storage_url(value):
        return
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=(
            f"{field_name} must be a local data path "
            "('data/...', '/data/...', 'file://...') or remote URL."
        ),
    )


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _enrich_audio_files(audio_files: list[TrackAudioInput]) -> int | None:
    inferred_duration_ms: int | None = None
    for audio in audio_files:
        _validate_audio_url(audio.storage_url)
        inferred = infer_local_audio_metadata(audio.storage_url)
        if inferred is None:
            continue

        inferred_format = inferred.get("format")
        if inferred_format and audio.format == "mp3" and inferred_format in {"aac", "ogg", "flac", "opus"}:
            # Most forms default to mp3; prefer inferred format for local assets.
            audio.format = inferred_format

        if audio.duration_ms is None and inferred.get("duration_ms") is not None:
            audio.duration_ms = int(inferred["duration_ms"])
        if audio.bitrate_kbps is None and inferred.get("bitrate_kbps") is not None:
            audio.bitrate_kbps = int(inferred["bitrate_kbps"])
        if audio.sample_rate_hz is None and inferred.get("sample_rate_hz") is not None:
            audio.sample_rate_hz = int(inferred["sample_rate_hz"])
        if inferred.get("channels") is not None:
            audio.channels = int(inferred["channels"])
        if audio.file_size_bytes is None and inferred.get("file_size_bytes") is not None:
            audio.file_size_bytes = int(inferred["file_size_bytes"])
        if audio.checksum_sha256 is None and inferred.get("checksum_sha256") is not None:
            audio.checksum_sha256 = str(inferred["checksum_sha256"])
        if inferred_duration_ms is None and audio.duration_ms is not None:
            inferred_duration_ms = int(audio.duration_ms)
    return inferred_duration_ms


def _ensure_published_artist_requirements(
    status_value: ContentStatus,
    *,
    image_url: str | None,
    bio: str | None,
) -> None:
    if status_value != "published":
        return
    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Published artists require imageUrl (portrait).",
        )
    if not bio:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Published artists require a non-empty bio.",
        )


def _ensure_published_album_requirements(
    status_value: ContentStatus,
    *,
    cover_url: str | None,
    release_date: date | None,
) -> None:
    if status_value != "published":
        return
    if not cover_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Published albums require coverUrl (album art).",
        )
    if release_date is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Published albums require releaseDate.",
        )


def _ensure_published_track_requirements(
    status_value: ContentStatus,
    *,
    duration_ms: int,
    has_audio_files: bool,
) -> None:
    if status_value != "published":
        return
    if not has_audio_files:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Published tracks require at least one audio file.",
        )
    if duration_ms <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Published tracks require durationMs > 0.",
        )


def _integrity_exception(exc: IntegrityError, default_detail: str) -> HTTPException:
    message = str(exc.orig).lower()
    if "duplicate key value violates unique constraint" in message:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=default_detail)
    if "violates foreign key constraint" in message:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more referenced records do not exist.",
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=default_detail)


def _serialize_artist(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "bio": row["bio"],
        "imageUrl": row["image_url"],
        "headerImageUrl": row["header_image_url"],
        "status": row["status"],
        "personaPrompt": row["persona_prompt"],
        "styleTags": row["style_tags"] or [],
        "genreIds": row["genre_ids"] or [],
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }


def _serialize_album(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "slug": row["slug"],
        "artistId": row["artist_id"],
        "artistName": row["artist_name"],
        "coverUrl": row["cover_url"],
        "description": row["description"],
        "releaseDate": _iso(row["release_date"]),
        "albumType": row["album_type"],
        "status": row["status"],
        "trackCount": row["track_count"],
        "genreIds": row["genre_ids"] or [],
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }


def _serialize_track(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "albumId": row["album_id"],
        "albumTitle": row["album_title"],
        "primaryArtistId": row["primary_artist_id"],
        "primaryArtistName": row["primary_artist_name"],
        "trackNumber": row["track_number"],
        "discNumber": row["disc_number"],
        "durationMs": row["duration_ms"],
        "explicit": row["explicit"],
        "status": row["status"],
        "genreIds": row["genre_ids"] or [],
        "artistLinks": row["artist_links"] or [],
        "audioFiles": row["audio_files"] or [],
        "lyrics": row["lyrics"],
        "createdAt": _iso(row["created_at"]),
        "updatedAt": _iso(row["updated_at"]),
    }


async def _require_internal_user(current_user: dict = Depends(get_current_user)) -> dict:
    if not _is_internal_role(current_user["role"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Internal employee role required.",
        )
    return current_user


async def _ensure_artist_slug(db: AsyncSession, preferred_slug: str) -> str:
    base = _slugify(preferred_slug)
    candidate = base
    index = 2
    while True:
        exists = await db.execute(text("SELECT 1 FROM artists WHERE slug = :slug"), {"slug": candidate})
        if exists.first() is None:
            return candidate
        candidate = f"{base}-{index}"
        index += 1


async def _ensure_album_slug(db: AsyncSession, artist_id: str, preferred_slug: str) -> str:
    base = _slugify(preferred_slug)
    candidate = base
    index = 2
    while True:
        exists = await db.execute(
            text("SELECT 1 FROM albums WHERE artist_id = :artist_id AND slug = :slug"),
            {"artist_id": artist_id, "slug": candidate},
        )
        if exists.first() is None:
            return candidate
        candidate = f"{base}-{index}"
        index += 1


async def _fetch_artist(db: AsyncSession, artist_id: str) -> dict[str, Any] | None:
    query = text(
        """
SELECT
  a.id::text AS id,
  a.name,
  a.slug,
  a.bio,
  a.image_url,
  a.header_image_url,
  a.status::text AS status,
  a.persona_prompt,
  a.style_tags,
  a.created_at,
  a.updated_at,
  COALESCE((
    SELECT array_agg(ag.genre_id::text ORDER BY ag.genre_id::text)
    FROM artist_genres ag
    WHERE ag.artist_id = a.id
  ), ARRAY[]::text[]) AS genre_ids
FROM artists a
WHERE a.id = :artist_id
LIMIT 1
"""
    )
    row = (await db.execute(query, {"artist_id": artist_id})).mappings().first()
    return _serialize_artist(row) if row else None


async def _fetch_album(db: AsyncSession, album_id: str) -> dict[str, Any] | None:
    query = text(
        """
SELECT
  a.id::text AS id,
  a.title,
  a.slug,
  a.artist_id::text AS artist_id,
  ar.name AS artist_name,
  a.cover_url,
  a.description,
  a.release_date,
  a.album_type::text AS album_type,
  a.status::text AS status,
  a.track_count,
  a.created_at,
  a.updated_at,
  COALESCE((
    SELECT array_agg(ag.genre_id::text ORDER BY ag.genre_id::text)
    FROM album_genres ag
    WHERE ag.album_id = a.id
  ), ARRAY[]::text[]) AS genre_ids
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
WHERE a.id = :album_id
LIMIT 1
"""
    )
    row = (await db.execute(query, {"album_id": album_id})).mappings().first()
    return _serialize_album(row) if row else None


async def _fetch_track(db: AsyncSession, track_id: str) -> dict[str, Any] | None:
    query = text(
        """
SELECT
  t.id::text AS id,
  t.title,
  t.album_id::text AS album_id,
  a.title AS album_title,
  t.primary_artist_id::text AS primary_artist_id,
  pa.name AS primary_artist_name,
  t.track_number,
  t.disc_number,
  t.duration_ms,
  t.explicit,
  t.status::text AS status,
  t.created_at,
  t.updated_at,
  COALESCE((
    SELECT array_agg(tg.genre_id::text ORDER BY tg.genre_id::text)
    FROM track_genres tg
    WHERE tg.track_id = t.id
  ), ARRAY[]::text[]) AS genre_ids,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'artistId', ta.artist_id::text,
        'role', ta.role::text,
        'displayOrder', ta.display_order
      )
      ORDER BY ta.display_order, ta.artist_id::text
    )
    FROM track_artists ta
    WHERE ta.track_id = t.id
  ), '[]'::json) AS artist_links,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', taf.id::text,
        'quality', taf.quality::text,
        'format', taf.format::text,
        'storageUrl', taf.storage_url,
        'bitrateKbps', taf.bitrate_kbps,
        'sampleRateHz', taf.sample_rate_hz,
        'channels', taf.channels,
        'fileSizeBytes', taf.file_size_bytes,
        'durationMs', taf.duration_ms,
        'checksumSha256', taf.checksum_sha256
      )
      ORDER BY taf.created_at DESC
    )
    FROM track_audio_files taf
    WHERE taf.track_id = t.id
  ), '[]'::json) AS audio_files,
  (
    SELECT json_build_object(
      'content', l.content,
      'language', l.language,
      'hasTimestamps', l.has_timestamps
    )
    FROM lyrics l
    WHERE l.track_id = t.id
  ) AS lyrics
FROM tracks t
JOIN albums a ON a.id = t.album_id
JOIN artists pa ON pa.id = t.primary_artist_id
WHERE t.id = :track_id
LIMIT 1
"""
    )
    row = (await db.execute(query, {"track_id": track_id})).mappings().first()
    return _serialize_track(row) if row else None


async def _replace_artist_genres(db: AsyncSession, artist_id: str, genre_ids: list[str]) -> None:
    await db.execute(text("DELETE FROM artist_genres WHERE artist_id = :artist_id"), {"artist_id": artist_id})
    for genre_id in genre_ids:
        await db.execute(
            text(
                """
INSERT INTO artist_genres (artist_id, genre_id)
VALUES (:artist_id, :genre_id)
ON CONFLICT DO NOTHING
"""
            ),
            {"artist_id": artist_id, "genre_id": genre_id},
        )


async def _replace_album_genres(db: AsyncSession, album_id: str, genre_ids: list[str]) -> None:
    await db.execute(text("DELETE FROM album_genres WHERE album_id = :album_id"), {"album_id": album_id})
    for genre_id in genre_ids:
        await db.execute(
            text(
                """
INSERT INTO album_genres (album_id, genre_id)
VALUES (:album_id, :genre_id)
ON CONFLICT DO NOTHING
"""
            ),
            {"album_id": album_id, "genre_id": genre_id},
        )


async def _replace_track_genres(db: AsyncSession, track_id: str, genre_ids: list[str]) -> None:
    await db.execute(text("DELETE FROM track_genres WHERE track_id = :track_id"), {"track_id": track_id})
    for genre_id in genre_ids:
        await db.execute(
            text(
                """
INSERT INTO track_genres (track_id, genre_id)
VALUES (:track_id, :genre_id)
ON CONFLICT DO NOTHING
"""
            ),
            {"track_id": track_id, "genre_id": genre_id},
        )


async def _replace_track_artists(
    db: AsyncSession,
    track_id: str,
    primary_artist_id: str,
    artist_links: list[TrackArtistLinkInput],
) -> None:
    await db.execute(text("DELETE FROM track_artists WHERE track_id = :track_id"), {"track_id": track_id})
    await db.execute(
        text(
            """
INSERT INTO track_artists (track_id, artist_id, role, display_order)
VALUES (:track_id, :artist_id, 'primary', 0)
ON CONFLICT DO NOTHING
"""
        ),
        {"track_id": track_id, "artist_id": primary_artist_id},
    )
    for link in artist_links:
        if link.artist_id == primary_artist_id:
            continue
        await db.execute(
            text(
                """
INSERT INTO track_artists (track_id, artist_id, role, display_order)
VALUES (:track_id, :artist_id, :role, :display_order)
ON CONFLICT (track_id, artist_id) DO UPDATE
SET role = EXCLUDED.role, display_order = EXCLUDED.display_order
"""
            ),
            {
                "track_id": track_id,
                "artist_id": link.artist_id,
                "role": link.role,
                "display_order": link.display_order,
            },
        )


async def _upsert_lyrics(db: AsyncSession, track_id: str, lyrics: LyricsInput | None) -> None:
    if lyrics is None:
        return
    await db.execute(
        text(
            """
INSERT INTO lyrics (track_id, content, language, has_timestamps)
VALUES (:track_id, :content, :language, :has_timestamps)
ON CONFLICT (track_id) DO UPDATE
SET content = EXCLUDED.content,
    language = EXCLUDED.language,
    has_timestamps = EXCLUDED.has_timestamps
"""
        ),
        {
            "track_id": track_id,
            "content": lyrics.content,
            "language": lyrics.language.lower(),
            "has_timestamps": lyrics.has_timestamps,
        },
    )


async def _upsert_audio_files(
    db: AsyncSession,
    track_id: str,
    audio_files: list[TrackAudioInput],
    *,
    replace: bool,
) -> None:
    if replace:
        await db.execute(text("DELETE FROM track_audio_files WHERE track_id = :track_id"), {"track_id": track_id})
    for audio in audio_files:
        _validate_audio_url(audio.storage_url)
        await db.execute(
            text(
                """
INSERT INTO track_audio_files (
  track_id, quality, format, bitrate_kbps, sample_rate_hz, channels,
  file_size_bytes, storage_url, duration_ms, checksum_sha256
)
VALUES (
  :track_id, :quality, :format, :bitrate_kbps, :sample_rate_hz, :channels,
  :file_size_bytes, :storage_url, :duration_ms, :checksum_sha256
)
ON CONFLICT (track_id, quality) DO UPDATE
SET format = EXCLUDED.format,
    bitrate_kbps = EXCLUDED.bitrate_kbps,
    sample_rate_hz = EXCLUDED.sample_rate_hz,
    channels = EXCLUDED.channels,
    file_size_bytes = EXCLUDED.file_size_bytes,
    storage_url = EXCLUDED.storage_url,
    duration_ms = EXCLUDED.duration_ms,
    checksum_sha256 = EXCLUDED.checksum_sha256
"""
            ),
            {
                "track_id": track_id,
                "quality": audio.quality,
                "format": audio.format,
                "bitrate_kbps": audio.bitrate_kbps,
                "sample_rate_hz": audio.sample_rate_hz,
                "channels": audio.channels,
                "file_size_bytes": audio.file_size_bytes,
                "storage_url": audio.storage_url,
                "duration_ms": audio.duration_ms,
                "checksum_sha256": audio.checksum_sha256,
            },
        )


async def _recompute_album_track_count(db: AsyncSession, album_id: str) -> None:
    await db.execute(
        text(
            """
UPDATE albums
SET track_count = (
  SELECT count(*)::smallint
  FROM tracks
  WHERE album_id = :album_id
)
WHERE id = :album_id
"""
        ),
        {"album_id": album_id},
    )


@router.post("/auth/login", summary="Internal employee login")
async def internal_login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    identity = payload.username.strip()
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username/email or password",
    )
    if not identity:
        raise invalid

    user = await fetch_user_for_login(db, identity)
    if user is None or not user["is_active"]:
        raise invalid
    if not verify_password(payload.password, user["hashed_password"]):
        raise invalid
    if not _is_internal_role(user["role"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee account required for internal tool access.",
        )

    access_token, expires_in = create_access_token(user["id"])
    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "expiresIn": expires_in,
        "user": to_public_user(user),
    }


@router.get("/auth/me", summary="Get current internal employee profile")
async def internal_me(current_user: dict = Depends(_require_internal_user)) -> dict[str, Any]:
    return current_user


@router.get("/genres", summary="List genres for content forms")
async def list_genres(
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, str]]:
    result = await db.execute(
        text("SELECT id::text AS id, name, slug FROM genres ORDER BY sort_order, name")
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("/audio/inspect", summary="Inspect a local audio asset and infer metadata")
async def inspect_audio(
    payload: AudioInspectRequest,
    _: dict = Depends(_require_internal_user),
) -> dict[str, Any]:
    storage_url = payload.storage_url.strip()
    _validate_audio_url(storage_url)

    inferred = infer_local_audio_metadata(storage_url)
    if inferred is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Metadata inference is only available for readable local data/* files.",
        )

    return {
        "storageUrl": storage_url,
        "format": inferred.get("format"),
        "durationMs": inferred.get("duration_ms"),
        "bitrateKbps": inferred.get("bitrate_kbps"),
        "sampleRateHz": inferred.get("sample_rate_hz"),
        "channels": inferred.get("channels"),
        "fileSizeBytes": inferred.get("file_size_bytes"),
        "checksumSha256": inferred.get("checksum_sha256"),
    }


@router.get("/artists", summary="List artists for internal management")
async def list_artists(
    status_filter: ContentStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, min_length=1, alias="q"),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    search_query = f"%{q.strip()}%" if q else None
    items_result = await db.execute(
        text(
            """
SELECT
  a.id::text AS id,
  a.name,
  a.slug,
  a.bio,
  a.image_url,
  a.header_image_url,
  a.status::text AS status,
  a.persona_prompt,
  a.style_tags,
  a.created_at,
  a.updated_at,
  COALESCE((
    SELECT array_agg(ag.genre_id::text ORDER BY ag.genre_id::text)
    FROM artist_genres ag
    WHERE ag.artist_id = a.id
  ), ARRAY[]::text[]) AS genre_ids
FROM artists a
WHERE (CAST(:status_filter AS text) IS NULL OR a.status::text = CAST(:status_filter AS text))
  AND (
    CAST(:search_query AS text) IS NULL
    OR a.name ILIKE CAST(:search_query AS text)
    OR a.slug ILIKE CAST(:search_query AS text)
  )
ORDER BY a.updated_at DESC
LIMIT :limit OFFSET :offset
"""
        ),
        {
            "status_filter": status_filter,
            "search_query": search_query,
            "limit": limit,
            "offset": offset,
        },
    )
    count_result = await db.execute(
        text(
            """
SELECT count(*) AS total
FROM artists a
WHERE (CAST(:status_filter AS text) IS NULL OR a.status::text = CAST(:status_filter AS text))
  AND (
    CAST(:search_query AS text) IS NULL
    OR a.name ILIKE CAST(:search_query AS text)
    OR a.slug ILIKE CAST(:search_query AS text)
  )
"""
        ),
        {"status_filter": status_filter, "search_query": search_query},
    )
    total = int(count_result.scalar_one())
    return {
        "items": [_serialize_artist(row) for row in items_result.mappings().all()],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/artists", summary="Create artist")
async def create_artist(
    payload: ArtistCreateRequest,
    current_user: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    artist_slug = await _ensure_artist_slug(db, payload.slug or payload.name)
    image_url = _normalize_optional_text(payload.image_url)
    header_image_url = _normalize_optional_text(payload.header_image_url)
    bio = _normalize_optional_text(payload.bio)
    persona_prompt = _normalize_optional_text(payload.persona_prompt)
    if image_url:
        _validate_media_url(image_url, "imageUrl")
    if header_image_url:
        _validate_media_url(header_image_url, "headerImageUrl")
    _ensure_published_artist_requirements(payload.status, image_url=image_url, bio=bio)

    published_at = datetime.now(UTC) if payload.status == "published" else None
    try:
        result = await db.execute(
            text(
                """
INSERT INTO artists (
  name, slug, bio, image_url, header_image_url,
  status, persona_prompt, style_tags, created_by, published_at
)
VALUES (
  :name, :slug, :bio, :image_url, :header_image_url,
  :status, :persona_prompt, :style_tags, :created_by, :published_at
)
RETURNING id::text
"""
            ),
            {
                "name": payload.name.strip(),
                "slug": artist_slug,
                "bio": bio,
                "image_url": image_url,
                "header_image_url": header_image_url,
                "status": payload.status,
                "persona_prompt": persona_prompt,
                "style_tags": payload.style_tags,
                "created_by": current_user["id"],
                "published_at": published_at,
            },
        )
        artist_id = str(result.scalar_one())
        if payload.genre_ids:
            await _replace_artist_genres(db, artist_id, payload.genre_ids)
    except IntegrityError as exc:
        raise _integrity_exception(exc, "Could not create artist with the provided data.") from exc

    created = await _fetch_artist(db, artist_id)
    if created is None:
        raise HTTPException(status_code=500, detail="Artist created but could not be loaded.")
    return created


@router.patch("/artists/{artist_id}", summary="Update artist")
async def update_artist(
    artist_id: str,
    payload: ArtistUpdateRequest,
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    existing = await _fetch_artist(db, artist_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Artist not found.")

    values = payload.model_dump(exclude_unset=True, by_alias=False)
    update_values: dict[str, Any] = {}
    if "name" in values:
        update_values["name"] = values["name"].strip()
    if "slug" in values:
        if values["slug"] is None:
            update_values["slug"] = await _ensure_artist_slug(db, existing["name"])
        else:
            update_values["slug"] = await _ensure_artist_slug(db, values["slug"])
    if "bio" in values:
        update_values["bio"] = _normalize_optional_text(values["bio"])
    if "image_url" in values:
        normalized = _normalize_optional_text(values["image_url"])
        if normalized:
            _validate_media_url(normalized, "imageUrl")
        update_values["image_url"] = normalized
    if "header_image_url" in values:
        normalized = _normalize_optional_text(values["header_image_url"])
        if normalized:
            _validate_media_url(normalized, "headerImageUrl")
        update_values["header_image_url"] = normalized
    if "persona_prompt" in values:
        update_values["persona_prompt"] = _normalize_optional_text(values["persona_prompt"])
    if "style_tags" in values:
        update_values["style_tags"] = values["style_tags"] or []
    if "status" in values:
        update_values["status"] = values["status"]
        if values["status"] == "published":
            update_values["published_at"] = datetime.now(UTC)
        if values["status"] == "archived":
            update_values["archived_at"] = datetime.now(UTC)

    resulting_status = update_values.get("status", existing["status"])
    resulting_image_url = update_values.get("image_url", existing.get("imageUrl"))
    resulting_bio = update_values.get("bio", existing.get("bio"))
    _ensure_published_artist_requirements(
        resulting_status,
        image_url=_normalize_optional_text(resulting_image_url),
        bio=_normalize_optional_text(resulting_bio),
    )

    if update_values:
        assignments = ", ".join(f"{column} = :{column}" for column in update_values)
        params = {**update_values, "artist_id": artist_id}
        try:
            await db.execute(text(f"UPDATE artists SET {assignments} WHERE id = :artist_id"), params)
        except IntegrityError as exc:
            raise _integrity_exception(exc, "Could not update artist.") from exc

    if "genre_ids" in values and values["genre_ids"] is not None:
        await _replace_artist_genres(db, artist_id, values["genre_ids"])

    updated = await _fetch_artist(db, artist_id)
    if updated is None:
        raise HTTPException(status_code=500, detail="Artist updated but could not be loaded.")
    return updated


@router.get("/albums", summary="List albums for internal management")
async def list_albums(
    status_filter: ContentStatus | None = Query(default=None, alias="status"),
    artist_id: str | None = Query(default=None, alias="artistId"),
    q: str | None = Query(default=None, min_length=1, alias="q"),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    search_query = f"%{q.strip()}%" if q else None
    items_result = await db.execute(
        text(
            """
SELECT
  a.id::text AS id,
  a.title,
  a.slug,
  a.artist_id::text AS artist_id,
  ar.name AS artist_name,
  a.cover_url,
  a.description,
  a.release_date,
  a.album_type::text AS album_type,
  a.status::text AS status,
  a.track_count,
  a.created_at,
  a.updated_at,
  COALESCE((
    SELECT array_agg(ag.genre_id::text ORDER BY ag.genre_id::text)
    FROM album_genres ag
    WHERE ag.album_id = a.id
  ), ARRAY[]::text[]) AS genre_ids
FROM albums a
JOIN artists ar ON ar.id = a.artist_id
WHERE (CAST(:status_filter AS text) IS NULL OR a.status::text = CAST(:status_filter AS text))
  AND (CAST(:artist_id AS uuid) IS NULL OR a.artist_id = CAST(:artist_id AS uuid))
  AND (
    CAST(:search_query AS text) IS NULL
    OR a.title ILIKE CAST(:search_query AS text)
    OR a.slug ILIKE CAST(:search_query AS text)
  )
ORDER BY a.updated_at DESC
LIMIT :limit OFFSET :offset
"""
        ),
        {
            "status_filter": status_filter,
            "artist_id": artist_id,
            "search_query": search_query,
            "limit": limit,
            "offset": offset,
        },
    )
    count_result = await db.execute(
        text(
            """
SELECT count(*) AS total
FROM albums a
WHERE (CAST(:status_filter AS text) IS NULL OR a.status::text = CAST(:status_filter AS text))
  AND (CAST(:artist_id AS uuid) IS NULL OR a.artist_id = CAST(:artist_id AS uuid))
  AND (
    CAST(:search_query AS text) IS NULL
    OR a.title ILIKE CAST(:search_query AS text)
    OR a.slug ILIKE CAST(:search_query AS text)
  )
"""
        ),
        {
            "status_filter": status_filter,
            "artist_id": artist_id,
            "search_query": search_query,
        },
    )
    total = int(count_result.scalar_one())
    return {
        "items": [_serialize_album(row) for row in items_result.mappings().all()],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/albums", summary="Create album")
async def create_album(
    payload: AlbumCreateRequest,
    current_user: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    album_slug = await _ensure_album_slug(db, payload.artist_id, payload.slug or payload.title)
    cover_url = _normalize_optional_text(payload.cover_url)
    description = _normalize_optional_text(payload.description)
    if cover_url:
        _validate_media_url(cover_url, "coverUrl")
    _ensure_published_album_requirements(
        payload.status,
        cover_url=cover_url,
        release_date=payload.release_date,
    )

    published_at = datetime.now(UTC) if payload.status == "published" else None
    try:
        result = await db.execute(
            text(
                """
INSERT INTO albums (
  title, slug, artist_id, cover_url, description, release_date,
  album_type, status, created_by, published_at
)
VALUES (
  :title, :slug, :artist_id, :cover_url, :description, :release_date,
  :album_type, :status, :created_by, :published_at
)
RETURNING id::text
"""
            ),
            {
                "title": payload.title.strip(),
                "slug": album_slug,
                "artist_id": payload.artist_id,
                "cover_url": cover_url,
                "description": description,
                "release_date": payload.release_date,
                "album_type": payload.album_type,
                "status": payload.status,
                "created_by": current_user["id"],
                "published_at": published_at,
            },
        )
        album_id = str(result.scalar_one())
        if payload.genre_ids:
            await _replace_album_genres(db, album_id, payload.genre_ids)
    except IntegrityError as exc:
        raise _integrity_exception(exc, "Could not create album with the provided data.") from exc

    created = await _fetch_album(db, album_id)
    if created is None:
        raise HTTPException(status_code=500, detail="Album created but could not be loaded.")
    return created


@router.patch("/albums/{album_id}", summary="Update album")
async def update_album(
    album_id: str,
    payload: AlbumUpdateRequest,
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    existing = await _fetch_album(db, album_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Album not found.")

    values = payload.model_dump(exclude_unset=True, by_alias=False)
    update_values: dict[str, Any] = {}
    artist_for_slug = values.get("artist_id", existing["artistId"])
    if "title" in values:
        update_values["title"] = values["title"].strip()
    if "slug" in values:
        base_for_slug = values["slug"] or update_values.get("title", existing["title"])
        update_values["slug"] = await _ensure_album_slug(db, artist_for_slug, base_for_slug)
    elif "title" in values and "artist_id" in values:
        update_values["slug"] = await _ensure_album_slug(
            db, artist_for_slug, update_values["title"]
        )

    if "artist_id" in values:
        update_values["artist_id"] = values["artist_id"]
    if "cover_url" in values:
        normalized = _normalize_optional_text(values["cover_url"])
        if normalized:
            _validate_media_url(normalized, "coverUrl")
        update_values["cover_url"] = normalized
    if "description" in values:
        update_values["description"] = _normalize_optional_text(values["description"])
    if "release_date" in values:
        update_values["release_date"] = values["release_date"]
    if "album_type" in values:
        update_values["album_type"] = values["album_type"]
    if "status" in values:
        update_values["status"] = values["status"]
        if values["status"] == "published":
            update_values["published_at"] = datetime.now(UTC)
        if values["status"] == "archived":
            update_values["archived_at"] = datetime.now(UTC)

    resulting_status = update_values.get("status", existing["status"])
    resulting_cover_url = update_values.get("cover_url", existing.get("coverUrl"))
    resulting_release_date = update_values.get("release_date", existing.get("releaseDate"))
    if isinstance(resulting_release_date, str):
        resulting_release_date = date.fromisoformat(resulting_release_date)
    _ensure_published_album_requirements(
        resulting_status,
        cover_url=_normalize_optional_text(resulting_cover_url),
        release_date=resulting_release_date,
    )

    if update_values:
        assignments = ", ".join(f"{column} = :{column}" for column in update_values)
        params = {**update_values, "album_id": album_id}
        try:
            await db.execute(text(f"UPDATE albums SET {assignments} WHERE id = :album_id"), params)
        except IntegrityError as exc:
            raise _integrity_exception(exc, "Could not update album.") from exc

    if "genre_ids" in values and values["genre_ids"] is not None:
        await _replace_album_genres(db, album_id, values["genre_ids"])

    updated = await _fetch_album(db, album_id)
    if updated is None:
        raise HTTPException(status_code=500, detail="Album updated but could not be loaded.")
    return updated


@router.get("/tracks", summary="List tracks for internal management")
async def list_tracks(
    status_filter: ContentStatus | None = Query(default=None, alias="status"),
    album_id: str | None = Query(default=None, alias="albumId"),
    artist_id: str | None = Query(default=None, alias="artistId"),
    q: str | None = Query(default=None, min_length=1, alias="q"),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    search_query = f"%{q.strip()}%" if q else None
    items_result = await db.execute(
        text(
            """
SELECT
  t.id::text AS id,
  t.title,
  t.album_id::text AS album_id,
  a.title AS album_title,
  t.primary_artist_id::text AS primary_artist_id,
  pa.name AS primary_artist_name,
  t.track_number,
  t.disc_number,
  t.duration_ms,
  t.explicit,
  t.status::text AS status,
  t.created_at,
  t.updated_at,
  COALESCE((
    SELECT array_agg(tg.genre_id::text ORDER BY tg.genre_id::text)
    FROM track_genres tg
    WHERE tg.track_id = t.id
  ), ARRAY[]::text[]) AS genre_ids,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'artistId', ta.artist_id::text,
        'role', ta.role::text,
        'displayOrder', ta.display_order
      )
      ORDER BY ta.display_order, ta.artist_id::text
    )
    FROM track_artists ta
    WHERE ta.track_id = t.id
  ), '[]'::json) AS artist_links,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', taf.id::text,
        'quality', taf.quality::text,
        'format', taf.format::text,
        'storageUrl', taf.storage_url,
        'bitrateKbps', taf.bitrate_kbps,
        'sampleRateHz', taf.sample_rate_hz,
        'channels', taf.channels,
        'fileSizeBytes', taf.file_size_bytes,
        'durationMs', taf.duration_ms,
        'checksumSha256', taf.checksum_sha256
      )
      ORDER BY taf.created_at DESC
    )
    FROM track_audio_files taf
    WHERE taf.track_id = t.id
  ), '[]'::json) AS audio_files,
  (
    SELECT json_build_object(
      'content', l.content,
      'language', l.language,
      'hasTimestamps', l.has_timestamps
    )
    FROM lyrics l
    WHERE l.track_id = t.id
  ) AS lyrics
FROM tracks t
JOIN albums a ON a.id = t.album_id
JOIN artists pa ON pa.id = t.primary_artist_id
WHERE (CAST(:status_filter AS text) IS NULL OR t.status::text = CAST(:status_filter AS text))
  AND (CAST(:album_id AS uuid) IS NULL OR t.album_id = CAST(:album_id AS uuid))
  AND (CAST(:artist_id AS uuid) IS NULL OR t.primary_artist_id = CAST(:artist_id AS uuid))
  AND (CAST(:search_query AS text) IS NULL OR t.title ILIKE CAST(:search_query AS text))
ORDER BY t.updated_at DESC
LIMIT :limit OFFSET :offset
"""
        ),
        {
            "status_filter": status_filter,
            "album_id": album_id,
            "artist_id": artist_id,
            "search_query": search_query,
            "limit": limit,
            "offset": offset,
        },
    )
    count_result = await db.execute(
        text(
            """
SELECT count(*) AS total
FROM tracks t
WHERE (CAST(:status_filter AS text) IS NULL OR t.status::text = CAST(:status_filter AS text))
  AND (CAST(:album_id AS uuid) IS NULL OR t.album_id = CAST(:album_id AS uuid))
  AND (CAST(:artist_id AS uuid) IS NULL OR t.primary_artist_id = CAST(:artist_id AS uuid))
  AND (CAST(:search_query AS text) IS NULL OR t.title ILIKE CAST(:search_query AS text))
"""
        ),
        {
            "status_filter": status_filter,
            "album_id": album_id,
            "artist_id": artist_id,
            "search_query": search_query,
        },
    )
    total = int(count_result.scalar_one())
    return {
        "items": [_serialize_track(row) for row in items_result.mappings().all()],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/tracks", summary="Create track")
async def create_track(
    payload: TrackCreateRequest,
    current_user: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    album_result = await db.execute(
        text("SELECT id::text AS id, artist_id::text AS artist_id FROM albums WHERE id = :album_id LIMIT 1"),
        {"album_id": payload.album_id},
    )
    album = album_result.mappings().first()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found.")

    primary_artist_id = payload.primary_artist_id or album["artist_id"]
    audio_files = list(payload.audio_files)
    inferred_duration_ms = _enrich_audio_files(audio_files)
    duration_ms = payload.duration_ms if payload.duration_ms > 0 else (inferred_duration_ms or 0)
    _ensure_published_track_requirements(
        payload.status,
        duration_ms=duration_ms,
        has_audio_files=bool(audio_files),
    )
    published_at = datetime.now(UTC) if payload.status == "published" else None
    try:
        result = await db.execute(
            text(
                """
INSERT INTO tracks (
  title, album_id, primary_artist_id, track_number, disc_number, duration_ms,
  explicit, status, created_by, published_at
)
VALUES (
  :title, :album_id, :primary_artist_id, :track_number, :disc_number, :duration_ms,
  :explicit, :status, :created_by, :published_at
)
RETURNING id::text
"""
            ),
            {
                "title": payload.title.strip(),
                "album_id": payload.album_id,
                "primary_artist_id": primary_artist_id,
                "track_number": payload.track_number,
                "disc_number": payload.disc_number,
                "duration_ms": duration_ms,
                "explicit": payload.explicit,
                "status": payload.status,
                "created_by": current_user["id"],
                "published_at": published_at,
            },
        )
        track_id = str(result.scalar_one())
        await _replace_track_artists(db, track_id, primary_artist_id, payload.artist_links)
        await _replace_track_genres(db, track_id, payload.genre_ids)
        await _upsert_lyrics(db, track_id, payload.lyrics)
        await _upsert_audio_files(db, track_id, audio_files, replace=False)
        await _recompute_album_track_count(db, payload.album_id)
    except IntegrityError as exc:
        raise _integrity_exception(exc, "Could not create track with the provided data.") from exc

    created = await _fetch_track(db, track_id)
    if created is None:
        raise HTTPException(status_code=500, detail="Track created but could not be loaded.")
    return created


@router.patch("/tracks/{track_id}", summary="Update track")
async def update_track(
    track_id: str,
    payload: TrackUpdateRequest,
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    existing = await _fetch_track(db, track_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Track not found.")

    values = payload.model_dump(exclude_unset=True, by_alias=False)
    audio_files_input = payload.audio_files if "audio_files" in values else None
    inferred_duration_ms: int | None = None
    if audio_files_input is not None:
        inferred_duration_ms = _enrich_audio_files(audio_files_input)

    update_values: dict[str, Any] = {}
    if "title" in values:
        update_values["title"] = values["title"].strip()
    if "album_id" in values:
        update_values["album_id"] = values["album_id"]
    if "primary_artist_id" in values:
        update_values["primary_artist_id"] = values["primary_artist_id"]
    if "track_number" in values:
        update_values["track_number"] = values["track_number"]
    if "disc_number" in values:
        update_values["disc_number"] = values["disc_number"]
    if "duration_ms" in values:
        explicit_duration = int(values["duration_ms"] or 0)
        if explicit_duration <= 0 and inferred_duration_ms is not None:
            explicit_duration = inferred_duration_ms
        update_values["duration_ms"] = explicit_duration
    elif inferred_duration_ms is not None:
        update_values["duration_ms"] = inferred_duration_ms
    if "explicit" in values:
        update_values["explicit"] = values["explicit"]
    if "status" in values:
        update_values["status"] = values["status"]
        if values["status"] == "published":
            update_values["published_at"] = datetime.now(UTC)
        if values["status"] == "archived":
            update_values["archived_at"] = datetime.now(UTC)

    resulting_status = update_values.get("status", existing["status"])
    resulting_duration_ms = int(update_values.get("duration_ms", existing.get("durationMs") or 0))
    if audio_files_input is None:
        resulting_has_audio = bool(existing.get("audioFiles"))
    elif values.get("replace_audio_files"):
        resulting_has_audio = len(audio_files_input) > 0
    else:
        resulting_has_audio = bool(existing.get("audioFiles")) or len(audio_files_input) > 0
    _ensure_published_track_requirements(
        resulting_status,
        duration_ms=resulting_duration_ms,
        has_audio_files=resulting_has_audio,
    )

    primary_artist_for_links = update_values.get("primary_artist_id", existing["primaryArtistId"])

    previous_album_id = existing["albumId"]
    new_album_id = update_values.get("album_id", previous_album_id)

    if update_values:
        assignments = ", ".join(f"{column} = :{column}" for column in update_values)
        params = {**update_values, "track_id": track_id}
        try:
            await db.execute(text(f"UPDATE tracks SET {assignments} WHERE id = :track_id"), params)
        except IntegrityError as exc:
            raise _integrity_exception(exc, "Could not update track.") from exc

    if "artist_links" in values and values["artist_links"] is not None:
        await _replace_track_artists(db, track_id, primary_artist_for_links, values["artist_links"])
    if "genre_ids" in values and values["genre_ids"] is not None:
        await _replace_track_genres(db, track_id, values["genre_ids"])
    if "lyrics" in values and values["lyrics"] is not None:
        await _upsert_lyrics(db, track_id, values["lyrics"])
    if values.get("clear_lyrics"):
        await db.execute(text("DELETE FROM lyrics WHERE track_id = :track_id"), {"track_id": track_id})
    if audio_files_input is not None:
        await _upsert_audio_files(
            db,
            track_id,
            audio_files_input,
            replace=bool(values.get("replace_audio_files")),
        )

    if previous_album_id != new_album_id:
        await _recompute_album_track_count(db, previous_album_id)
    await _recompute_album_track_count(db, new_album_id)

    updated = await _fetch_track(db, track_id)
    if updated is None:
        raise HTTPException(status_code=500, detail="Track updated but could not be loaded.")
    return updated
