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
                scale=(100, 1, 100),
                color=color.rgb(0.3, 0.5, 0.3),
                texture="grass",
                collider="box",
            )
        )

        # --- Layout Implementation ---
        # Coordinate system approximation:
        # Spawn at (0, 0, 0)
        # Path goes Right (+X) then splits Up (+Z) and Down (-Z)
        # Wait, looking at sketch:
        # Spawn is Top-Left-ish. Path goes Right.
        # Then T-junction.
        # Down path leads to Lake (Left-Down) and NPC (Right-Down).
        # Right path leads to Gate.
        
        # Let's re-orient based on sketch:
        # Player Spawn is at top-left.
        # Path goes Right.
        # Then a junction.
        # One path goes Down-Left to Lake/Rocks/Bench.
        # One path goes Right to Gate.
        # One path goes Down-Right to NPC.
        
        # Let's build "Negative Space" (Walls) to define the paths.
        
        wall_color = color.rgb(0.2, 0.2, 0.2)
        wall_height = 3
        
        # 1. Top Wall (above Spawn and path to Gate)
        self._add_obstacle(position=(10, 1.5, 5), scale=(60, wall_height, 5), color=wall_color)
        
        # 2. Left Wall (left of Spawn)
        self._add_obstacle(position=(-10, 1.5, -10), scale=(5, wall_height, 40), color=wall_color)
        
        # 3. Island Wall (Between Spawn path and Lake path)
        # This is the block below the spawn path and right of the lake path
        self._add_obstacle(position=(5, 1.5, -5), scale=(15, wall_height, 10), color=wall_color)
        
        # 4. Bottom-Left Wall (Below Lake)
        self._add_obstacle(position=(-5, 1.5, -25), scale=(30, wall_height, 10), color=wall_color)
        
        # 5. Middle-Right Wall (Between NPC path and Gate path)
        self._add_obstacle(position=(25, 1.5, -5), scale=(20, wall_height, 10), color=wall_color)
        
        # 6. Bottom-Right Wall (Below NPC path)
        self._add_obstacle(position=(25, 1.5, -25), scale=(40, wall_height, 10), color=wall_color)
        
        # 7. Far Right Wall (Right of Gate and NPC)
        self._add_obstacle(position=(45, 1.5, -10), scale=(5, wall_height, 40), color=wall_color)

        # --- Landmarks ---
        
        # Lake (Blue plane near bottom left)
        # Path to lake is roughly (-5, 0, -15)
        self.entities.append(
            Entity(
                model="plane",
                position=(-10, 0.01, -15),
                scale=(8, 1, 8),
                color=color.blue,
                texture="water", # Ursina might not have this, uses color if not found
            )
        )
        
        # Rocks (Near Lake)
        self._add_obstacle(position=(-15, 0.5, -12), scale=(1, 1, 1), color=color.gray, model="sphere")
        self._add_obstacle(position=(-16, 0.7, -14), scale=(1.5, 1.5, 1.5), color=color.dark_gray, model="sphere")
        
        # Bench (Near Lake path)
        # Simple bench construction
        bench_pos = (-2, 0.5, -15)
        self._add_obstacle(position=bench_pos, scale=(2, 0.5, 0.8), color=color.brown) # Seat
        self._add_obstacle(position=(bench_pos[0], 1, bench_pos[1]+0.3), scale=(2, 0.5, 0.1), color=color.brown) # Back
        
        # Gate (Top Right)
        gate_pos = (35, 1.5, 0)
        self._add_obstacle(position=gate_pos, scale=(1, 3, 4), color=color.black)
        # Lock icon/box
        self.entities.append(
            Entity(
                model="cube",
                position=(34.5, 1.5, 0),
                scale=(0.5, 0.5, 0.5),
                color=color.gold
            )
        )

        # NPC (Bottom Right)
        npc = NPC(position=(35, 1, -15))
        self.entities.append(npc)
        self.obstacles.append(npc)

    def _add_obstacle(self, position, scale, color, model="cube"):
        e = Entity(
            model=model,
            position=position,
            scale=scale,
            color=color,
            collider="box",
            texture="brick" if model == "cube" else None
        )
        self.entities.append(e)
        self.obstacles.append(e)
