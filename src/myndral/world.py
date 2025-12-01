"""World construction for the opening scene."""

from __future__ import annotations

from ursina import Entity, color, Vec3

from .npc import NPC


class World:
    """Manages the 3D environment for the opening scene."""

    def __init__(self):
        self.entities = []
        self.obstacles = []

    def build(self):
        # Ground plane
        self.entities.append(
            Entity(
                model="plane",
                scale=(50, 1, 50),
                color=color.rgb(0.3, 0.5, 0.3),
                texture="grass",
                collider="box",
            )
        )

        # Obstacles/Paths
        # Create a simple path with some obstacles
        obstacles = [
            (5, 1, 5),
            (-5, 1, 5),
            (5, 1, -5),
            (-5, 1, -5),
            (8, 1, 0),
            (-8, 1, 0),
        ]

        for pos in obstacles:
            e = Entity(
                model="cube",
                position=pos,
                scale=(2, 2, 2),
                color=color.gray,
                texture="brick",
                collider="box",
            )
            self.entities.append(e)
            self.obstacles.append(e)

        # NPC
        npc = NPC(position=(0, 1, 10))
        self.entities.append(npc)
        self.obstacles.append(npc) # Treat NPC as obstacle too
