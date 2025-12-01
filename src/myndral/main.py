"""Entrypoint for the third-person medieval maze demo."""

from __future__ import annotations

from .game import MazeGame

MAZE_LAYOUT = [
    "###################",
    "#S..#......#......#",
    "#..###.####.#.###.#",
    "#..#....#..#...#..#",
    "#..##.#.#..###.#..#",
    "#....#.#......#...#",
    "####.#.######.#.###",
    "#....#....#...#...#",
    "#.######.#.#####..#",
    "#......#.#.....#..#",
    "###.##.#.#.###.#..#",
    "#...#..#.#...#.#..#",
    "#.#.####.###.#.##.#",
    "#.#......#...#....#",
    "###################",
]


def main() -> None:
    """Launch the Ursina application."""

    MazeGame(layout=MAZE_LAYOUT).run()
