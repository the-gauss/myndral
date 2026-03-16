"""
GCS upload helpers.

Intentionally thin — responsible for putting bytes into a bucket and
returning the canonical gs:// storage URL.  All naming decisions live in
the callers (upload_image, upload_custom_music, generate_song_file).

google.cloud.storage is imported lazily so that running the API locally
without the package (or without credentials) does not fail at startup.
These helpers are only reached when gcs_bucket_name is configured in
Settings, which never happens in a pure local dev environment.
"""
from __future__ import annotations

from pathlib import Path


def upload_bytes_to_gcs(bucket_name: str, object_name: str, data: bytes, content_type: str) -> str:
    """Upload raw bytes to GCS; return the canonical ``gs://`` storage URL."""
    from google.cloud import storage as gcs  # lazy — not required in dev

    client = gcs.Client()
    blob = client.bucket(bucket_name).blob(object_name)
    blob.upload_from_string(data, content_type=content_type)
    return f"gs://{bucket_name}/{object_name}"


def upload_file_to_gcs(bucket_name: str, object_name: str, path: Path, content_type: str) -> str:
    """Upload a local file to GCS; return the canonical ``gs://`` storage URL."""
    from google.cloud import storage as gcs  # lazy — not required in dev

    client = gcs.Client()
    blob = client.bucket(bucket_name).blob(object_name)
    blob.upload_from_filename(str(path), content_type=content_type)
    return f"gs://{bucket_name}/{object_name}"


def download_gcs_bytes(gs_url: str, start: int | None = None, end: int | None = None) -> tuple[bytes, int]:
    """Download bytes from a ``gs://bucket/object`` URL.

    Args:
        gs_url:  Canonical GCS URL (``gs://bucket/object``).
        start:   First byte offset for a range request (inclusive).  None → 0.
        end:     Last byte offset for a range request (inclusive).  None → EOF.

    Returns:
        A ``(data, total_size)`` tuple.  ``total_size`` is the full object size
        in bytes (needed for ``Content-Range`` response headers).

    The GCS blob is reloaded once to populate ``blob.size`` before the
    download.  Both the reload and the download are synchronous; callers in
    async handlers should wrap this in ``starlette.concurrency.run_in_threadpool``
    if strict non-blocking behaviour is required.
    """
    from google.cloud import storage as gcs  # lazy — not required in dev

    without_scheme = gs_url[5:]          # strip "gs://"
    bucket_name, _, object_name = without_scheme.partition("/")
    client = gcs.Client()
    blob = client.bucket(bucket_name).blob(object_name)
    blob.reload()                        # populate blob.size
    total_size: int = blob.size or 0
    data = blob.download_as_bytes(start=start, end=end)
    return data, total_size
