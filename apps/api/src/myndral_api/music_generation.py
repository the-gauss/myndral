from __future__ import annotations

import asyncio
import contextlib
import re
import wave
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from google import genai
from google.genai import types

from myndral_api.media_utils import DATA_DIR

DEFAULT_LYRIA_MODEL = "models/lyria-realtime-exp"
DEFAULT_OUTPUT_SUBDIR = "generated/music"

_FILENAME_SANITIZER = re.compile(r"[^a-z0-9]+")
_PCM_RATE_PATTERN = re.compile(r"(?:^|;)\s*rate=(\d+)")
_PCM_CHANNEL_PATTERN = re.compile(r"(?:^|;)\s*channels=(\d+)")


class MusicGenerationError(RuntimeError):
    pass


@dataclass(slots=True)
class GeneratedMusicFile:
    storage_url: str
    absolute_path: Path
    mime_type: str
    sample_rate_hz: int
    channels: int
    file_size_bytes: int
    duration_ms: int
    filtered_prompt_text: str | None
    filtered_prompt_reason: str | None


def _safe_filename(raw: str | None) -> str:
    base = (raw or "lyria-generated").strip().lower()
    normalized = _FILENAME_SANITIZER.sub("-", base).strip("-")
    return normalized or "lyria-generated"


def _next_output_path(output_dir: Path, filename_hint: str | None) -> Path:
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    base = _safe_filename(filename_hint)
    candidate = output_dir / f"{timestamp}-{base}.wav"
    if not candidate.exists():
        return candidate
    for idx in range(1, 1000):
        with_suffix = output_dir / f"{timestamp}-{base}-{idx}.wav"
        if not with_suffix.exists():
            return with_suffix
    raise MusicGenerationError("Could not allocate output filename for generated audio.")


def _parse_pcm_metadata(
    mime_type: str | None, sample_rate_hz: int, channels: int
) -> tuple[int, int]:
    if not mime_type:
        return sample_rate_hz, channels

    rate_match = _PCM_RATE_PATTERN.search(mime_type)
    channel_match = _PCM_CHANNEL_PATTERN.search(mime_type)

    if rate_match:
        parsed_rate = int(rate_match.group(1))
        if parsed_rate > 0:
            sample_rate_hz = parsed_rate

    if channel_match:
        parsed_channels = int(channel_match.group(1))
        if parsed_channels in (1, 2):
            channels = parsed_channels

    return sample_rate_hz, channels


async def generate_lyria_file(
    *,
    api_key: str,
    model: str,
    weighted_prompts: list[types.WeightedPrompt],
    config: types.LiveMusicGenerationConfig,
    length_seconds: int,
    output_subdir: str = DEFAULT_OUTPUT_SUBDIR,
    filename_hint: str | None = None,
) -> GeneratedMusicFile:
    if not api_key.strip():
        raise MusicGenerationError("LYRIA_3_API_KEY is not configured.")
    if length_seconds <= 0:
        raise MusicGenerationError("lengthSeconds must be greater than 0.")
    if not weighted_prompts:
        raise MusicGenerationError("At least one prompt is required.")

    output_dir = (DATA_DIR / output_subdir).resolve()
    try:
        output_dir.relative_to(DATA_DIR)
    except ValueError as exc:
        raise MusicGenerationError(
            "LYRIA_OUTPUT_SUBDIR must resolve inside the data/ directory."
        ) from exc
    output_dir.mkdir(parents=True, exist_ok=True)

    # Lyria live stream currently returns PCM chunks; we persist a WAV container.
    mime_type = "audio/pcm"
    sample_rate_hz = 48000
    channels = 2
    pcm_chunks: list[bytes] = []
    filtered_prompt_text: str | None = None
    filtered_prompt_reason: str | None = None

    # Lyria Live is currently only available on the v1alpha live endpoint.
    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    stream_deadline = asyncio.get_running_loop().time() + float(length_seconds)

    try:
        async with client.aio.live.music.connect(model=model) as session:
            await session.set_weighted_prompts(prompts=weighted_prompts)
            await session.set_music_generation_config(config=config)
            await session.play()

            async for message in session.receive():
                if message.filtered_prompt is not None:
                    filtered_prompt_text = message.filtered_prompt.text
                    filtered_prompt_reason = message.filtered_prompt.filtered_reason

                server_content = message.server_content
                if server_content and server_content.audio_chunks:
                    for chunk in server_content.audio_chunks:
                        if chunk.mime_type:
                            mime_type = chunk.mime_type
                            sample_rate_hz, channels = _parse_pcm_metadata(
                                chunk.mime_type,
                                sample_rate_hz,
                                channels,
                            )
                        if chunk.data:
                            pcm_chunks.append(bytes(chunk.data))

                if asyncio.get_running_loop().time() >= stream_deadline:
                    break

            with contextlib.suppress(Exception):
                await session.stop()
    except Exception as exc:
        raise MusicGenerationError(f"Lyria request failed: {exc}") from exc

    if not pcm_chunks:
        raise MusicGenerationError(
            "No audio was returned by Lyria. Try a longer length or different prompt."
        )

    output_path = _next_output_path(output_dir, filename_hint)
    pcm_blob = b"".join(pcm_chunks)

    # Current Lyria stream uses 16-bit PCM.
    with wave.open(str(output_path), "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate_hz)
        wav_file.writeframes(pcm_blob)

    duration_seconds = len(pcm_blob) / float(sample_rate_hz * channels * 2)
    duration_ms = int(round(duration_seconds * 1000))
    storage_url = f"data/{output_path.relative_to(DATA_DIR).as_posix()}"

    return GeneratedMusicFile(
        storage_url=storage_url,
        absolute_path=output_path,
        mime_type=mime_type,
        sample_rate_hz=sample_rate_hz,
        channels=channels,
        file_size_bytes=output_path.stat().st_size,
        duration_ms=duration_ms,
        filtered_prompt_text=filtered_prompt_text,
        filtered_prompt_reason=filtered_prompt_reason,
    )
