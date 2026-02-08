# Algorithm Overview

This project implements a solver for the "A-Puzzle-A-Day" calendar puzzle. The goal is to place a set of irregular pieces onto a board such that every cell is covered except for the specific tiles representing the current date.

## 1. Core Logic: Backtracking Search

The solver utilizes a **Backtracking** algorithm (a form of Depth-First Search) to explore the vast space of possible piece arrangements.

The process follows a recursive trial-and-error strategy:

* **Piece Selection**: The algorithm attempts to place unused pieces onto the board one by one.
* **Recursive Exploration**: Once a piece is successfully placed, the solver moves to the next step to place the remaining pieces.
* **Backtracking**: If the solver reaches a state where no remaining pieces can fit into the available empty spaces, it "backtracks" by removing the last placed piece and trying a different orientation or a different piece altogether.

## 2. Efficiency Strategy: The "First-Empty-Cell" Rule

To significantly reduce the search space and avoid redundant permutations, the solver follows a strict placement order:

* **Scanning Order**: Instead of trying to place pieces anywhere on the board, the algorithm always identifies the **first available empty cell** (scanning from top-to-bottom, left-to-right).
* **Targeted Placement**: It only attempts to place pieces that can cover that specific cell. This ensures that the algorithm doesn't waste time exploring the same configuration in different sequences, effectively pruning the search tree.

## 3. Piece Transformations

For every piece selected, the solver exhaustively tests all valid physical orientations:

* **Rotation**: Rotating the piece (0°, 90°, 180°, 270°).
* **Reflection (Optional)**: Flipping the piece to its mirror image, if the solver configuration allows.

## 4. Termination and Results

The search continues until:

1. **A Solution is Found**: All pieces are placed on the board without overlaps, leaving only the target date cells empty.
2. **Exhaustion**: All possible combinations have been tested.

The solver can be configured to either stop after finding the first valid solution or continue until it has discovered all possible unique solutions for a given date.
