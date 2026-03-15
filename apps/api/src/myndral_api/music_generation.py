from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from elevenlabs.client import AsyncElevenLabs
from elevenlabs.core.api_error import ApiError as ElevenLabsApiError
from elevenlabs.types import MusicPrompt, SongSection

from myndral_api.media_utils import (
    DATA_DIR,
    guess_audio_format,
    guess_media_type,
    infer_local_audio_metadata,
)

DEFAULT_ELEVENLABS_MODEL = "music_v1"
DEFAULT_OUTPUT_SUBDIR = "generated/music"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"

_FILENAME_SANITIZER = re.compile(r"[^a-z0-9]+")
_LYRIC_SECTION_HEADER = re.compile(
    r"^\[(?P<bracket>[^\]]+)\]\s*$|^(?P<plain>(intro|verse|pre-chorus|chorus|hook|bridge|outro|refrain)[^:]*)\s*:?\s*$",
    re.IGNORECASE,
)


class MusicGenerationError(RuntimeError):
    pass


@dataclass(slots=True)
class WeightedPromptInput:
    text: str
    weight: float = 1.0


@dataclass(slots=True)
class GeneratedMusicFile:
    storage_url: str
    absolute_path: Path
    mime_type: str
    sample_rate_hz: int | None
    channels: int | None
    file_size_bytes: int
    duration_ms: int | None
    output_format: str
    song_id: str | None
    composition_plan: dict[str, Any] | None
    song_metadata: dict[str, Any] | None
    words_timestamps: list[dict[str, Any]] | None
    lyrics: str | None


@dataclass(slots=True)
class _LyricSection:
    name: str
    lines: list[str]


def _safe_filename(raw: str | None) -> str:
    base = (raw or "elevenlabs-generated").strip().lower()
    normalized = _FILENAME_SANITIZER.sub("-", base).strip("-")
    return normalized or "elevenlabs-generated"


def _normalize_extension(filename: str | None, output_format: str) -> str:
    if filename:
        suffix = Path(filename).suffix.lower()
        if suffix:
            return suffix
    codec = output_format.split("_", 1)[0].lower()
    if codec in {"mp3", "opus", "ogg", "flac", "aac"}:
        return f".{codec}"
    if codec in {"pcm", "ulaw", "alaw"}:
        return ".wav"
    return ".bin"


def _next_output_path(output_dir: Path, filename_hint: str | None, output_format: str) -> Path:
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    base = _safe_filename(filename_hint)
    extension = _normalize_extension(filename_hint, output_format)
    candidate = output_dir / f"{timestamp}-{base}{extension}"
    if not candidate.exists():
        return candidate
    for idx in range(1, 1000):
        with_suffix = output_dir / f"{timestamp}-{base}-{idx}{extension}"
        if not with_suffix.exists():
            return with_suffix
    raise MusicGenerationError("Could not allocate output filename for generated audio.")


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _dedupe_preserving_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def _split_style_hints(raw: str | None) -> list[str]:
    if not raw:
        return []
    parts = [part.strip() for part in re.split(r"[\n,;]+", raw) if part.strip()]
    if parts:
        return _dedupe_preserving_order(parts)
    return [raw.strip()]


def build_song_prompt(
    *,
    prompt: str,
    prompt_weight: float = 1.0,
    weighted_prompts: list[WeightedPromptInput] | None = None,
    negative_prompt: str | None = None,
    prefer_vocals: bool = True,
    extra_hints: list[str] | None = None,
) -> str:
    base_prompt = _normalize_text(prompt)
    if not base_prompt:
        raise MusicGenerationError("prompt is required.")

    sections: list[str] = []
    if prefer_vocals:
        sections.append("Create a full song with lead vocals")
    sections.append(base_prompt)

    if weighted_prompts:
        for item in weighted_prompts:
            text = _normalize_text(item.text)
            if not text:
                continue
            if item.weight < 0:
                sections.append(f"Avoid {text}")
            elif item.weight > max(prompt_weight, 1.2):
                sections.append(f"Strongly emphasize {text}")
            else:
                sections.append(f"Also include {text}")

    negative = _normalize_text(negative_prompt)
    if negative:
        sections.append(f"Avoid {negative}")

    for hint in extra_hints or []:
        normalized_hint = _normalize_text(hint)
        if normalized_hint:
            sections.append(normalized_hint)

    return ". ".join(sections).strip(". ") + "."


def _parse_lyric_blocks(lyrics: str) -> list[_LyricSection]:
    sections: list[_LyricSection] = []
    current_name: str | None = None
    current_lines: list[str] = []
    unnamed_index = 1

    def flush() -> None:
        nonlocal current_name, current_lines, unnamed_index
        if not current_lines:
            current_name = None
            return
        sections.append(
            _LyricSection(
                name=current_name or f"Section {unnamed_index}",
                lines=current_lines[:],
            )
        )
        if current_name is None:
            unnamed_index += 1
        current_name = None
        current_lines = []

    for raw_line in lyrics.splitlines():
        line = raw_line.strip()
        if not line:
            flush()
            continue
        header_match = _LYRIC_SECTION_HEADER.match(line)
        if header_match and not current_lines:
            current_name = (
                header_match.group("bracket")
                or header_match.group("plain")
                or ""
            ).strip()
            continue
        current_lines.append(line[:200])

    flush()
    return sections


def _split_section(section: _LyricSection, parts: int) -> list[_LyricSection]:
    if parts <= 1 or len(section.lines) <= 1:
        return [section]

    chunk_size = max(1, math.ceil(len(section.lines) / parts))
    chunks: list[_LyricSection] = []
    for index in range(0, len(section.lines), chunk_size):
        chunk_lines = section.lines[index:index + chunk_size]
        suffix = len(chunks) + 1
        name = section.name if parts == 1 else f"{section.name} Part {suffix}"
        chunks.append(_LyricSection(name=name, lines=chunk_lines))
    return chunks


def _merge_sections_to_count(
    sections: list[_LyricSection],
    target_count: int,
) -> list[_LyricSection]:
    if target_count <= 0:
        return [
            _LyricSection(
                name="Section 1",
                lines=[line for section in sections for line in section.lines],
            )
        ]

    merged = sections[:]
    while len(merged) > target_count and len(merged) >= 2:
        smallest_index = min(range(len(merged)), key=lambda idx: len(merged[idx].lines))
        merge_into = max(0, smallest_index - 1)
        if smallest_index == 0:
            merge_into = 1
        target = merged[merge_into]
        source = merged[smallest_index]
        combined_name = target.name if len(target.lines) >= len(source.lines) else source.name
        combined_lines = (
            target.lines + source.lines
            if merge_into < smallest_index
            else source.lines + target.lines
        )
        replacement = _LyricSection(name=combined_name, lines=combined_lines)
        first = min(merge_into, smallest_index)
        second = max(merge_into, smallest_index)
        merged = [*merged[:first], replacement, *merged[first + 1:second], *merged[second + 1:]]
    return merged


def _fit_sections_to_duration(sections: list[_LyricSection], total_ms: int) -> list[_LyricSection]:
    if not sections:
        raise MusicGenerationError("lyrics must include at least one non-empty line.")

    min_sections = max(1, math.ceil(total_ms / 120_000))
    max_sections = max(1, total_ms // 3_000)

    fitted = sections[:]
    while len(fitted) < min_sections:
        largest_index = max(range(len(fitted)), key=lambda idx: len(fitted[idx].lines))
        largest = fitted.pop(largest_index)
        split = _split_section(largest, 2)
        if len(split) == 1:
            fitted.insert(largest_index, largest)
            break
        for offset, item in enumerate(split):
            fitted.insert(largest_index + offset, item)

    if len(fitted) > max_sections:
        fitted = _merge_sections_to_count(fitted, max_sections)

    return fitted


def _allocate_section_durations(sections: list[_LyricSection], total_ms: int) -> list[int]:
    if not sections:
        return []

    min_total = len(sections) * 3_000
    if min_total > total_ms:
        raise MusicGenerationError(
            "The selected duration is too short for the provided lyrics. "
            "Increase the length or reduce the number of lyric sections."
        )

    weights = [max(1, len(section.lines)) for section in sections]
    remaining = total_ms - min_total
    durations = [3_000 for _ in sections]

    if remaining > 0:
        total_weight = sum(weights)
        extras = [int(remaining * weight / total_weight) for weight in weights]
        for index, extra in enumerate(extras):
            durations[index] += extra
        distributed = sum(extras)
        remainder = remaining - distributed
        order = sorted(range(len(weights)), key=lambda idx: weights[idx], reverse=True)
        for index in order[:remainder]:
            durations[index] += 1

    adjusted = durations[:]
    overflow_indices = [idx for idx, duration in enumerate(adjusted) if duration > 120_000]
    while overflow_indices:
        overflow = overflow_indices.pop(0)
        extra = adjusted[overflow] - 120_000
        adjusted[overflow] = 120_000
        target_indices = [
            idx
            for idx in range(len(adjusted))
            if idx != overflow and adjusted[idx] < 120_000
        ]
        if not target_indices:
            raise MusicGenerationError(
                "Could not fit the selected duration into valid ElevenLabs lyric "
                "sections. Add more lyric breaks or shorten the song length."
            )
        for idx in target_indices:
            if extra <= 0:
                break
            room = 120_000 - adjusted[idx]
            take = min(room, extra)
            adjusted[idx] += take
            extra -= take
        if extra > 0:
            raise MusicGenerationError(
                "Could not fit the selected duration into valid ElevenLabs lyric "
                "sections. Add more lyric breaks or shorten the song length."
            )
        overflow_indices = [idx for idx, duration in enumerate(adjusted) if duration > 120_000]

    return adjusted


def extract_lyrics_from_composition_plan(composition_plan: dict[str, Any] | None) -> str | None:
    if not composition_plan:
        return None
    sections = composition_plan.get("sections") or []
    blocks: list[str] = []
    for section in sections:
        section_name = _normalize_text(
            section.get("section_name") if isinstance(section, dict) else None
        )
        lines = section.get("lines") if isinstance(section, dict) else None
        if not isinstance(lines, list):
            continue
        cleaned_lines = [str(line).strip() for line in lines if str(line).strip()]
        if not cleaned_lines:
            continue
        if section_name:
            blocks.append(f"[{section_name}]\n" + "\n".join(cleaned_lines))
        else:
            blocks.append("\n".join(cleaned_lines))
    return "\n\n".join(blocks) or None


def build_composition_plan(
    *,
    prompt: str,
    lyrics: str,
    length_seconds: int,
    negative_prompt: str | None = None,
    extra_hints: list[str] | None = None,
) -> MusicPrompt:
    normalized_lyrics = _normalize_text(lyrics)
    if not normalized_lyrics:
        raise MusicGenerationError("lyrics cannot be empty when the Lyrics tab is enabled.")

    total_ms = length_seconds * 1000
    sections = _fit_sections_to_duration(_parse_lyric_blocks(normalized_lyrics), total_ms)
    durations = _allocate_section_durations(sections, total_ms)
    positive_global_styles = _split_style_hints(prompt)
    positive_global_styles.extend(_split_style_hints("; ".join(extra_hints or [])))
    positive_global_styles = _dedupe_preserving_order(positive_global_styles) or [prompt.strip()]
    negative_global_styles = _split_style_hints(negative_prompt)

    song_sections = [
        SongSection(
            section_name=section.name[:100],
            positive_local_styles=positive_global_styles,
            negative_local_styles=negative_global_styles,
            duration_ms=durations[index],
            lines=section.lines,
        )
        for index, section in enumerate(sections)
    ]

    return MusicPrompt(
        positive_global_styles=positive_global_styles,
        negative_global_styles=negative_global_styles,
        sections=song_sections,
    )


async def generate_song_file(
    *,
    api_key: str,
    model: str,
    prompt: str | None,
    composition_plan: MusicPrompt | None,
    length_seconds: int,
    output_format: str = DEFAULT_OUTPUT_FORMAT,
    with_timestamps: bool = False,
    force_instrumental: bool = False,
    output_subdir: str = DEFAULT_OUTPUT_SUBDIR,
    filename_hint: str | None = None,
    seed: int | None = None,
) -> GeneratedMusicFile:
    if not api_key.strip():
        raise MusicGenerationError("ELEVENLABS_API_KEY is not configured.")
    if length_seconds < 3:
        raise MusicGenerationError("lengthSeconds must be at least 3.")
    if prompt and composition_plan:
        raise MusicGenerationError(
            "Provide either a prompt or lyrics-driven composition plan, not both."
        )
    if not prompt and composition_plan is None:
        raise MusicGenerationError("A prompt or lyrics-driven composition plan is required.")
    if composition_plan is not None and force_instrumental:
        raise MusicGenerationError("forceInstrumental cannot be combined with custom lyrics.")

    output_dir = (DATA_DIR / output_subdir).resolve()
    try:
        output_dir.relative_to(DATA_DIR)
    except ValueError as exc:
        raise MusicGenerationError(
            "ELEVENLABS_OUTPUT_SUBDIR must resolve inside the data/ directory."
        ) from exc
    output_dir.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=240) as httpx_client:
        client = AsyncElevenLabs(api_key=api_key, httpx_client=httpx_client)
        try:
            response = await client.music.compose_detailed(
                output_format=output_format,
                prompt=prompt,
                composition_plan=composition_plan,
                music_length_ms=length_seconds * 1000 if prompt else None,
                model_id=model or DEFAULT_ELEVENLABS_MODEL,
                seed=seed if composition_plan is not None else None,
                force_instrumental=force_instrumental if prompt else None,
                with_timestamps=with_timestamps,
            )
        except ElevenLabsApiError as exc:
            if exc.status_code == 402:
                raise MusicGenerationError(
                    "ElevenLabs Music API requires a paid plan. "
                    "Upgrade your ElevenLabs account to enable music generation via the API."
                ) from exc
            raise MusicGenerationError(
                f"ElevenLabs returned an error (HTTP {exc.status_code}): {exc.body}"
            ) from exc
        except Exception as exc:
            raise MusicGenerationError(f"ElevenLabs request failed: {exc}") from exc

    if not response.audio:
        raise MusicGenerationError("No audio was returned by ElevenLabs.")

    output_path = _next_output_path(output_dir, filename_hint or response.filename, output_format)
    output_path.write_bytes(response.audio)

    storage_url = f"data/{output_path.relative_to(DATA_DIR).as_posix()}"
    inferred = infer_local_audio_metadata(storage_url) or {}
    response_json = response.json or {}
    composition_plan_json = (
        response_json.get("composition_plan")
        or response_json.get("compositionPlan")
    )
    song_metadata = response_json.get("song_metadata") or response_json.get("songMetadata")
    words_timestamps = response_json.get("words_timestamps") or response_json.get("wordsTimestamps")
    mime_type = guess_media_type(output_path, fallback_format=guess_audio_format(output_path.name))

    return GeneratedMusicFile(
        storage_url=storage_url,
        absolute_path=output_path,
        mime_type=mime_type,
        sample_rate_hz=inferred.get("sample_rate_hz"),
        channels=inferred.get("channels"),
        file_size_bytes=int(inferred.get("file_size_bytes") or output_path.stat().st_size),
        duration_ms=inferred.get("duration_ms"),
        output_format=output_format,
        song_id=response.song_id,
        composition_plan=composition_plan_json,
        song_metadata=song_metadata,
        words_timestamps=words_timestamps if isinstance(words_timestamps, list) else None,
        lyrics=extract_lyrics_from_composition_plan(composition_plan_json),
    )
