#!/usr/bin/env python3
"""
Renders assets/_previews/AUDIT-parts.png — a 4×4 grid where each cell shows
the original photo with one part highlighted (magenta for visible, cyan for
hidden) so you can visually verify the polygon mapping.

Reads the part definitions directly from assets/celta_exploded_partmap.svg
(the SVG produced by refine_celta_partmap.py).
"""
import re
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SVG_PATH = ROOT / "assets/celta_exploded_partmap.svg"
PHOTO_PATH = ROOT / "assets/celta_exploded.png"
OUT_PATH = ROOT / "assets/_previews/AUDIT-parts.png"

CELL = 380
COLS = 4
GAP = 8
PAD = 16
HEADER = 36

VISIBLE_FILL   = (255, 28, 200, 175)
VISIBLE_STROKE = (255, 28, 200, 255)
HIDDEN_FILL    = (40, 220, 255, 175)
HIDDEN_STROKE  = (40, 220, 255, 255)
DARK_OUTLINE   = (0, 0, 0, 220)

PATH_RE = re.compile(
    r'<path[^>]*\bid="([^"]+)"[^>]*\bd="([^"]+)"[^>]*?(?:\bdata-hidden="true")?',
    re.S,
)

def parse_path_d(d):
    """Parse SVG path with M/L/Z commands (commands may be glued to numbers)."""
    pts = []
    # split commands from numbers: "M450 1564 L433" → ["M","450","1564","L","433"]
    norm = re.sub(r'([MLZmlz])', r' \1 ', d).replace(",", " ")
    tokens = norm.split()
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t in ("M", "L", "m", "l"):
            try:
                x = float(tokens[i + 1]); y = float(tokens[i + 2]); i += 3
                pts.append((x, y))
            except (ValueError, IndexError):
                i += 1
        elif t in ("Z", "z"):
            i += 1
        else:
            try:
                x = float(t); y = float(tokens[i + 1]); i += 2
                pts.append((x, y))
            except (ValueError, IndexError):
                i += 1
    return pts

def parse_svg_parts(svg_text):
    """Returns list of (part_id, points, is_hidden) in document order."""
    parts = []
    # split into the two groups so we know which is visible vs hidden
    visible_block = re.search(r'<g class="visible-parts".*?</g>', svg_text, re.S)
    hidden_block  = re.search(r'<g class="hidden-parts".*?</g>',  svg_text, re.S)
    for block, hidden in [(visible_block, False), (hidden_block, True)]:
        if block is None: continue
        for m in re.finditer(r'<path\s+id="([^"]+)"[^>]*d="([^"]+)"', block.group(0)):
            pid, d = m.group(1), m.group(2)
            parts.append((pid, parse_path_d(d), hidden))
    return parts

def main():
    svg_text = SVG_PATH.read_text(encoding="utf-8")
    parts = parse_svg_parts(svg_text)
    n = len(parts)
    rows = math.ceil(n / COLS)

    photo = Image.open(PHOTO_PATH).convert("RGBA")
    pw, ph = photo.size

    grid_w = PAD * 2 + CELL * COLS + GAP * (COLS - 1)
    grid_h = PAD * 2 + HEADER + (CELL + HEADER + GAP) * rows
    canvas = Image.new("RGBA", (grid_w, grid_h), (16, 16, 18, 255))
    cd = ImageDraw.Draw(canvas)

    try:
        title_font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        label_font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except Exception:
        title_font = ImageFont.load_default()
        label_font = ImageFont.load_default()

    cd.text((PAD, PAD - 4), "AUDITORIA · contornos auto-extraídos · v3",
            fill=(255, 204, 26, 255), font=title_font)

    for idx, (pid, pts, hidden) in enumerate(parts):
        col = idx % COLS
        row = idx // COLS
        cx = PAD + col * (CELL + GAP)
        cy = PAD + HEADER + row * (CELL + HEADER + GAP)

        # downscale photo into cell
        cell_img = photo.copy().resize((CELL, CELL), Image.LANCZOS)
        overlay = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        if pts:
            scaled = [(int(x * CELL / pw), int(y * CELL / ph)) for x, y in pts]
            fill = HIDDEN_FILL if hidden else VISIBLE_FILL
            stroke = HIDDEN_STROKE if hidden else VISIBLE_STROKE
            od.polygon(scaled, fill=fill, outline=DARK_OUTLINE, width=3)
            # second pass: bright stroke on top so shape is unambiguous
            od.line(scaled + [scaled[0]], fill=stroke, width=2, joint="curve")
        cell_img = Image.alpha_composite(cell_img, overlay)
        canvas.paste(cell_img, (cx, cy))

        label = f"{pid}{'  · oculto' if hidden else ''}"
        color = HIDDEN_STROKE if hidden else (255, 255, 255, 255)
        cd.text((cx, cy + CELL + 4), label, fill=color, font=label_font)

    canvas.convert("RGB").save(OUT_PATH, "PNG", optimize=True)
    print(f"wrote {OUT_PATH}  ({OUT_PATH.stat().st_size/1024:.0f} KB)")

if __name__ == "__main__":
    main()
