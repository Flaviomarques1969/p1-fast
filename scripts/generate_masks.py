#!/usr/bin/env python3
"""
Phase C step 1 — gera uma máscara binária PNG por sub-peça visível.

A máscara é PNG grayscale do mesmo tamanho da foto (2048×2048):
  branco (255) = pixel pertence à peça
  preto  (0)   = pixel não pertence

Estratégia: aproveita os polígonos já refinados em
assets/celta_exploded_partmap.svg (Phase B v3.1, pixel-precisos) e
rasteriza cada um como máscara. Para coilovers (que precisam separar
"corpo do amortecedor" da "espiral da mola"), divide o polígono ao meio
na vertical: parte superior = coil (mola), inferior = shock (amortecedor).

Hidden parts (FR tire, RL tire, front shocks/coils, gearbox) NÃO recebem
máscara porque não há pixels visíveis pra repintar. O cockpit/glow pode
indicá-los por outros meios mais tarde.
"""
from __future__ import annotations
import re
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parent.parent
SVG_PATH = ROOT / "assets/celta_exploded_partmap.svg"
OUT_DIR = ROOT / "assets/masks"
OUT_DIR.mkdir(parents=True, exist_ok=True)

W, H = 2048, 2048


def parse_path_d(d):
    """SVG d="M x y L x y..." -> list of (x, y) ints."""
    norm = re.sub(r"([MLZmlz])", r" \1 ", d).replace(",", " ")
    tokens = norm.split()
    pts, i = [], 0
    while i < len(tokens):
        t = tokens[i]
        if t in ("M", "L", "m", "l"):
            try:
                x = float(tokens[i + 1]); y = float(tokens[i + 2])
                pts.append((int(round(x)), int(round(y))))
                i += 3
            except (ValueError, IndexError):
                i += 1
        elif t in ("Z", "z"):
            i += 1
        else:
            try:
                x = float(t); y = float(tokens[i + 1])
                pts.append((int(round(x)), int(round(y))))
                i += 2
            except (ValueError, IndexError):
                i += 1
    return pts


def get_polygon(svg_text, part_id):
    pat = re.compile(rf'<path[^>]*\bid="{re.escape(part_id)}"[^>]*\bd="([^"]+)"')
    m = pat.search(svg_text)
    if not m:
        raise SystemExit(f"polygon {part_id!r} not found in SVG")
    return parse_path_d(m.group(1))


def rasterize(pts, hull=False):
    """Filled binary mask 2048x2048 from a polygon. If hull=True, use the
    convex hull instead — useful for roughly-convex parts (tires) whose
    color-traced polygon misses lighter sidewall/edge pixels."""
    mask = np.zeros((H, W), dtype=np.uint8)
    if not pts:
        return mask
    arr = np.array(pts, dtype=np.int32)
    if hull:
        arr = cv2.convexHull(arr).reshape(-1, 2)
    cv2.fillPoly(mask, [arr], 255)
    return mask


def dilate(mask, radius):
    if radius <= 0 or mask.max() == 0:
        return mask
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    return cv2.dilate(mask, k)


def split_horizontal(mask, top_frac=0.55, overlap=0.05):
    """Splits the mask into a top region and bottom region using its bbox.
    Returns (top_mask, bot_mask). Top covers up to `top_frac` of bbox height,
    bottom starts at (top_frac - overlap). The 5% overlap blends the seam."""
    ys, xs = np.where(mask > 0)
    if len(ys) == 0:
        return mask.copy(), mask.copy()
    y0, y1 = int(ys.min()), int(ys.max())
    h = y1 - y0
    cut_top = y0 + int(h * top_frac)
    cut_bot = y0 + int(h * (top_frac - overlap))
    top = mask.copy(); top[cut_top:, :] = 0
    bot = mask.copy(); bot[:cut_bot, :] = 0
    return top, bot


def feather(mask, radius=1):
    """Tight 1-2px Gaussian feather to avoid stair-stepped edges."""
    if radius <= 0 or mask.max() == 0:
        return mask
    return cv2.GaussianBlur(mask, (radius * 2 + 1, radius * 2 + 1), 0)


def write(name, mask):
    out = OUT_DIR / f"{name}.png"
    cv2.imwrite(str(out), mask)
    n = int((mask > 64).sum())
    pct = n * 100 / (W * H)
    print(f"[ok] {name:14s} -> {out.relative_to(ROOT)}   {n:>7d} px  ({pct:.2f}% canvas)")


def main():
    svg = SVG_PATH.read_text(encoding="utf-8")

    # Tires are roughly convex; use convex hull + 8px dilate so the mask
    # covers rubber + edges, not just the dark-pixel trace.
    for pid in ("tire-FL", "tire-RR"):
        pts = get_polygon(svg, pid)
        write(pid, feather(dilate(rasterize(pts, hull=True), 8), 2))

    # Engine: small dilate to capture intake highlights without bleeding
    # onto the surrounding chassis frame.
    write("engine", feather(dilate(rasterize(get_polygon(svg, "engine")), 4), 2))

    # Body parts: keep tight; they're large and adjacent to each other,
    # any dilate would bleed across the green/yellow boundary.
    for pid in ("body-paint", "body-roof"):
        pts = get_polygon(svg, pid)
        write(pid, feather(rasterize(pts), 1))

    # Coilover RL/RR split into coil (upper) + shock body (lower).
    # Small dilate so the mask covers the full cylinder, not just the red
    # mask trace.
    for side, src in [("RL", "spring-RL"), ("RR", "spring-RR")]:
        pts = get_polygon(svg, src)
        full = dilate(rasterize(pts), 4)
        coil, shock = split_horizontal(full, top_frac=0.55, overlap=0.05)
        write(f"coil-{side}",  feather(coil, 1))
        write(f"shock-{side}", feather(shock, 1))

    print(f"\nmasks under {OUT_DIR.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
