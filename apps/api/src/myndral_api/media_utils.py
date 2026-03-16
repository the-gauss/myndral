from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from mutagen import File as MutagenFile

import os

LOCAL_STORAGE_PREFIXES = ("data/", "/data/", "file://")
REMOTE_STORAGE_PREFIXES = ("http://", "https://", "s3://", "gs://")

# DATA_DIR can be overridden by the DATA_DIR environment variable.
# In dev, it defaults to <monorepo-root>/data (4 levels up from this file).
# In Docker, the monorepo depth doesn't exist, so we fall back to /tmp/myndral-data
# which is writable on Cloud Run's ephemeral filesystem.  All persistent storage
# goes to GCS in production; the local path is only used when GCS is not configured.
_data_dir_env = os.environ.get("DATA_DIR", "")
if _data_dir_env:
    DATA_DIR = Path(_data_dir_env).resolve()
else:
    try:
        DATA_DIR = (Path(__file__).resolve().parents[4] / "data").resolve()
    except IndexError:
        DATA_DIR = Path("/tmp/myndral-data").resolve()

REPO_ROOT = DATA_DIR.parent


def is_local_storage_url(value: str | None) -> bool:
    return bool(value and value.startswith(LOCAL_STORAGE_PREFIXES))


def is_remote_storage_url(value: str | None) -> bool:
    return bool(value and value.startswith(REMOTE_STORAGE_PREFIXES))


def gcs_to_public_https(storage_url: str) -> str:
    """Convert ``gs://bucket/object`` → ``https://storage.googleapis.com/bucket/object``.

    Buckets with public read access (allUsers objectViewer) are served at this
    URL without any authentication headers.  Only call this for public-read
    objects — images and generated audio qualify; raw upload temp files do not.
    """
    if storage_url.startswith("gs://"):
        return "https://storage.googleapis.com/" + storage_url[5:]
    return storage_url


def normalize_audio_url(track_id: str, storage_url: str | None) -> str | None:
    """Return a browser-usable audio URL for the given storage URL.

    - Local data/ paths → proxy through /v1/stream/{track_id} (dev).
    - GCS gs:// paths   → also proxy through /v1/stream/{track_id} so that
      the stream endpoint can enforce published-status access checks.
    - Remote http/https → pass through unchanged (CDN / external host).
    """
    if not storage_url:
        return None
    if is_local_storage_url(storage_url) or storage_url.startswith("gs://"):
        return f"/v1/stream/{track_id}"
    return storage_url


def normalize_image_url(storage_url: str | None) -> str | None:
    """Return a browser-usable URL for a locally stored or GCS image.

    - Local data/images/ paths  → /v1/images/<filename>  (dev StaticFiles / prod proxy).
    - GCS gs://bucket/images/f  → /v1/images/<filename>  (proxied by the API; avoids
      the need for a public-read GCS bucket, which org policies often block).
    - Remote http/https         → unchanged (CDN / external host).
    """
    if not storage_url:
        return None
    if storage_url.startswith(("data/images/", "/data/images/")):
        filename = storage_url.lstrip("/").removeprefix("data/images/")
        return f"/v1/images/{filename}"
    if storage_url.startswith("gs://"):
        # Strip "gs://bucket/" prefix, then strip the leading "images/" segment
        # so the result is /v1/images/<filename>, matching the proxy route.
        object_path = storage_url[5:].split("/", 1)[1] if "/" in storage_url[5:] else ""
        if object_path.startswith("images/"):
            object_path = object_path[len("images/"):]
        return f"/v1/images/{object_path}"
    return storage_url


def resolve_local_storage_path(storage_url: str) -> Path | None:
    candidate: Path
    if storage_url.startswith("data/"):
        candidate = DATA_DIR / storage_url.removeprefix("data/")
    elif storage_url.startswith("/data/"):
        candidate = DATA_DIR / storage_url.removeprefix("/data/")
    elif storage_url.startswith("file://"):
        parsed = urlparse(storage_url)
        if parsed.scheme != "file":
            return None
        candidate = Path(unquote(parsed.path))
    else:
        return None

    try:
        resolved = candidate.expanduser().resolve(strict=False)
    except Exception:
        return None

    try:
        resolved.relative_to(DATA_DIR)
    except ValueError:
        return None

    if not resolved.is_file():
        return None
    return resolved


def guess_audio_format(storage_url: str) -> str | None:
    if not storage_url:
        return None
    suffix = Path(storage_url).suffix.lower().lstrip(".")
    if suffix in {"mp3", "aac", "ogg", "flac", "opus", "wav"}:
        return suffix
    return None


def guess_media_type(path: Path, fallback_format: str | None = None) -> str:
    media_type, _ = mimetypes.guess_type(str(path))
    if media_type:
        return media_type

    by_format = {
        "mp3":  "audio/mpeg",
        "flac": "audio/flac",
        "ogg":  "audio/ogg",
        "aac":  "audio/aac",
        "opus": "audio/opus",
        "wav":  "audio/wav",
    }
    if fallback_format and fallback_format in by_format:
        return by_format[fallback_format]
    return "application/octet-stream"


def is_audio_magic_bytes(header: bytes) -> bool:
    """Return True if the leading bytes of a file match a known audio container/codec.

    Operates on the first 12 bytes only.  Intended as a server-side guard
    against non-audio files uploaded with a spoofed extension or MIME type
    (e.g. a video .mp4 renamed to .mp3).  Runs after MIME and extension checks.

    Formats covered: MP3 (ID3 / MPEG sync), FLAC, OGG (Vorbis/Opus),
    WAV (RIFF/WAVE), M4A/AAC in MPEG-4 container (ftyp box), AAC ADTS stream.
    """
    if len(header) < 4:
        return False
    # MP3 — ID3v2 tag prefix or raw MPEG sync word
    if header[:3] == b"ID3":
        return True
    # MPEG audio sync: 0xFF followed by a byte with the top 3 bits set (0xEx or 0xFx)
    # and at least one of the layer bits set — covers MP1/MP2/MP3.
    if header[0] == 0xFF and (header[1] & 0xE0) == 0xE0 and (header[1] & 0x06) != 0:
        return True
    # FLAC
    if header[:4] == b"fLaC":
        return True
    # OGG container (Vorbis, Opus, FLAC-in-OGG)
    if header[:4] == b"OggS":
        return True
    # WAV — RIFF container; WAVE fourcc at bytes 8-11 distinguishes from other RIFF files
    if header[:4] == b"RIFF" and len(header) >= 12 and header[8:12] == b"WAVE":
        return True
    # MPEG-4 audio container (M4A / AAC-LC / ALAC) — ftyp box always starts at byte 4
    if len(header) >= 8 and header[4:8] == b"ftyp":
        return True
    # AAC ADTS raw bitstream (no container wrapper)
    if header[0] == 0xFF and header[1] in (0xF1, 0xF9):
        return True
    return False


def infer_local_audio_metadata(storage_url: str) -> dict[str, Any] | None:
    path = resolve_local_storage_path(storage_url)
    if path is None:
        return None

    result: dict[str, Any] = {
        "format": guess_audio_format(path.name),
        "file_size_bytes": path.stat().st_size,
    }

    try:
        audio = MutagenFile(path)
    except Exception:
        audio = None

    info = getattr(audio, "info", None)
    if info is not None:
        length = getattr(info, "length", None)
        bitrate = getattr(info, "bitrate", None)
        sample_rate = getattr(info, "sample_rate", None)
        channels = getattr(info, "channels", None)
        if length is not None:
            result["duration_ms"] = int(round(float(length) * 1000))
        if bitrate is not None:
            result["bitrate_kbps"] = int(round(float(bitrate) / 1000))
        if sample_rate is not None:
            result["sample_rate_hz"] = int(sample_rate)
        if channels is not None:
            result["channels"] = int(channels)

    # Avoid loading the whole file in memory.
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    result["checksum_sha256"] = digest.hexdigest()
    result["absolute_path"] = str(path)
    return result
