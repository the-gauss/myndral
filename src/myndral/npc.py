"""NPC entity definition."""

from __future__ import annotations

from ursina import Entity, color


class NPC(Entity):
    """A simple static NPC."""

    def __init__(self, position=(0, 0, 0)):
        super().__init__(
            model="cube",
            color=color.red,
            scale=(1, 2, 1),
            position=position,
            collider="box",
        )
