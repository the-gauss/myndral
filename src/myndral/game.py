"""Application setup for the third-person maze demo."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from ursina import AmbientLight, DirectionalLight, Ursina, Vec3, application, color

from .maze import Maze
from .player import ThirdPersonController


class MazeGame:
    """Creates and runs the Ursina application for the demo."""

    def __init__(self, layout: Iterable[str]) -> None:
        self._configure_assets()
        self.app = Ursina(borderless=False, development_mode=False)
        self._build_scene(layout)

    def _configure_assets(self) -> None:
        asset_folder = Path(__file__).resolve().parent / "assets"
        application.asset_folder = asset_folder

    def _build_scene(self, layout: Iterable[str]) -> None:
        maze = Maze(layout, wall_texture="stone_brick", floor_texture="flagstone_floor")
        maze.build()

        ThirdPersonController(maze=maze, start_position=maze.start)

        self._sun = DirectionalLight(shadows=True)
        self._sun.look_at(Vec3(1, -2, -1))
        self._ambient = AmbientLight(color=color.rgba(120, 120, 120, 255))

    def run(self) -> None:
        self.app.run()
