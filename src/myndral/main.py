"""Entrypoint for the third-person medieval maze demo."""

from __future__ import annotations

from .opening import OpeningGame

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

    OpeningGame().run()
