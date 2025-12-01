"""Game entrypoint with Ursina scene + LangChain narrative hook."""

from __future__ import annotations

from ursina import Entity, Text, Ursina, color, time

from .ai_graph import NarrativeGraph


class DemoController(Entity):
    """Simple scene controller showcasing Ursina + LangGraph plumbing."""

    def __init__(self, narrator: NarrativeGraph) -> None:
        super().__init__()
        self._narrator = narrator
        self._event_idx = 0

        self.cube = Entity(model="cube", color=color.azure, scale=2)
        self.prompt = Text(
            text="Press SPACE to request a narrative beat",
            origin=(0, 0),
            y=.45,
            x=-.4,
            background=True,
        )
        self.log = Text(
            text="",
            origin=(0, 0),
            y=.35,
            x=-.5,
            wordwrap=40,
            background=True,
        )

    def input(self, key: str) -> None:  # type: ignore[override]
        if key == "space":
            self._event_idx += 1
            event = f"Player inspects rune #{self._event_idx}"
            self.log.text = self._narrator.describe_event(event)

    def update(self) -> None:  # type: ignore[override]
        self.cube.rotation_y += 30 * time.dt
        self.cube.rotation_x += 10 * time.dt


def main() -> None:
    """Spin up the Ursina app with demo scene."""

    app = Ursina()
    DemoController(NarrativeGraph())
    app.run()
