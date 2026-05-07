#!/usr/bin/env python3
"""
Phase D — render PNG comparison do schematic SVG hand-drawn.

Extrai o `<svg>...</svg>` do HTML demo, substitui as CSS variables por
valores fixos por cenário, renderiza via cairosvg.
"""
import math
import re
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "_design-reference/celta-schematic.html"
OUT = ROOT / "assets/_previews/celta-phase-d-COMPARISON.png"

CELL_W = 380
CELL_H = 620
COLS = 3
GAP = 12
PAD = 18
HEADER = 40
LABEL_H = 28


def extract_svg(html_text):
    m = re.search(r'<svg[^>]*xmlns=[^>]*>.*?</svg>', html_text, re.S)
    if not m:
        raise SystemExit("svg block not found")
    return m.group(0)


# Each scenario maps part_id -> hex color string (or uses helper for ramps).
def lerp(a, b, t):
    a = a.lstrip("#"); b = b.lstrip("#")
    ar, ag, ab = int(a[0:2], 16), int(a[2:4], 16), int(a[4:6], 16)
    br, bg, bb = int(b[0:2], 16), int(b[2:4], 16), int(b[4:6], 16)
    r = round(ar + (br - ar) * t); g = round(ag + (bg - ag) * t); bb2 = round(ab + (bb - ab) * t)
    return f"#{r:02x}{g:02x}{bb2:02x}"


def temp_ramp(t):
    if t < 0.30: return lerp("#1B5BFF", "#5DD18C", t / 0.30)
    if t < 0.60: return lerp("#5DD18C", "#FFCC1A", (t - 0.30) / 0.30)
    return lerp("#FFCC1A", "#FF5A1F", (t - 0.60) / 0.40)


def tire_color(t):
    base = "#2A2F38"
    if t < 0.10: return lerp(base, "#1B5BFF", (0.10 - t) / 0.10)
    if t > 0.90: return lerp(base, "#FF5A1F", (t - 0.90) / 0.10)
    if t > 0.65: return lerp(base, "#FFCC1A", (t - 0.65) / 0.25)
    if t < 0.35: return lerp(base, "#1B5BFF", (0.35 - t) / 0.25)
    return base


def shock_color(t):
    if t < 0.40: return lerp("#1B5BFF", "#5DEAFF", (0.40 - t) / 0.40)
    if t > 0.60: return lerp("#1B5BFF", "#FF5A1F", (t - 0.60) / 0.40)
    return "#1B5BFF"


def coil_color(t):
    if t < 0.75: return "#1B5BFF"
    return lerp("#1B5BFF", "#FF5A1F", (t - 0.75) / 0.25)


# Build a state dict: part_id -> color
def state(t_tire=0.5, t_shock=0.5, t_coil=0.5, t_engine=0.5,
          overrides=None):
    s = {}
    for p in ("FL", "FR", "RL", "RR"):
        s[f"tire-{p}"]  = tire_color(t_tire)
        s[f"shock-{p}"] = shock_color(t_shock)
        s[f"coil-{p}"]  = coil_color(t_coil)
    s["engine"]   = temp_ramp(t_engine)
    s["gearbox"]  = temp_ramp(t_engine)
    s["radiator"] = temp_ramp(t_engine)
    s["body"]     = "#FFCC1A"
    if overrides:
        s.update(overrides)
    return s


SCENARIOS = [
    ("Normal · setup ok",
     state()),
    ("Pneu RR superaquecendo",
     state(overrides={"tire-RR": tire_color(0.95)})),
    ("Pneu FL frio",
     state(overrides={"tire-FL": tire_color(0.05)})),
    ("Mola RL com problema",
     state(overrides={"coil-RL": coil_color(0.92)})),
    ("Amortecedor RR comprometido",
     state(overrides={"shock-RR": shock_color(0.90)})),
    ("Motor superaquecendo",
     state(t_engine=0.92)),
]


def apply_state_to_svg(svg_text, state_dict):
    """Replace `var(--xxx)` with hardcoded color per the state. Operates
    on the SVG text directly because cairosvg doesn't honor CSS variables.
    """
    out = svg_text
    for pid, color in state_dict.items():
        out = out.replace(f"var(--{pid})", color)
    # remove any leftover var() with a sane default
    out = re.sub(r"var\(--[^)]+\)", "#888888", out)
    return out


def render_svg(svg_text, w, h):
    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as f:
        f.write(svg_text.encode("utf-8"))
        in_path = f.name
    out_path = in_path + ".png"
    try:
        subprocess.run(
            ["cairosvg", in_path, "-o", out_path,
             "--output-width", str(w), "--output-height", str(h)],
            check=True, capture_output=True,
        )
        return Image.open(out_path).convert("RGBA")
    finally:
        for p in (in_path, out_path):
            try: __import__("os").unlink(p)
            except FileNotFoundError: pass


def main():
    html_text = HTML.read_text(encoding="utf-8")
    svg_text = extract_svg(html_text)
    # Strip explicit width/height so cairosvg respects -W/-H
    svg_text = re.sub(r'\swidth="\d+"', '', svg_text, count=1)
    svg_text = re.sub(r'\sheight="\d+"', '', svg_text, count=1)

    rows = math.ceil(len(SCENARIOS) / COLS)
    canvas_w = PAD * 2 + CELL_W * COLS + GAP * (COLS - 1)
    canvas_h = PAD * 2 + HEADER + (CELL_H + LABEL_H + GAP) * rows
    canvas = Image.new("RGB", (canvas_w, canvas_h), (16, 16, 18))
    cd = ImageDraw.Draw(canvas)
    try:
        title_f = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        label_f = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except Exception:
        title_f = ImageFont.load_default(); label_f = ImageFont.load_default()
    cd.text((PAD, PAD - 4),
            "Celta · Phase D · objects-as-vector (no mask) — recolor por CSS var",
            fill=(255, 204, 26), font=title_f)

    for idx, (label, st) in enumerate(SCENARIOS):
        col = idx % COLS; row = idx // COLS
        cx = PAD + col * (CELL_W + GAP)
        cy = PAD + HEADER + row * (CELL_H + LABEL_H + GAP)
        applied = apply_state_to_svg(svg_text, st)
        img = render_svg(applied, CELL_W, CELL_H).convert("RGB")
        canvas.paste(img, (cx, cy))
        cd.text((cx, cy + CELL_H + 4), label, fill=(240, 240, 240), font=label_f)
        print(f"[ok] {label}")

    canvas.save(OUT, "PNG", optimize=True)
    print(f"\nwrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
