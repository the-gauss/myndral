"""Opening scene application setup."""

from __future__ import annotations

from pathlib import Path

from ursina import AmbientLight, DirectionalLight, Ursina, Vec3, application, color

from .player import ThirdPersonController
from .world import World


class OpeningGame:
    """Creates and runs the opening scene."""

    def __init__(self) -> None:
        self._configure_assets()
        self.app = Ursina(borderless=False, development_mode=False)
        self._build_scene()

    def _configure_assets(self) -> None:
        asset_folder = Path(__file__).resolve().parent / "assets"
        application.asset_folder = asset_folder

    def _build_scene(self) -> None:
        world = World()
        world.build()

        # We need a 'maze' interface for the player controller for collision
        # For now, we can create a dummy wrapper or modify the player to take a collider list
        # But looking at player.py, it expects a maze object with is_blocked.
        # Let's create a dummy adapter for now to minimize changes to player.py
        # or better, let's just make the player collide with the world entities using standard Ursina collision
        # The current player uses `_move_with_collision` which calls `maze.is_blocked`.
        # We should probably adapt the World to provide `is_blocked` or update Player.
        
        # Re-reading player.py:
        # def _move_with_collision(self, delta: Vec3) -> None:
        #     ...
        #     if not self._maze.is_blocked(attempt_x):
        #         self.position = attempt_x
        
        # So we need an object that has `is_blocked`.
        
        self.player = ThirdPersonController(
            maze=WorldAdapter(world), # We'll define this below
            start_position=Vec3(0, 0, 0)
        )

        self._sun = DirectionalLight(shadows=True)
        self._sun.look_at(Vec3(1, -2, -1))
        self._ambient = AmbientLight(color=color.rgba(120, 120, 120, 255))

    def run(self) -> None:
        self.app.run()


class WorldAdapter:
    """Adapts the World to the interface expected by ThirdPersonController."""
    
    def __init__(self, world: World):
        self.world = world

    def is_blocked(self, position: Vec3, radius: float = 0.35) -> bool:
        # Simple raycast or boxcast check could work, but Ursina has built-in collision.
        # However, the player controller is written to use this specific method.
        # Let's implement a simple check against the obstacles in the world.
        # Since we only have a few obstacles, we can iterate.
        # For a larger world, we'd want spatial partitioning or use Ursina's physics.
        
        # For now, let's just check against the manual obstacles we added.
        # The ground is y=0.
        
        # Check against obstacles
        # Check against obstacles
        for entity in self.world.obstacles:
            if self._check_collision(position, entity, radius):
                return True
                
        return False

    def _check_collision(self, pos: Vec3, entity: Entity, radius: float) -> bool:
        # A simple circle/box check on XZ plane
        # Entity scale is (2,2,2) for obstacles
        
        half_w = entity.scale_x / 2
        half_d = entity.scale_z / 2
        
        # Expand bounds by radius
        min_x = entity.x - half_w - radius
        max_x = entity.x + half_w + radius
        min_z = entity.z - half_d - radius
        max_z = entity.z + half_d + radius
        
        return (min_x <= pos.x <= max_x) and (min_z <= pos.z <= max_z)

