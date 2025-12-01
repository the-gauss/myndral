"""Third-person player controller with a static follow camera."""

from __future__ import annotations

import math

from ursina import Entity, Vec3, camera, color, held_keys, time, window

from .maze import Maze


class ThirdPersonController(Entity):
    """Lightweight character controller for navigating the maze."""

    def __init__(
        self,
        maze: Maze,
        start_position: Vec3,
        move_speed: float = 5.0,
    ) -> None:
        super().__init__(
            model="cube",
            color=color.azure,
            collider="box",
            scale=(0.6, 1.2, 0.6),
            position=start_position + Vec3(0, 0.6, 0),
        )
        self._maze = maze
        self._speed = move_speed
        self._camera_offset = Vec3(45, 70, -30)

        camera.parent = None
        camera.world_position = self.world_position + self._camera_offset
        camera.look_at(self.world_position + Vec3(0, 1, 0))
        camera.fov = 30
        window.exit_button = "control+q"

    def update(self) -> None:  # type: ignore[override]
        self._apply_movement()
        self._update_camera()

    def _apply_movement(self) -> None:
        input_dir = Vec3(
            float(held_keys.get("d", 0)) - float(held_keys.get("a", 0)),
            0,
            float(held_keys.get("w", 0)) - float(held_keys.get("s", 0)),
        )
        if not input_dir.length():
            return

        direction = input_dir.normalized()
        desired = direction * self._speed * time.dt

        self.rotation_y = math.degrees(math.atan2(direction.x, direction.z))

        self._move_with_collision(desired)

    def _update_camera(self) -> None:
        camera.world_position = self.world_position + self._camera_offset
        camera.look_at(self.world_position + Vec3(0, 1, 0))

    def _move_with_collision(self, delta: Vec3) -> None:
        original = self.position

        attempt_x = original + Vec3(delta.x, 0, 0)
        if not self._maze.is_blocked(attempt_x):
            self.position = attempt_x

        attempt_z = self.position + Vec3(0, 0, delta.z)
        if not self._maze.is_blocked(attempt_z):
            self.position = attempt_z
