# Myndral

Local-first Ursina maze demo with LangChain/LangGraph hooks available for later AI logic. Targets Python 3.12 and is managed with [`uv`](https://docs.astral.sh/uv/).

## Features
- `uv`-managed isolated environment pinned to Python 3.12.
- Third-person Ursina maze with mouse look + WASD movement.
- Medieval-inspired wall/floor textures stored locally in `src/myndral/assets/textures`.
- LangChain + LangGraph v1 dependencies wired in with a stub graph class for future AI features.

## Getting Started
```bash
uv sync  # creates virtualenv and installs dependencies
uv run myndral  # launches the Ursina sample scene
```

## Controls
- Mouse move: orbit camera behind/above the player.
- W / A / S / D: move forward, strafe, back.
- Esc: toggle mouse capture to regain your cursor.
- Ctrl+Q: quit the demo window.

## Development Notes
- Keep development offline-friendly; all assets live in this repo under `src/myndral/assets`.
- Extend `src/myndral/ai_graph.py` with LangChain/LangGraph components when adding AI-driven narration or gameplay.
- Game loop entrypoint lives in `src/myndral/main.py`; scene setup is in `src/myndral/game.py`; movement logic is in `src/myndral/player.py`.
