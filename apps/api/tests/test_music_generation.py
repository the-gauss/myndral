from myndral_api.music_generation import (
    WeightedPromptInput,
    build_composition_plan,
    build_song_prompt,
    extract_lyrics_from_composition_plan,
)


def test_build_song_prompt_prefers_vocals_and_preserves_hints() -> None:
    prompt = build_song_prompt(
        prompt='cinematic synth-pop anthem',
        weighted_prompts=[
            WeightedPromptInput(text='female lead', weight=1.4),
            WeightedPromptInput(text='trap hats', weight=-0.5),
        ],
        negative_prompt='harsh clipping',
        prefer_vocals=True,
        extra_hints=['Tempo around 118 BPM'],
    )

    assert 'full song with lead vocals' in prompt.lower()
    assert 'Strongly emphasize female lead' in prompt
    assert 'Avoid trap hats' in prompt
    assert 'Avoid harsh clipping' in prompt
    assert 'Tempo around 118 BPM' in prompt


def test_build_composition_plan_uses_lyric_sections_and_total_duration() -> None:
    plan = build_composition_plan(
        prompt='dream-pop ballad',
        lyrics=(
            '[Verse 1]\nFirst light on the avenue\nI still hear your name\n\n'
            '[Chorus]\nStay until the skyline fades\nSing me into day'
        ),
        length_seconds=150,
        negative_prompt='distorted guitars',
    )

    assert len(plan.sections) == 2
    assert plan.sections[0].section_name == 'Verse 1'
    assert plan.sections[1].section_name == 'Chorus'
    assert plan.sections[0].lines == ['First light on the avenue', 'I still hear your name']
    assert sum(section.duration_ms for section in plan.sections) == 150_000
    assert plan.negative_global_styles == ['distorted guitars']


def test_build_composition_plan_splits_long_lyrics_into_valid_sections() -> None:
    plan = build_composition_plan(
        prompt='epic alt-pop closer',
        lyrics='\n'.join([
            'Open the gate',
            'Hold the line',
            'Carry the fire',
            'Turn the wheel',
            'Shake the ground',
            'Raise the flood',
            'Break the silence',
            'Call me home',
        ]),
        length_seconds=300,
    )

    assert len(plan.sections) >= 3
    assert all(3_000 <= section.duration_ms <= 120_000 for section in plan.sections)
    assert sum(section.duration_ms for section in plan.sections) == 300_000


def test_extract_lyrics_from_composition_plan_round_trips_sections() -> None:
    plan = build_composition_plan(
        prompt='nocturnal indie waltz',
        lyrics='[Verse]\nMoon in the rearview\nStreetlights humming\n\n[Chorus]\nStay with me now',
        length_seconds=90,
    )

    extracted = extract_lyrics_from_composition_plan(plan.model_dump(mode='python'))

    assert extracted is not None
    assert '[Verse]' in extracted
    assert '[Chorus]' in extracted
    assert 'Moon in the rearview' in extracted
    assert 'Stay with me now' in extracted
