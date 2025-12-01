"""Maze construction and collision helpers."""

from __future__ import annotations

import math
from typing import Iterable, Set, Tuple

from ursina import Entity, Vec3, color, load_texture


class Maze:
    """Builds a grid-aligned maze with textured walls and floor."""

    def __init__(
        self,
        layout: Iterable[str],
        wall_texture: str,
        floor_texture: str,
    ) -> None:
        self._layout = [row.rstrip() for row in layout]
        self._wall_texture = wall_texture
        self._floor_texture = floor_texture
        self._wall_cells: Set[Tuple[int, int]] = set()
        self._start = Vec3(1, 0, 1)
        self._width = 0
        self._height = 0

    @property
    def start(self) -> Vec3:
        """World-space start location."""

        return self._start

    def build(self) -> None:
        wall_tex = load_texture(self._wall_texture)
        floor_tex = load_texture(self._floor_texture)

        self._width = max(len(row) for row in self._layout)
        self._height = len(self._layout)

        Entity(
            model="plane",
            texture=floor_tex,
            texture_scale=(self._width, self._height),
            scale=(self._width, 1, self._height),
            position=(self._width / 2 - 0.5, 0, self._height / 2 - 0.5),
            color=color.rgb(0.85, 0.82, 0.8),
        )

        for z, row in enumerate(self._layout):
            for x, cell in enumerate(row):
                world = Vec3(x, 0, z)
                if cell == "#":
                    Entity(
                        model="cube",
                        texture=wall_tex,
                        collider="box",
                        position=world + Vec3(0, 1, 0),
                        scale=(1, 2, 1),
                        color=color.white,
                    )
                    self._wall_cells.add((x, z))
                elif cell == "S":
                    self._start = world + Vec3(0, 0, 0)

    def is_blocked(self, position: Vec3, radius: float = 0.35) -> bool:
        """Returns True if the position overlaps a wall tile."""

        checks = (
            (position.x + radius, position.z + radius),
            (position.x + radius, position.z - radius),
            (position.x - radius, position.z + radius),
            (position.x - radius, position.z - radius),
        )
        return any(self._cell_is_wall(x, z) for x, z in checks)

    def _cell_is_wall(self, x: float, z: float) -> bool:
        cx = int(math.floor(x + 0.5))
        cz = int(math.floor(z + 0.5))
        if cx < 0 or cz < 0 or cx >= self._width or cz >= self._height:
            return True
        cell = (cx, cz)
        return cell in self._wall_cells
