#!/usr/bin/env python3
"""
Renders assets/_previews/cockpit-D-SCENARIOS.png — grid de 4 cenarios do
demo Direction D, cada um com valores/cores diferentes aplicados ao SVG.

Útil pra revisão via GitHub blob URL (HTML não renderiza em blob view).
"""
from __future__ import annotations
import math
import re
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "_design-reference/celta-cockpit-D.html"
OUT = ROOT / "assets/_previews/cockpit-D-SCENARIOS.png"

CELL_W = 700
CELL_H = 495
COLS = 2
GAP = 14
PAD = 18
HEADER = 40
LABEL_H = 28


def cls_engine(c): return 'ok' if c < 100 else ('warn' if c < 110 else 'crit')
def cls_oil(c):    return 'ok' if c < 115 else ('warn' if c < 130 else 'crit')
def cls_press(b):  return 'ok' if b > 3.5 else ('warn' if b > 2.0 else 'crit')
def cls_gbox(c):   return 'ok' if c < 90 else ('warn' if c < 105 else 'crit')
def cls_psi(p):
    d = abs(p - 29.0)
    return 'ok' if d < 1.5 else ('warn' if d < 3.0 else 'crit')
def cls_temp(c):   return 'ok' if c < 95 else ('warn' if c < 110 else 'crit')

COLOR = {'ok': '#5DD18C', 'warn': '#FFCC1A', 'crit': '#FF5A1F'}


def worse(a, b):
    rank = ['ok', 'warn', 'crit']
    return rank[max(rank.index(a), rank.index(b))]


SCENARIOS = [
    ("Início de stint · tudo verde",
     dict(engine_temp=78, oil_temp=88, oil_press=4.5, gearbox_temp=72,
          tire_FL_psi=29.0, tire_FR_psi=29.0, tire_RL_psi=29.0, tire_RR_psi=29.0,
          tire_FL_temp=65, tire_FR_temp=65, tire_RL_temp=65, tire_RR_temp=65,
          tank=95)),
    ("Pneu RR atenção · meio-stint",
     dict(engine_temp=92, oil_temp=108, oil_press=4.2, gearbox_temp=78,
          tire_FL_psi=28.4, tire_FR_psi=28.5, tire_RL_psi=29.1, tire_RR_psi=29.0,
          tire_FL_temp=84, tire_FR_temp=86, tire_RL_temp=91, tire_RR_temp=98,
          tank=45)),
    ("Motor superaquecendo",
     dict(engine_temp=113, oil_temp=128, oil_press=3.4, gearbox_temp=96,
          tire_FL_psi=29.8, tire_FR_psi=29.8, tire_RL_psi=30.2, tire_RR_psi=30.0,
          tire_FL_temp=92, tire_FR_temp=95, tire_RL_temp=96, tire_RR_temp=102,
          tank=30)),
    ("Tanque baixo · final de stint",
     dict(engine_temp=95, oil_temp=110, oil_press=4.0, gearbox_temp=82,
          tire_FL_psi=29.4, tire_FR_psi=29.4, tire_RL_psi=29.6, tire_RR_psi=29.5,
          tire_FL_temp=88, tire_FR_temp=89, tire_RL_temp=92, tire_RR_temp=94,
          tank=8)),
]


def apply_scenario(svg, st):
    """Mutate the SVG (string) substituindo valores + colors per scenario."""
    out = svg
    # Numbers
    pairs = {
        'v-engine-temp':  str(st['engine_temp']),
        'v-oil-temp':     str(st['oil_temp']),
        'v-oil-press':    f"{st['oil_press']:.1f}",
        'v-gearbox-temp': str(st['gearbox_temp']),
        'v-tire-FL-psi':  f"{st['tire_FL_psi']:.1f}",
        'v-tire-FR-psi':  f"{st['tire_FR_psi']:.1f}",
        'v-tire-RL-psi':  f"{st['tire_RL_psi']:.1f}",
        'v-tire-RR-psi':  f"{st['tire_RR_psi']:.1f}",
        'v-tire-FL-temp': str(st['tire_FL_temp']),
        'v-tire-FR-temp': str(st['tire_FR_temp']),
        'v-tire-RL-temp': str(st['tire_RL_temp']),
        'v-tire-RR-temp': str(st['tire_RR_temp']),
        'v-tank-pct':     str(st['tank']),
    }
    for tid, txt in pairs.items():
        # Replace text inside an element with this id, regardless of tagname.
        # Most are <tspan id="..."> ... </tspan> or <text id="...">...
        out = re.sub(
            rf'(<(?:text|tspan)[^>]*\bid="{re.escape(tid)}"[^>]*>)[^<]*',
            lambda m: m.group(1) + txt,
            out,
        )

    # Tank bar width (200px = 100%)
    bar_w = st['tank'] / 100 * 200
    out = re.sub(
        r'(<rect[^>]*\bid="v-tank-bar"[^>]*\bwidth=")[\d.]+',
        lambda m: m.group(1) + f"{bar_w:.1f}",
        out,
    )

    # Colors per corner (worst of psi/temp)
    for c in ['FL', 'FR', 'RL', 'RR']:
        cls = worse(cls_psi(st[f'tire_{c}_psi']), cls_temp(st[f'tire_{c}_temp']))
        hex_ = COLOR[cls]
        # dot + halo
        for elt in [f'dot-tire-{c}', f'halo-tire-{c}', f'halo-tire-{c}-mid', f'halo-tire-{c}-outer']:
            out = re.sub(
                rf'(<circle[^>]*\bid="{elt}"[^>]*\bfill=")[^"]*',
                lambda m, h=hex_: m.group(1) + h, out,
            )
        # text labels (psi value + temp text)
        for tid in [f'v-tire-{c}-psi', f't-tire-{c}-temp']:
            out = re.sub(
                rf'(<(?:text|tspan)[^>]*\bid="{re.escape(tid)}"[^>]*\bfill=")[^"]*',
                lambda m, h=hex_: m.group(1) + h, out,
            )

    # Gearbox color
    gcls = cls_gbox(st['gearbox_temp'])
    ghex = COLOR[gcls]
    for elt in ['dot-gearbox', 'halo-gearbox']:
        out = re.sub(
            rf'(<circle[^>]*\bid="{elt}"[^>]*\bfill=")[^"]*',
            lambda m, h=ghex: m.group(1) + h, out,
        )

    return out


def render_svg(svg_text, w, h):
    import os
    # Strip explicit width/height so cairosvg respects -W/-H
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
    html = HTML.read_text(encoding="utf-8")
    m = re.search(r'<svg xmlns=.*</svg>', html, re.S)   # greedy on purpose
    if not m: raise SystemExit("svg not found in html")
    base_svg = m.group(0)

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
            "Celta · Cockpit Direction D · 4 cenários (preview do demo interativo)",
            fill=(255, 204, 26), font=title_f)

    for idx, (label, st) in enumerate(SCENARIOS):
        col = idx % COLS; row = idx // COLS
        cx = PAD + col * (CELL_W + GAP)
        cy = PAD + HEADER + row * (CELL_H + LABEL_H + GAP)
        applied = apply_scenario(base_svg, st)
        img = render_svg(applied, CELL_W, CELL_H)
        canvas.paste(img, (cx, cy))
        cd.text((cx, cy + CELL_H + 4), label, fill=(240, 240, 240), font=label_f)
        print(f"[ok] {label}")

    canvas.save(OUT, "PNG", optimize=True)
    print(f"\nwrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
