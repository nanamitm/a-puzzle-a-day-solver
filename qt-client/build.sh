#!/usr/bin/env bash
# Build script for Linux / macOS
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."

# ── Step 1: Build the Rust FFI library ────────────────────────────────────
echo "[1/2] Building Rust FFI library..."
cd "$REPO_DIR"
cargo build -p solver-ffi --release

# ── Step 2: Build the Qt6 client ──────────────────────────────────────────
echo "[2/2] Building Qt6 client..."
cd "$SCRIPT_DIR"
mkdir -p build

# If Qt6 is not on the default CMake search path, set CMAKE_PREFIX_PATH:
#   export CMAKE_PREFIX_PATH=/path/to/Qt/6.x.x/gcc_64   # Linux
#   export CMAKE_PREFIX_PATH=/path/to/Qt/6.x.x/macos    # macOS
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release ${CMAKE_PREFIX_PATH:+-DCMAKE_PREFIX_PATH="$CMAKE_PREFIX_PATH"}
cmake --build build --parallel

echo ""
echo "Build succeeded!"
echo "Executable: $SCRIPT_DIR/build/APuzzleADaySolverGUI"
