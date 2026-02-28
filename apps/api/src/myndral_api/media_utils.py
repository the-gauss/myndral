from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, unquote

from mutagen import File as MutagenFile

LOCAL_STORAGE_PREFIXES = ("data/", "/data/", "file://")
REMOTE_STORAGE_PREFIXES = ("http://", "https://", "s3://", "gs://")

REPO_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = (REPO_ROOT / "data").resolve()


def is_local_storage_url(value: str | None) -> bool:
    return bool(value and value.startswith(LOCAL_STORAGE_PREFIXES))


def is_remote_storage_url(value: str | None) -> bool:
    return bool(value and value.startswith(REMOTE_STORAGE_PREFIXES))


def normalize_audio_url(track_id: str, storage_url: str | None) -> str | None:
    if not storage_url:
        return None
    if is_local_storage_url(storage_url):
        return f"/v1/stream/{track_id}"
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
    if suffix in {"mp3", "aac", "ogg", "flac", "opus"}:
        return suffix
    return None


def guess_media_type(path: Path, fallback_format: str | None = None) -> str:
    media_type, _ = mimetypes.guess_type(str(path))
    if media_type:
        return media_type

    by_format = {
        "mp3": "audio/mpeg",
        "flac": "audio/flac",
        "ogg": "audio/ogg",
        "aac": "audio/aac",
        "opus": "audio/opus",
    }
    if fallback_format and fallback_format in by_format:
        return by_format[fallback_format]
    return "application/octet-stream"


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
