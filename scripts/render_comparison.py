#!/usr/bin/env python3
"""
Renders assets/_previews/celta-phase-b-COMPARISON.png — a grid of scenarios
showing how the recolor + translucidez behaves under different telemetry
states.

Strategy: clone the canonical SVG for each scenario, mutate the per-part
fill/opacity/stroke + glow stdDeviation according to the same rules the demo
HTML uses, render with cairosvg.
"""
import re
import io
import math
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SVG_PATH = ROOT / "assets/celta_exploded_partmap.svg"
OUT_PATH = ROOT / "assets/_previews/celta-phase-b-COMPARISON.png"

CELL = 520
COLS = 3
GAP = 12
PAD = 18
HEADER = 38

HIDDEN = {"tire-FR", "tire-RL", "spring-FL", "spring-FR", "gearbox"}

# scenarios: dict mapping part-id -> t in [0..1]; missing = 0.5 (neutral)
def neutral(): return {p: 0.5 for p in [
    "tire-FL","tire-FR","tire-RL","tire-RR",
    "spring-FL","spring-FR","spring-RL","spring-RR",
    "engine","gearbox","radiator","body-paint","body-roof"]}

def with_(d, **upd):
    out = dict(d); out.update(upd); return out

base = neutral()
SCENARIOS = [
    ("Carro frio · todos azuis",      {p: 0.10 for p in base}),
    ("Janela ideal · sem tint",       base),
    ("Pneu RR superaquecendo",        with_(base, **{"tire-RR": 0.95})),
    ("Pneu FR (oculto) superaquecendo", with_(base, **{"tire-FR": 0.92})),
    ("Motor superaquecendo",          with_(base, engine=0.92, gearbox=0.78, radiator=0.80)),
    ("Câmbio (oculto) quente",        with_(base, gearbox=0.88)),
]

# --- color helpers (replicate the JS logic) ---

def lerp_hex(a, b, t):
    ar, ag, ab = int(a[1:3],16), int(a[3:5],16), int(a[5:7],16)
    br, bg, bb = int(b[1:3],16), int(b[3:5],16), int(b[5:7],16)
    r = round(ar + (br-ar)*t); g = round(ag + (bg-ag)*t); bcomp = round(ab + (bb-ab)*t)
    return f"#{r:02x}{g:02x}{bcomp:02x}"

def temp_color(t):
    if t < 0.35: return lerp_hex("#1B5BFF", "#5DD18C", t/0.35)
    if t < 0.65: return lerp_hex("#5DD18C", "#FFCC1A", (t-0.35)/0.30)
    return lerp_hex("#FFCC1A", "#FF5A1F", (t-0.65)/0.35)

def visible_attrs(t):
    op = abs(t - 0.5) * 1.1
    return temp_color(t), max(0, min(1, op))

def hidden_attrs(t):
    dev = abs(t - 0.5)
    color = "#FFFFFF" if dev < 0.05 else temp_color(t)
    stroke_op = round(0.30 + dev * 0.65, 3)
    fill_op   = round(min(0.30, dev * 0.55), 3)
    blur_r    = round(dev * 22, 1)
    return color, stroke_op, fill_op, blur_r, temp_color(t)

# --- mutate SVG ---

def render_scenario(svg_text, params):
    out = svg_text
    for pid, t in params.items():
        if pid in HIDDEN:
            color, sop, fop, blur, alarm_color = hidden_attrs(t)
            # Replace the path attrs for this hidden part
            pat = re.compile(
                rf'(<path id="{re.escape(pid)}"[^/]*?fill=)"[^"]*"([^/]*?fill-opacity=)"[^"]*"([^/]*?stroke=)"[^"]*"([^/]*?stroke-opacity=)"[^"]*"',
                re.S,
            )
            out = pat.sub(
                lambda m: f'{m.group(1)}"{alarm_color}"{m.group(2)}"{fop}"{m.group(3)}"{color}"{m.group(4)}"{sop}"',
                out,
            )
            # update its glow filter stdDeviation
            fpat = re.compile(
                rf'(<filter id="glow-{re.escape(pid)}"[^>]*><feGaussianBlur stdDeviation=)"[^"]*"',
            )
            out = fpat.sub(lambda m: f'{m.group(1)}"{blur}"', out)
        else:
            color, op = visible_attrs(t)
            pat = re.compile(
                rf'(<path id="{re.escape(pid)}"[^/]*?fill=)"[^"]*"(\s+opacity=)"[^"]*"',
            )
            out = pat.sub(lambda m: f'{m.group(1)}"{color}"{m.group(2)}"{op:.2f}"', out)
    return out

def render_png(svg_text, w, h):
    import tempfile, os
    # Strip explicit width/height so cairosvg honors -W/-H. Otherwise it uses
    # the SVG's intrinsic 2048x2048 and ignores us.
    svg_text = re.sub(r'\swidth="\d+"', '', svg_text, count=1)
    svg_text = re.sub(r'\sheight="\d+"', '', svg_text, count=1)
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
        return Image.open(out_path).convert("RGB")
    finally:
        for p in (in_path, out_path):
            try: os.unlink(p)
            except FileNotFoundError: pass

def main():
    svg_text = SVG_PATH.read_text(encoding="utf-8")
    rows = math.ceil(len(SCENARIOS) / COLS)

    canvas_w = PAD * 2 + CELL * COLS + GAP * (COLS - 1)
    canvas_h = PAD * 2 + HEADER + (CELL + HEADER + GAP) * rows
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
            "Celta · Phase B v3 · contornos refinados + translucidez para hidden",
            fill=(255, 204, 26), font=title_f)

    for idx, (label, params) in enumerate(SCENARIOS):
        col = idx % COLS; row = idx // COLS
        cx = PAD + col * (CELL + GAP)
        cy = PAD + HEADER + row * (CELL + HEADER + GAP)
        mutated = render_scenario(svg_text, params)
        img = render_png(mutated, CELL, CELL)
        canvas.paste(img, (cx, cy))
        cd.text((cx, cy + CELL + 4), label, fill=(255, 255, 255), font=label_f)
        print(f"[ok] {label}")

    canvas.save(OUT_PATH, "PNG", optimize=True)
    print(f"\nwrote {OUT_PATH} ({OUT_PATH.stat().st_size/1024:.0f} KB)")

if __name__ == "__main__":
    main()
