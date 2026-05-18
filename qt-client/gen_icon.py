"""Generate app icon (puzzle-board motif) as a multi-size ICO file."""
from PIL import Image, ImageDraw

# Piece colours matching PIECE_COLORS in boardwidget.cpp
PIECE = {
    1: (70,  130, 180),   # steel blue
    2: (255, 160,  50),   # orange
    3: ( 60, 179, 113),   # sea green
    4: (220,  80,  80),   # red
    5: (148, 103, 189),   # purple
}
AMBER  = (255, 200,  50)   # date-marker cells
EMPTY  = ( 85, 105, 125)   # empty cell
BG     = ( 28,  42,  56)   # outer background
BORDER = ( 80,  80,  80)

# 5-col x 4-row mini board layout (0=empty, -1=off-board, piece id otherwise)
# Represents a solved partial board to make a colourful, recognisable icon.
LAYOUT = [
    [ 2,  2,  1,  1,  1],
    [ 2, -1,  1,  3,  3],
    [ 4,  4,  5,  3,  3],
    [ 4,  5,  5,  5, -1],
]
# Cells to highlight as "date markers" (amber)
DATE_CELLS = {(0, 0), (1, 1)}   # two amber cells visible

ROWS = len(LAYOUT)
COLS = len(LAYOUT[0])


def make_frame(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img, "RGBA")

    # Background rounded rectangle
    r = max(3, size // 8)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)

    # Cell grid
    pad    = max(2, size // 16)
    board_w = size - 2 * pad
    board_h = size - 2 * pad
    cw = board_w / COLS
    ch = board_h / ROWS
    cr = max(1, size // 32)   # cell corner radius

    for row in range(ROWS):
        for col in range(COLS):
            pid = LAYOUT[row][col]
            x0 = int(pad + col * cw) + 1
            y0 = int(pad + row * ch) + 1
            x1 = int(pad + (col + 1) * cw) - 1
            y1 = int(pad + (row + 1) * ch) - 1

            if pid == -1:
                continue  # off-board — stays as background

            if (row, col) in DATE_CELLS:
                colour = AMBER
            elif pid == 0:
                colour = EMPTY
            else:
                colour = PIECE[pid]

            d.rounded_rectangle([x0, y0, x1, y1], radius=cr, fill=colour)

    return img


def main():
    sizes   = [16, 32, 48, 64, 128, 256]
    frames  = [make_frame(s) for s in sizes]

    out = "icon.ico"
    frames[0].save(
        out,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=frames[1:],
    )
    print(f"Saved {out}")

    # Also save a 256-png for the Qt resource
    frames[-1].save("icon.png")
    print("Saved icon.png")


if __name__ == "__main__":
    main()
