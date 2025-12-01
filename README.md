# Myndral

Local-first Ursina game scaffold with LangChain/LangGraph hooks. This repo targets Python 3.12 and is managed with [`uv`](https://docs.astral.sh/uv/).

## Features
- `uv`-managed isolated environment pinned to Python 3.12
- Starter Ursina app with a rotating cube to verify rendering
- LangChain + LangGraph v1 dependencies wired in with a stub graph class
- Clear entrypoints for adding AI-driven gameplay logic

## Getting Started
```bash
uv sync  # creates virtualenv and installs dependencies
uv run myndral  # launches the Ursina sample scene
```

## Development Notes
- Keep development offline-friendly; all assets live in this repo.
- Extend `src/myndral/ai_graph.py` with LangChain/LangGraph components.
- Game loop entrypoint lives in `src/myndral/main.py`.
