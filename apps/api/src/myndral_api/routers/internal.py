import json
import re
from datetime import UTC, date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from myndral_api.auth_utils import (
    create_access_token,
    fetch_user_for_login,
    get_current_user,
    to_public_user,
    verify_password,
)
from myndral_api.config import get_settings
from myndral_api.db.session import get_db
from myndral_api.media_utils import (
    DATA_DIR,
    guess_audio_format,
    guess_media_type,
    infer_local_audio_metadata,
    is_local_storage_url,
    is_remote_storage_url,
    normalize_image_url,
    resolve_local_storage_path,
)
from myndral_api.music_generation import (
    DEFAULT_ELEVENLABS_MODEL,
    DEFAULT_OUTPUT_FORMAT,
    MusicGenerationError,
    WeightedPromptInput,
    build_composition_plan,
    build_song_prompt,
    generate_song_file,
)

router = APIRouter()

ContentStatus = Literal["draft", "review", "published", "archived"]
AlbumType = Literal["album", "single", "ep", "compilation"]
TrackArtistRole = Literal["primary", "featured", "producer", "remixer"]
AudioQuality = Literal["low_128", "standard_256", "high_320", "lossless"]
AudioFormat = Literal["mp3", "aac", "ogg", "flac", "opus"]
InternalRole = Literal["content_editor", "content_reviewer", "admin"]
LegacyMusicScale = Literal[
    "SCALE_UNSPECIFIED",
    "C_MAJOR_A_MINOR",
    "D_FLAT_MAJOR_B_FLAT_MINOR",
    "D_MAJOR_B_MINOR",
    "E_FLAT_MAJOR_C_MINOR",
    "E_MAJOR_D_FLAT_MINOR",
    "F_MAJOR_D_MINOR",
    "G_FLAT_MAJOR_E_FLAT_MINOR",
    "G_MAJOR_E_MINOR",
    "A_FLAT_MAJOR_F_MINOR",
    "A_MAJOR_G_FLAT_MINOR",
    "B_FLAT_MAJOR_G_MINOR",
    "B_MAJOR_A_FLAT_MINOR",
]
LegacyMusicGenerationMode = Literal[
    "MUSIC_GENERATION_MODE_UNSPECIFIED",
    "QUALITY",
    "DIVERSITY",
    "VOCALIZATION",
]
ElevenLabsOutputFormat = Literal[
    "mp3_22050_32",
    "mp3_24000_48",
    "mp3_44100_32",
    "mp3_44100_64",
    "mp3_44100_96",
    "mp3_44100_128",
    "mp3_44100_192",
    "pcm_8000",
    "pcm_16000",
    "pcm_22050",
    "pcm_24000",
    "pcm_32000",
    "pcm_44100",
    "pcm_48000",
    "ulaw_8000",
    "alaw_8000",
    "opus_48000_32",
    "opus_48000_64",
    "opus_48000_96",
    "opus_48000_128",
    "opus_48000_192",
]

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
    # status is always 'review' on creation — transitions happen through staging endpoints
    persona_prompt: str | None = Field(default=None, alias="personaPrompt")
    style_tags: list[str] = Field(default_factory=list, alias="styleTags")
    genre_ids: list[str] = Field(default_factory=list, alias="genreIds")


class ArtistUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    bio: str | None = None
    image_url: str | None = Field(default=None, alias="imageUrl")
    header_image_url: str | None = Field(default=None, alias="headerImageUrl")
    # status is not editable via PATCH — use staging endpoints to change status
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
    # status is always 'review' on creation — transitions happen through staging endpoints
    genre_ids: list[str] = Field(default_factory=list, alias="genreIds")


class AlbumUpdateRequest(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    artist_id: str | None = Field(default=None, alias="artistId")
    cover_url: str | None = Field(default=None, alias="coverUrl")
    description: str | None = None
    release_date: date | None = Field(default=None, alias="releaseDate")
    album_type: AlbumType | None = Field(default=None, alias="albumType")
    # status is not editable via PATCH — use staging endpoints to change status
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
    # status is always 'review' on creation — transitions happen through staging endpoints
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
    # status is not editable via PATCH — use staging endpoints to change status
    genre_ids: list[str] | None = Field(default=None, alias="genreIds")
    artist_links: list[TrackArtistLinkInput] | None = Field(default=None, alias="artistLinks")
    lyrics: LyricsInput | None = None
    clear_lyrics: bool = Field(default=False, alias="clearLyrics")
    audio_files: list[TrackAudioInput] | None = Field(default=None, alias="audioFiles")
    replace_audio_files: bool = Field(default=False, alias="replaceAudioFiles")


class MusicPromptInput(CamelModel):
    text: str = Field(min_length=1, max_length=500)
    weight: float = Field(default=1.0, ge=-5.0, le=5.0)


class MusicGenerateRequest(CamelModel):
    # ── Catalog linking (required) ────────────────────────────────────────────
    artist_id: str = Field(alias="artistId")
    album_id: str = Field(alias="albumId")
    track_title: str = Field(alias="trackTitle", min_length=1, max_length=255)
    explicit: bool = False

    # ── Generation params ─────────────────────────────────────────────────────
    prompt: str = Field(min_length=1, max_length=2000)
    prompt_weight: float = Field(default=1.0, alias="promptWeight", ge=-5.0, le=5.0)
    weighted_prompts: list[MusicPromptInput] = Field(default_factory=list, alias="weightedPrompts")
    length_seconds: int = Field(default=20, alias="lengthSeconds", ge=3, le=600)
    file_name: str | None = Field(default=None, alias="fileName", min_length=1, max_length=120)
    model: str | None = Field(default=None, min_length=1, max_length=32)
    temperature: float | None = Field(default=None, ge=0.0, le=3.0)
    top_k: int | None = Field(default=None, alias="topK", ge=1, le=1000)
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)
    guidance: float | None = Field(default=None, ge=0.0, le=6.0)
    negative_prompt: str | None = Field(default=None, alias="negativePrompt", max_length=2000)
    force_instrumental: bool = Field(default=False, alias="forceInstrumental")
    output_format: ElevenLabsOutputFormat | None = Field(default=None, alias="outputFormat")
    lyrics: str | None = Field(default=None, max_length=12000)
    lyrics_language: str = Field(default="en", alias="lyricsLanguage", min_length=2, max_length=8)
    with_timestamps: bool = Field(default=False, alias="withTimestamps")
    bpm: int | None = Field(default=None, ge=60, le=200)
    density: float | None = Field(default=None, ge=0.0, le=1.0)
    brightness: float | None = Field(default=None, ge=0.0, le=1.0)
    scale: LegacyMusicScale | None = None
    mute_bass: bool | None = Field(default=None, alias="muteBass")
    mute_drums: bool | None = Field(default=None, alias="muteDrums")
    only_bass_and_drums: bool | None = Field(default=None, alias="onlyBassAndDrums")
    music_generation_mode: LegacyMusicGenerationMode | None = Field(
        default=None,
        alias="musicGenerationMode",
    )


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


def _to_weighted_prompts(payload: MusicGenerateRequest) -> list[WeightedPromptInput]:
    return [
        WeightedPromptInput(text=item.text.strip(), weight=float(item.weight))
        for item in payload.weighted_prompts
        if item.text.strip()
    ]


def _humanize_legacy_scale(value: LegacyMusicScale) -> str:
    if value == "SCALE_UNSPECIFIED":
        return "an unspecified key"
    return (
        value.replace("_", " ")
        .title()
        .replace(" Flat ", " flat ")
        .replace(" Minor", " minor")
        .replace(" Major", " major")
    )


def _legacy_prompt_hints(payload: MusicGenerateRequest) -> tuple[list[str], str | None]:
    hints: list[str] = []
    negative_parts: list[str] = []

    if payload.bpm is not None:
        hints.append(f"Tempo around {payload.bpm} BPM")
    if payload.scale and payload.scale != "SCALE_UNSPECIFIED":
        hints.append(f"Center the harmony around {_humanize_legacy_scale(payload.scale)}")
    if payload.brightness is not None:
        if payload.brightness >= 0.67:
            hints.append("Use a bright, glossy tone")
        elif payload.brightness <= 0.33:
            hints.append("Use a darker, warmer tone")
    if payload.density is not None:
        if payload.density >= 0.67:
            hints.append("Keep the arrangement dense and full")
        elif payload.density <= 0.33:
            hints.append("Keep the arrangement sparse and open")
    if payload.only_bass_and_drums:
        hints.append("Bass and drums should dominate the arrangement")
    else:
        if payload.mute_bass:
            negative_parts.append("bass")
        if payload.mute_drums:
            negative_parts.append("drums and percussion")
    if payload.music_generation_mode == "VOCALIZATION" and not payload.force_instrumental:
        hints.append("Prioritize expressive sung vocals")
    elif payload.music_generation_mode == "QUALITY":
        hints.append("Aim for polished studio-quality production")
    elif payload.music_generation_mode == "DIVERSITY":
        hints.append("Let the arrangement evolve and vary across the song")
    if payload.temperature is not None:
        if payload.temperature >= 1.4:
            hints.append("Take bold creative risks")
        elif payload.temperature <= 0.6:
            hints.append("Keep the composition focused and controlled")
    if payload.guidance is not None and payload.guidance >= 4.0:
        hints.append("Keep the song tightly aligned to the prompt")

    negative_prompt = _normalize_optional_text(payload.negative_prompt)
    if negative_parts:
        muted = ", ".join(negative_parts)
        negative_prompt = f"{negative_prompt}; {muted}" if negative_prompt else muted
    return hints, negative_prompt


def _build_music_generation_inputs(
    payload: MusicGenerateRequest,
    model: str,
    default_output_format: str,
) -> tuple[str | None, Any | None, dict[str, Any]]:
    extra_hints, negative_prompt = _legacy_prompt_hints(payload)
    weighted_prompts = _to_weighted_prompts(payload)
    lyrics = _normalize_optional_text(payload.lyrics)
    prompt_text = build_song_prompt(
        prompt=payload.prompt.strip(),
        prompt_weight=float(payload.prompt_weight),
        weighted_prompts=weighted_prompts,
        negative_prompt=negative_prompt,
        prefer_vocals=not payload.force_instrumental and lyrics is None,
        extra_hints=extra_hints,
    )
    composition_plan = None
    request_prompt: str | None = prompt_text
    if lyrics:
        composition_plan = build_composition_plan(
            prompt=prompt_text,
            lyrics=lyrics,
            length_seconds=payload.length_seconds,
            negative_prompt=negative_prompt,
            extra_hints=extra_hints,
        )
        request_prompt = None

    input_params = _build_music_input_params(
        payload=payload,
        model=model,
        output_format=payload.output_format or default_output_format,
        resolved_prompt=prompt_text,
        negative_prompt=negative_prompt,
        extra_hints=extra_hints,
        has_custom_lyrics=lyrics is not None,
    )
    return request_prompt, composition_plan, input_params


def _build_music_input_params(
    payload: MusicGenerateRequest,
    *,
    model: str,
    output_format: str,
    resolved_prompt: str,
    negative_prompt: str | None,
    extra_hints: list[str],
    has_custom_lyrics: bool,
) -> dict[str, Any]:
    weighted_prompts = [
        {"text": payload.prompt.strip(), "weight": float(payload.prompt_weight)},
        *[
            {"text": item.text.strip(), "weight": float(item.weight)}
            for item in payload.weighted_prompts
        ],
    ]
    return {
        "prompt": payload.prompt.strip(),
        "promptWeight": float(payload.prompt_weight),
        "weightedPrompts": weighted_prompts,
        "resolvedPrompt": resolved_prompt,
        "negativePrompt": negative_prompt,
        "lengthSeconds": int(payload.length_seconds),
        "fileName": _normalize_optional_text(payload.file_name),
        "model": model,
        "outputFormat": output_format,
        "forceInstrumental": bool(payload.force_instrumental),
        "lyrics": _normalize_optional_text(payload.lyrics),
        "lyricsLanguage": payload.lyrics_language,
        "withTimestamps": bool(payload.with_timestamps),
        "hasCustomLyrics": has_custom_lyrics,
        "provider": "elevenlabs",
        "temperature": payload.temperature,
        "topK": payload.top_k,
        "seed": payload.seed,
        "guidance": payload.guidance,
        "bpm": payload.bpm,
        "density": payload.density,
        "brightness": payload.brightness,
        "scale": payload.scale,
        "muteBass": payload.mute_bass,
        "muteDrums": payload.mute_drums,
        "onlyBassAndDrums": payload.only_bass_and_drums,
        "musicGenerationMode": payload.music_generation_mode,
        "extraHints": extra_hints,
    }


def _serialize_music_job(row: Any) -> dict[str, Any]:
    input_params = row["input_params"] or {}
    output_metadata = row["output_metadata"] or {}
    return {
        "id": row["id"],
        "status": row["status"],
        "prompt": input_params.get("prompt"),
        "lengthSeconds": input_params.get("lengthSeconds"),
        "model": input_params.get("model"),
        "inputParams": input_params,
        "outputMetadata": output_metadata,
        "outputStorageUrl": output_metadata.get("storageUrl"),
        "errorMessage": row["error_message"],
        "createdAt": _iso(row["created_at"]),
        "startedAt": _iso(row["started_at"]),
        "completedAt": _iso(row["completed_at"]),
        "failedAt": _iso(row["failed_at"]),
    }


def _enrich_audio_files(audio_files: list[TrackAudioInput]) -> int | None:
    inferred_duration_ms: int | None = None
    for audio in audio_files:
        _validate_audio_url(audio.storage_url)
        inferred = infer_local_audio_metadata(audio.storage_url)
        if inferred is None:
            continue

        inferred_format = inferred.get("format")
        if (
            inferred_format
            and audio.format == "mp3"
            and inferred_format in {"aac", "ogg", "flac", "opus"}
        ):
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
        "imageUrl": normalize_image_url(row["image_url"]),
        "headerImageUrl": normalize_image_url(row["header_image_url"]),
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
        "coverUrl": normalize_image_url(row["cover_url"]),
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
        exists = await db.execute(
            text("SELECT 1 FROM artists WHERE slug = :slug"),
            {"slug": candidate},
        )
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
    await db.execute(
        text("DELETE FROM artist_genres WHERE artist_id = :artist_id"),
        {"artist_id": artist_id},
    )
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
    await db.execute(
        text("DELETE FROM album_genres WHERE album_id = :album_id"),
        {"album_id": album_id},
    )
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
    await db.execute(
        text("DELETE FROM track_genres WHERE track_id = :track_id"),
        {"track_id": track_id},
    )
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
    await db.execute(
        text("DELETE FROM track_artists WHERE track_id = :track_id"),
        {"track_id": track_id},
    )
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
        await db.execute(
            text("DELETE FROM track_audio_files WHERE track_id = :track_id"),
            {"track_id": track_id},
        )
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
async def internal_login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
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


@router.post("/music/generate", summary="Generate a song with ElevenLabs and save it to data/")
async def generate_music(
    payload: MusicGenerateRequest,
    current_user: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    settings = get_settings()
    api_key = settings.elevenlabs_api_key.strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ELEVENLABS_API_KEY is not configured on the API server.",
        )

    # ── Validate artist and album exist ──────────────────────────────────────
    artist_row = await db.execute(
        text("SELECT id, name FROM artists WHERE id = CAST(:artist_id AS uuid)"),
        {"artist_id": payload.artist_id},
    )
    artist = artist_row.mappings().first()
    if artist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artist not found.")

    album_row = await db.execute(
        text(
            """
SELECT id, title FROM albums
WHERE id = CAST(:album_id AS uuid)
  AND artist_id = CAST(:artist_id AS uuid)
"""
        ),
        {"album_id": payload.album_id, "artist_id": payload.artist_id},
    )
    album = album_row.mappings().first()
    if album is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found for this artist.",
        )

    model_name = (
        _normalize_optional_text(payload.model)
        or settings.elevenlabs_model
        or DEFAULT_ELEVENLABS_MODEL
    )
    request_prompt, composition_plan, input_params = _build_music_generation_inputs(
        payload,
        model_name,
        settings.elevenlabs_output_format or DEFAULT_OUTPUT_FORMAT,
    )

    try:
        insert_result = await db.execute(
            text(
                """
INSERT INTO generation_jobs (job_type, status, input_params, created_by, started_at)
VALUES (
  'music_generation',
  'in_progress',
  CAST(:input_params AS jsonb),
  CAST(:created_by AS uuid),
  now()
)
RETURNING id::text
"""
            ),
            {
                "input_params": json.dumps(input_params),
                "created_by": current_user["id"],
            },
        )
    except DBAPIError as exc:
        await db.rollback()
        if "invalid input value for enum generation_job_type" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Database schema is missing 'music_generation' job type. "
                    "Apply migration db/migrations/20260302_01_add_music_generation_job_type.sql."
                ),
            ) from exc
        raise
    job_id = str(insert_result.scalar_one())
    await db.commit()

    try:
        generated = await generate_song_file(
            api_key=api_key,
            model=model_name,
            prompt=request_prompt,
            composition_plan=composition_plan,
            length_seconds=payload.length_seconds,
            output_format=payload.output_format
            or settings.elevenlabs_output_format
            or DEFAULT_OUTPUT_FORMAT,
            with_timestamps=payload.with_timestamps,
            force_instrumental=payload.force_instrumental,
            output_subdir=settings.elevenlabs_output_subdir,
            filename_hint=payload.file_name or payload.track_title,
            seed=payload.seed,
            gcs_bucket=settings.gcs_bucket_name or None,
        )
    except MusicGenerationError as exc:
        error_detail = str(exc)
        # Best-effort: mark the job as failed. If the DB update itself fails
        # (e.g. session in a bad state) we still want to return the real error
        # to the caller rather than letting that secondary failure cause a 500.
        try:
            await db.rollback()
            await db.execute(
                text(
                    """
UPDATE generation_jobs
SET status = 'failed',
    failed_at = now(),
    error_message = :error_message
WHERE id = CAST(:job_id AS uuid)
"""
                ),
                {
                    "job_id": job_id,
                    "error_message": error_detail[:2000],
                },
            )
            await db.commit()
        except Exception:
            pass  # Job status update is non-critical; surface the real error below
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_detail) from exc

    output_metadata: dict[str, Any] = {
        "storageUrl": generated.storage_url,
        "absolutePath": str(generated.absolute_path),
        "mimeType": generated.mime_type,
        "sampleRateHz": generated.sample_rate_hz,
        "channels": generated.channels,
        "fileSizeBytes": generated.file_size_bytes,
        "durationMs": generated.duration_ms,
        "outputFormat": generated.output_format,
        "songId": generated.song_id,
        "compositionPlan": generated.composition_plan,
        "songMetadata": generated.song_metadata,
        "wordsTimestamps": generated.words_timestamps,
        "lyrics": generated.lyrics,
    }

    # ── Auto-create track in 'review' (staging) status ───────────────────────
    # Wrap in try/except so any DB issue surfaces as a proper 502 rather than
    # an opaque 500, and the job is marked failed regardless.
    try:
        track_num_row = await db.execute(
            text("SELECT COALESCE(MAX(track_number), 0) + 1 AS next_num FROM tracks WHERE album_id = CAST(:album_id AS uuid)"),
            {"album_id": payload.album_id},
        )
        next_track_number = int(track_num_row.scalar_one())

        duration_ms = int(generated.duration_ms or 0)
        audio_format = guess_audio_format(generated.storage_url) or "mp3"

        track_insert = await db.execute(
            text(
                """
INSERT INTO tracks (
  title, album_id, primary_artist_id,
  track_number, disc_number, duration_ms,
  explicit, status, created_by
)
VALUES (
  :title, CAST(:album_id AS uuid), CAST(:artist_id AS uuid),
  :track_number, 1, :duration_ms,
  :explicit, 'review', CAST(:created_by AS uuid)
)
RETURNING id::text
"""
            ),
            {
                "title": payload.track_title.strip(),
                "album_id": payload.album_id,
                "artist_id": payload.artist_id,
                "track_number": next_track_number,
                "duration_ms": duration_ms,
                "explicit": payload.explicit,
                "created_by": current_user["id"],
            },
        )
        track_id = str(track_insert.scalar_one())

        # Primary artist link
        await db.execute(
            text(
                """
INSERT INTO track_artists (track_id, artist_id, role, display_order)
VALUES (CAST(:track_id AS uuid), CAST(:artist_id AS uuid), 'primary', 0)
ON CONFLICT DO NOTHING
"""
            ),
            {"track_id": track_id, "artist_id": payload.artist_id},
        )

        # Audio file
        await db.execute(
            text(
                """
INSERT INTO track_audio_files (
  track_id, quality, format, storage_url,
  bitrate_kbps, sample_rate_hz, channels,
  file_size_bytes, duration_ms
)
VALUES (
  CAST(:track_id AS uuid), 'standard_256', :format, :storage_url,
  :bitrate_kbps, :sample_rate_hz, :channels,
  :file_size_bytes, :duration_ms
)
"""
            ),
            {
                "track_id": track_id,
                "format": audio_format,
                "storage_url": generated.storage_url,
                "bitrate_kbps": None,
                "sample_rate_hz": generated.sample_rate_hz,
                "channels": generated.channels or 2,
                "file_size_bytes": generated.file_size_bytes,
                "duration_ms": duration_ms or None,
            },
        )

        # Recompute album track_count
        await db.execute(
            text(
                """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid)
    AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
            ),
            {"album_id": payload.album_id},
        )

        # Optionally store generated lyrics on the track
        if generated.lyrics:
            await db.execute(
                text(
                    """
INSERT INTO lyrics (track_id, content, language, has_timestamps)
VALUES (CAST(:track_id AS uuid), :content, 'en', :has_timestamps)
ON CONFLICT (track_id) DO UPDATE
  SET content = EXCLUDED.content, has_timestamps = EXCLUDED.has_timestamps
"""
                ),
                {
                    "track_id": track_id,
                    "content": generated.lyrics,
                    "has_timestamps": payload.with_timestamps and bool(generated.words_timestamps),
                },
            )

        output_metadata["trackId"] = track_id

        await db.execute(
            text(
                """
UPDATE generation_jobs
SET status = 'completed',
    completed_at = now(),
    output_metadata = CAST(:output_metadata AS jsonb)
WHERE id = CAST(:job_id AS uuid)
"""
            ),
            {"job_id": job_id, "output_metadata": json.dumps(output_metadata)},
        )
        await db.commit()

    except Exception as db_exc:
        detail = f"Track catalog write failed after generation: {db_exc}"
        try:
            await db.rollback()
            await db.execute(
                text(
                    """
UPDATE generation_jobs
SET status = 'failed', failed_at = now(), error_message = :msg
WHERE id = CAST(:job_id AS uuid)
"""
                ),
                {"job_id": job_id, "msg": detail[:2000]},
            )
            await db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from db_exc

    result = await db.execute(
        text(
            """
SELECT
  id::text AS id,
  status::text AS status,
  input_params,
  output_metadata,
  error_message,
  created_at,
  started_at,
  completed_at,
  failed_at
FROM generation_jobs
WHERE id = CAST(:job_id AS uuid)
"""
        ),
        {"job_id": job_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=500,
            detail="Generation succeeded but job could not be loaded.",
        )
    return _serialize_music_job(row)


@router.get("/music/jobs", summary="List generated music jobs")
async def list_music_jobs(
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    items_result = await db.execute(
        text(
            """
SELECT
  id::text AS id,
  status::text AS status,
  input_params,
  output_metadata,
  error_message,
  created_at,
  started_at,
  completed_at,
  failed_at
FROM generation_jobs
WHERE job_type::text = 'music_generation'
ORDER BY created_at DESC
LIMIT :limit OFFSET :offset
"""
        ),
        {"limit": limit, "offset": offset},
    )
    count_result = await db.execute(
        text(
            "SELECT count(*) AS total FROM generation_jobs "
            "WHERE job_type::text = 'music_generation'"
        )
    )
    return {
        "items": [_serialize_music_job(row) for row in items_result.mappings().all()],
        "total": int(count_result.scalar_one()),
        "limit": limit,
        "offset": offset,
    }


@router.get("/music/file", summary="Read a generated local audio file")
async def read_generated_music_file(
    storage_url: str = Query(alias="storageUrl", min_length=1),
    _: dict = Depends(_require_internal_user),
) -> FileResponse:
    normalized = storage_url.strip()
    if not is_local_storage_url(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="storageUrl must point to a local data/* file.",
        )

    path = resolve_local_storage_path(normalized)
    if path is None:
        raise HTTPException(status_code=404, detail="Generated file not found in data/ folder.")

    fallback_format = guess_audio_format(path.name)
    return FileResponse(
        path=path,
        media_type=guess_media_type(path, fallback_format=fallback_format),
        filename=path.name,
    )


_AUDIO_MIME_TO_EXT: dict[str, str] = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/aac": "aac",
    "audio/x-aac": "aac",
}

_ALLOWED_AUDIO_EXTENSIONS: frozenset[str] = frozenset(
    ["mp3", "m4a", "wav", "flac", "ogg", "opus", "aac"]
)

# Maps file-extension identifiers that are valid containers but whose name does
# not appear as a value in the audio_format DB enum.  The enum stores codec
# identity, not container name, so we normalise here before any DB write.
#
#   audio_format enum values: 'mp3', 'aac', 'ogg', 'flac', 'opus'
#
#   m4a — AAC audio in an MPEG-4 container.  The codec IS aac; only the
#          container name differs.  Safe to store as 'aac'.
#
# NOTE: 'wav' is also accepted by the upload handler but is not in the enum.
# WAV (uncompressed PCM) has no equivalent codec already in the enum, so it
# cannot be safely aliased here.  A future migration should run:
#   ALTER TYPE audio_format ADD VALUE 'wav';
# Until then, wav uploads will fail at the DB write with a clear enum error.
_EXT_TO_DB_FORMAT: dict[str, str] = {
    "m4a": "aac",
}

_IMAGE_MIME_TO_EXT: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
}
_ALLOWED_IMAGE_EXTENSIONS: frozenset[str] = frozenset(["jpg", "jpeg", "png", "webp", "gif", "avif"])


@router.post("/images/upload", summary="Upload an image asset (artist portrait, album cover, etc.)")
async def upload_image(
    file: UploadFile = File(...),
    _: dict = Depends(_require_internal_user),
) -> dict[str, str]:
    """
    Save an uploaded image to data/images/ and return its storage URL.
    The URL can be pasted directly into the imageUrl / coverUrl fields.
    """
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = _IMAGE_MIME_TO_EXT.get(content_type)
    if ext is None and file.filename:
        suffix = file.filename.rsplit(".", 1)[-1].lower()
        if suffix in _ALLOWED_IMAGE_EXTENSIONS:
            ext = "jpg" if suffix == "jpeg" else suffix
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported image type '{content_type}'. Upload jpeg, png, webp, gif, or avif.",
        )

    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{timestamp}.{ext}"
    contents = await file.read()
    mime = content_type or f"image/{ext}"

    settings = get_settings()
    if settings.gcs_bucket_name:
        # Production: upload directly to GCS; images/ prefix is public-read.
        from myndral_api.gcs_utils import upload_bytes_to_gcs  # lazy — not needed in dev

        try:
            storage_url = upload_bytes_to_gcs(
                settings.gcs_bucket_name, f"images/{filename}", contents, mime
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload image to GCS: {exc}",
            ) from exc
    else:
        output_dir = DATA_DIR / "images"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename
        try:
            output_path.write_bytes(contents)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save image: {exc}",
            ) from exc
        storage_url = f"data/images/{filename}"

    return {"storageUrl": storage_url}


@router.post("/music/upload", summary="Upload a custom audio file to staging (bypasses generation API)")
async def upload_custom_music(
    file: UploadFile = File(...),
    artist_id: str = Form(...),
    album_id: str = Form(...),
    track_title: str = Form(min_length=1, max_length=500),
    explicit: bool = Form(default=False),
    lyrics: str | None = Form(default=None),
    current_user: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # ── Validate file type ────────────────────────────────────────────────────
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = _AUDIO_MIME_TO_EXT.get(content_type)
    if ext is None and file.filename:
        suffix = file.filename.rsplit(".", 1)[-1].lower()
        if suffix in _ALLOWED_AUDIO_EXTENSIONS:
            ext = suffix
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{content_type}'. Upload an audio file (mp3, wav, flac, ogg, m4a, aac, opus).",
        )

    # Resolve the DB enum value separately from the file extension.
    # Some containers (e.g. m4a) are valid audio but their name is not a member
    # of the audio_format enum — see _EXT_TO_DB_FORMAT for the mapping.
    db_format = _EXT_TO_DB_FORMAT.get(ext, ext)

    # ── Persist audio file ────────────────────────────────────────────────────
    # Always write to disk first: mutagen needs a seekable file to infer
    # duration/bitrate/sample-rate.  If GCS is configured we then stream
    # the local copy up to the bucket and use the gs:// URL in the DB.
    slug = re.sub(r"[^a-z0-9]+", "-", track_title.strip().lower()).strip("-")[:50]
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{timestamp}-{slug}.{ext}"
    output_dir = DATA_DIR / "generated" / "music"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename

    try:
        contents = await file.read()
        output_path.write_bytes(contents)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {exc}",
        ) from exc

    local_storage_url = f"data/{output_path.relative_to(DATA_DIR).as_posix()}"

    # ── Infer audio metadata (from the local copy) ────────────────────────────
    meta = infer_local_audio_metadata(local_storage_url) or {}
    # Upload to GCS after metadata inference so we don't lose the local file
    # before mutagen reads it.
    settings = get_settings()
    if settings.gcs_bucket_name:
        from myndral_api.gcs_utils import upload_file_to_gcs  # lazy — not needed in dev

        try:
            storage_url = upload_file_to_gcs(
                settings.gcs_bucket_name,
                f"generated/music/{filename}",
                output_path,
                content_type or f"audio/{ext}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload audio to GCS: {exc}",
            ) from exc
    else:
        storage_url = local_storage_url
    duration_ms = int(meta.get("duration_ms") or 0)
    file_size_bytes = int(meta.get("file_size_bytes") or output_path.stat().st_size)
    sample_rate_hz = meta.get("sample_rate_hz")
    channels = meta.get("channels") or 2

    # ── DB writes — mirror the post-generation pipeline ───────────────────────
    input_params: dict[str, Any] = {
        "source": "custom_upload",
        "artistId": artist_id,
        "albumId": album_id,
        "trackTitle": track_title.strip(),
        "explicit": explicit,
        "originalFilename": file.filename,
    }
    output_metadata: dict[str, Any] = {
        "storageUrl": storage_url,
        "mimeType": content_type or f"audio/{ext}",
        "outputFormat": ext,
        "sampleRateHz": sample_rate_hz,
        "channels": channels,
        "fileSizeBytes": file_size_bytes,
        "durationMs": duration_ms or None,
    }

    try:
        # Create a generation_jobs record so it shows in "Recent generated files"
        job_insert = await db.execute(
            text(
                """
INSERT INTO generation_jobs (
  job_type, status, input_params, output_metadata,
  started_at, completed_at, created_by
)
VALUES (
  'music_generation', 'completed',
  CAST(:input_params AS jsonb),
  CAST(:output_metadata AS jsonb),
  now(), now(),
  CAST(:created_by AS uuid)
)
RETURNING id::text
"""
            ),
            {
                "input_params": json.dumps(input_params),
                "output_metadata": json.dumps(output_metadata),
                "created_by": current_user["id"],
            },
        )
        job_id = str(job_insert.scalar_one())

        # Next track number for the album
        track_num_row = await db.execute(
            text("SELECT COALESCE(MAX(track_number), 0) + 1 AS next_num FROM tracks WHERE album_id = CAST(:album_id AS uuid)"),
            {"album_id": album_id},
        )
        next_track_number = int(track_num_row.scalar_one())

        track_insert = await db.execute(
            text(
                """
INSERT INTO tracks (
  title, album_id, primary_artist_id,
  track_number, disc_number, duration_ms,
  explicit, status, created_by
)
VALUES (
  :title, CAST(:album_id AS uuid), CAST(:artist_id AS uuid),
  :track_number, 1, :duration_ms,
  :explicit, 'review', CAST(:created_by AS uuid)
)
RETURNING id::text
"""
            ),
            {
                "title": track_title.strip(),
                "album_id": album_id,
                "artist_id": artist_id,
                "track_number": next_track_number,
                "duration_ms": duration_ms or None,
                "explicit": explicit,
                "created_by": current_user["id"],
            },
        )
        track_id = str(track_insert.scalar_one())

        await db.execute(
            text(
                """
INSERT INTO track_artists (track_id, artist_id, role, display_order)
VALUES (CAST(:track_id AS uuid), CAST(:artist_id AS uuid), 'primary', 0)
ON CONFLICT DO NOTHING
"""
            ),
            {"track_id": track_id, "artist_id": artist_id},
        )

        await db.execute(
            text(
                """
INSERT INTO track_audio_files (
  track_id, quality, format, storage_url,
  bitrate_kbps, sample_rate_hz, channels,
  file_size_bytes, duration_ms
)
VALUES (
  CAST(:track_id AS uuid), 'standard_256', :format, :storage_url,
  :bitrate_kbps, :sample_rate_hz, :channels,
  :file_size_bytes, :duration_ms
)
"""
            ),
            {
                "track_id": track_id,
                "format": db_format,   # enum-safe codec name (m4a normalised to aac, etc.)
                "storage_url": storage_url,
                "bitrate_kbps": None,
                "sample_rate_hz": sample_rate_hz,
                "channels": channels,
                "file_size_bytes": file_size_bytes,
                "duration_ms": duration_ms or None,
            },
        )

        await db.execute(
            text(
                """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid)
    AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
            ),
            {"album_id": album_id},
        )

        if lyrics and lyrics.strip():
            await db.execute(
                text(
                    """
INSERT INTO lyrics (track_id, content, language, has_timestamps)
VALUES (CAST(:track_id AS uuid), :content, 'en', false)
ON CONFLICT (track_id) DO UPDATE
  SET content = EXCLUDED.content, has_timestamps = EXCLUDED.has_timestamps
"""
                ),
                {"track_id": track_id, "content": lyrics.strip()},
            )

        # Stitch trackId into output_metadata on the job
        output_metadata["trackId"] = track_id
        await db.execute(
            text(
                """
UPDATE generation_jobs
SET output_metadata = CAST(:output_metadata AS jsonb)
WHERE id = CAST(:job_id AS uuid)
"""
            ),
            {"job_id": job_id, "output_metadata": json.dumps(output_metadata)},
        )

        await db.commit()

    except Exception as db_exc:
        output_path.unlink(missing_ok=True)
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upload succeeded but catalog write failed: {db_exc}",
        ) from db_exc

    result = await db.execute(
        text(
            """
SELECT
  id::text AS id,
  status::text AS status,
  input_params,
  output_metadata,
  error_message,
  created_at,
  started_at,
  completed_at,
  failed_at
FROM generation_jobs
WHERE id = CAST(:job_id AS uuid)
"""
        ),
        {"job_id": job_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=500, detail="Upload succeeded but job record could not be loaded.")
    return _serialize_music_job(row)


class LinkExternalAudioRequest(BaseModel):
    """Link an already-hosted audio file into the staging pipeline without uploading bytes."""

    storage_url: str = Field(min_length=1, description="Remote CDN URL (https://) or local data/ path")
    artist_id: str
    album_id: str
    track_title: str = Field(min_length=1, max_length=500)
    explicit: bool = False
    lyrics: str | None = None


@router.post("/music/link", summary="Link an external/CDN audio URL to staging (no file upload)")
async def link_external_audio(
    payload: LinkExternalAudioRequest,
    current_user: dict = Depends(_require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Create a staging track from a pre-hosted audio URL (remote CDN or local data/ path).
    Follows the same DB pipeline as /music/upload but skips file ingestion.
    Format is inferred from the URL file extension; metadata is available for local files only.
    """
    # ── Derive format from URL extension ─────────────────────────────────────
    url_path = payload.storage_url.split("?")[0].rstrip("/")
    ext = url_path.rsplit(".", 1)[-1].lower() if "." in url_path else ""
    if ext not in _ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot determine audio format from URL extension '.{ext}'. "
                   f"Supported: {', '.join(sorted(_ALLOWED_AUDIO_EXTENSIONS))}.",
        )

    # Normalise container extension to enum-safe codec name (same logic as upload).
    db_format = _EXT_TO_DB_FORMAT.get(ext, ext)

    # ── Attempt local metadata inference (no-op for remote URLs) ────────────
    meta = infer_local_audio_metadata(payload.storage_url) or {}
    duration_ms = int(meta.get("duration_ms") or 0)
    file_size_bytes = meta.get("file_size_bytes")
    sample_rate_hz = meta.get("sample_rate_hz")
    channels = int(meta.get("channels") or 2)

    # ── DB writes — same pipeline as upload_custom_music ─────────────────────
    input_params: dict[str, Any] = {
        "source": "external_link",
        "artistId": payload.artist_id,
        "albumId": payload.album_id,
        "trackTitle": payload.track_title.strip(),
        "explicit": payload.explicit,
        "storageUrl": payload.storage_url,
    }
    output_metadata: dict[str, Any] = {
        "storageUrl": payload.storage_url,
        "outputFormat": ext,
        "sampleRateHz": sample_rate_hz,
        "channels": channels,
        "fileSizeBytes": file_size_bytes,
        "durationMs": duration_ms or None,
    }

    try:
        job_insert = await db.execute(
            text(
                """
INSERT INTO generation_jobs (
  job_type, status, input_params, output_metadata,
  started_at, completed_at, created_by
)
VALUES (
  'music_generation', 'completed',
  CAST(:input_params AS jsonb),
  CAST(:output_metadata AS jsonb),
  now(), now(),
  CAST(:created_by AS uuid)
)
RETURNING id::text
"""
            ),
            {
                "input_params": json.dumps(input_params),
                "output_metadata": json.dumps(output_metadata),
                "created_by": current_user["id"],
            },
        )
        job_id = str(job_insert.scalar_one())

        track_num_row = await db.execute(
            text("SELECT COALESCE(MAX(track_number), 0) + 1 AS next_num FROM tracks WHERE album_id = CAST(:album_id AS uuid)"),
            {"album_id": payload.album_id},
        )
        next_track_number = int(track_num_row.scalar_one())

        track_insert = await db.execute(
            text(
                """
INSERT INTO tracks (
  title, album_id, primary_artist_id,
  track_number, disc_number, duration_ms,
  explicit, status, created_by
)
VALUES (
  :title, CAST(:album_id AS uuid), CAST(:artist_id AS uuid),
  :track_number, 1, :duration_ms,
  :explicit, 'review', CAST(:created_by AS uuid)
)
RETURNING id::text
"""
            ),
            {
                "title": payload.track_title.strip(),
                "album_id": payload.album_id,
                "artist_id": payload.artist_id,
                "track_number": next_track_number,
                "duration_ms": duration_ms or None,
                "explicit": payload.explicit,
                "created_by": current_user["id"],
            },
        )
        track_id = str(track_insert.scalar_one())

        await db.execute(
            text(
                """
INSERT INTO track_artists (track_id, artist_id, role, display_order)
VALUES (CAST(:track_id AS uuid), CAST(:artist_id AS uuid), 'primary', 0)
ON CONFLICT DO NOTHING
"""
            ),
            {"track_id": track_id, "artist_id": payload.artist_id},
        )

        await db.execute(
            text(
                """
INSERT INTO track_audio_files (
  track_id, quality, format, storage_url,
  bitrate_kbps, sample_rate_hz, channels,
  file_size_bytes, duration_ms
)
VALUES (
  CAST(:track_id AS uuid), 'standard_256', :format, :storage_url,
  NULL, :sample_rate_hz, :channels,
  :file_size_bytes, :duration_ms
)
"""
            ),
            {
                "track_id": track_id,
                "format": db_format,   # enum-safe codec name (m4a normalised to aac, etc.)
                "storage_url": payload.storage_url,
                "sample_rate_hz": sample_rate_hz,
                "channels": channels,
                "file_size_bytes": file_size_bytes,
                "duration_ms": duration_ms or None,
            },
        )

        await db.execute(
            text(
                """
UPDATE albums
SET track_count = (
  SELECT count(*) FROM tracks
  WHERE album_id = CAST(:album_id AS uuid)
    AND status != 'archived'
)
WHERE id = CAST(:album_id AS uuid)
"""
            ),
            {"album_id": payload.album_id},
        )

        if payload.lyrics and payload.lyrics.strip():
            await db.execute(
                text(
                    """
INSERT INTO lyrics (track_id, content, language, has_timestamps)
VALUES (CAST(:track_id AS uuid), :content, 'en', false)
ON CONFLICT (track_id) DO UPDATE
  SET content = EXCLUDED.content, has_timestamps = EXCLUDED.has_timestamps
"""
                ),
                {"track_id": track_id, "content": payload.lyrics.strip()},
            )

        output_metadata["trackId"] = track_id
        await db.execute(
            text(
                """
UPDATE generation_jobs
SET output_metadata = CAST(:output_metadata AS jsonb)
WHERE id = CAST(:job_id AS uuid)
"""
            ),
            {"job_id": job_id, "output_metadata": json.dumps(output_metadata)},
        )

        await db.commit()

    except Exception as db_exc:
        try:
            await db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Link succeeded but catalog write failed: {db_exc}",
        ) from db_exc

    result = await db.execute(
        text(
            """
SELECT
  id::text AS id,
  status::text AS status,
  input_params,
  output_metadata,
  error_message,
  created_at,
  started_at,
  completed_at,
  failed_at
FROM generation_jobs
WHERE id = CAST(:job_id AS uuid)
"""
        ),
        {"job_id": job_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=500, detail="Link succeeded but job record could not be loaded.")
    return _serialize_music_job(row)


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

    try:
        result = await db.execute(
            text(
                """
INSERT INTO artists (
  name, slug, bio, image_url, header_image_url,
  status, persona_prompt, style_tags, created_by
)
VALUES (
  :name, :slug, :bio, :image_url, :header_image_url,
  'review', :persona_prompt, :style_tags, :created_by
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
                "persona_prompt": persona_prompt,
                "style_tags": payload.style_tags,
                "created_by": current_user["id"],
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
    # status is intentionally excluded — status transitions go through staging endpoints

    if update_values:
        assignments = ", ".join(f"{column} = :{column}" for column in update_values)
        params = {**update_values, "artist_id": artist_id}
        try:
            await db.execute(
                text(f"UPDATE artists SET {assignments} WHERE id = :artist_id"),
                params,
            )
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

    try:
        result = await db.execute(
            text(
                """
INSERT INTO albums (
  title, slug, artist_id, cover_url, description, release_date,
  album_type, status, created_by
)
VALUES (
  :title, :slug, :artist_id, :cover_url, :description, :release_date,
  :album_type, 'review', :created_by
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
                "created_by": current_user["id"],
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
    # status is intentionally excluded — status transitions go through staging endpoints

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
  AND (
    CAST(:artist_id AS uuid) IS NULL
    OR t.primary_artist_id = CAST(:artist_id AS uuid)
  )
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
        text(
            "SELECT id::text AS id, artist_id::text AS artist_id "
            "FROM albums WHERE id = :album_id LIMIT 1"
        ),
        {"album_id": payload.album_id},
    )
    album = album_result.mappings().first()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found.")

    primary_artist_id = payload.primary_artist_id or album["artist_id"]
    audio_files = list(payload.audio_files)
    inferred_duration_ms = _enrich_audio_files(audio_files)
    duration_ms = payload.duration_ms if payload.duration_ms > 0 else (inferred_duration_ms or 0)
    try:
        result = await db.execute(
            text(
                """
INSERT INTO tracks (
  title, album_id, primary_artist_id, track_number, disc_number, duration_ms,
  explicit, status, created_by
)
VALUES (
  :title, :album_id, :primary_artist_id, :track_number, :disc_number, :duration_ms,
  :explicit, 'review', :created_by
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
                "created_by": current_user["id"],
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
    # status is intentionally excluded — status transitions go through staging endpoints

    primary_artist_for_links = update_values.get("primary_artist_id", existing["primaryArtistId"])

    previous_album_id = existing["albumId"]
    new_album_id = update_values.get("album_id", previous_album_id)

    if update_values:
        assignments = ", ".join(f"{column} = :{column}" for column in update_values)
        params = {**update_values, "track_id": track_id}
        try:
            await db.execute(
                text(f"UPDATE tracks SET {assignments} WHERE id = :track_id"),
                params,
            )
        except IntegrityError as exc:
            raise _integrity_exception(exc, "Could not update track.") from exc

    if "artist_links" in values and values["artist_links"] is not None:
        await _replace_track_artists(
            db,
            track_id,
            primary_artist_for_links,
            values["artist_links"],
        )
    if "genre_ids" in values and values["genre_ids"] is not None:
        await _replace_track_genres(db, track_id, values["genre_ids"])
    if "lyrics" in values and values["lyrics"] is not None:
        await _upsert_lyrics(db, track_id, values["lyrics"])
    if values.get("clear_lyrics"):
        await db.execute(
            text("DELETE FROM lyrics WHERE track_id = :track_id"),
            {"track_id": track_id},
        )
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
