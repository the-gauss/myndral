"""Third-person player controller with mouse orbit and WASD movement."""

from __future__ import annotations

import math

from ursina import Entity, Vec3, application, camera, clamp, color, held_keys, mouse, time, window

from .maze import Maze


class ThirdPersonController(Entity):
    """Lightweight character controller for navigating the maze."""

    def __init__(
        self,
        maze: Maze,
        start_position: Vec3,
        move_speed: float = 5.0,
        mouse_sensitivity: float = 45.0,
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
        self._mouse_sensitivity = mouse_sensitivity
        self._yaw = 0.0
        self._pitch = 25.0
        self._mouse_captured = False

        self.camera_pivot = Entity(parent=self, y=1.4)
        camera.parent = self.camera_pivot
        camera.position = Vec3(0, 14, -22)
        camera.rotation_x = self._pitch
        camera.fov = 65
        window.exit_button = "control+q"
        self._capture_mouse(True)

    def _capture_mouse(self, enabled: bool) -> None:
        self._mouse_captured = enabled
        mouse.locked = enabled
        if enabled:
            window.set_mouse_mode(window.M_relative)
            mouse.visible = False
        else:
            window.set_mouse_mode(window.M_absolute)
            mouse.visible = True
        if application.base:
            application.base.win.requestProperties(window)

    def update(self) -> None:  # type: ignore[override]
        self._update_view_angles()
        self._apply_movement()

    def input(self, key: str) -> None:  # type: ignore[override]
        if key == "escape":
            self._capture_mouse(not self._mouse_captured)

    def _update_view_angles(self) -> None:
        dx = mouse.velocity.x * self._mouse_sensitivity
        dy = mouse.velocity.y * self._mouse_sensitivity

        self._yaw += dx
        self._pitch = clamp(self._pitch - dy, 10, 55)

        self.rotation_y = self._yaw
        self.camera_pivot.rotation_x = self._pitch

    def _apply_movement(self) -> None:
        input_dir = Vec3(
            float(held_keys.get("d", 0)) - float(held_keys.get("a", 0)),
            0,
            float(held_keys.get("w", 0)) - float(held_keys.get("s", 0)),
        )
        if not input_dir.length():
            return

        input_dir = input_dir.normalized()
        forward = Vec3(
            math.sin(math.radians(self._yaw)),
            0,
            math.cos(math.radians(self._yaw)),
        )
        right = Vec3(forward.z, 0, -forward.x)
        desired = (forward * input_dir.z + right * input_dir.x) * self._speed * time.dt

        self._move_with_collision(desired)

    def _move_with_collision(self, delta: Vec3) -> None:
        original = self.position

        attempt_x = original + Vec3(delta.x, 0, 0)
        if not self._maze.is_blocked(attempt_x):
            self.position = attempt_x

        attempt_z = self.position + Vec3(0, 0, delta.z)
        if not self._maze.is_blocked(attempt_z):
            self.position = attempt_z
