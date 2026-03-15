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
