#!/usr/bin/env python3
"""
Phase E — composição em camadas.

A foto base fica intacta. Cada peça é uma camada PNG transparente extraída
via GrabCut (assets/layers/*.png). Para recolorir, aplica HSL shift na
PRÓPRIA camada e empilha sobre a foto. Como a fronteira da camada segue
a curva real do objeto (gradiente da imagem), não tem polígono reto
visível.

Cenários em assets/_previews/celta-phase-e-COMPARISON.png.
"""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "assets/celta_exploded.png"
LAYERS = ROOT / "assets/layers"
OUT = ROOT / "assets/_previews/celta-phase-e-COMPARISON.png"

CELL = 580
COLS = 3
GAP = 12
PAD = 18
HEADER = 40
LABEL_H = 28


# --- HSL shift on RGBA layer (preserves luminance, shifts hue+sat) ---

def shift_layer(rgba, target_hue_deg, sat_boost=0.4, hue_blend=0.85):
    """rgba: HxWx4 numpy. target_hue: 0..360. sat_boost: 0..1."""
    if rgba.shape[2] != 4:
        return rgba
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    if alpha.max() == 0:
        return rgba

    # Work only on opaque pixels (where alpha > 0) for speed; but we have
    # to do the conversion on the whole image for HSV consistency.
    bgr = rgb[..., ::-1]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    th = (target_hue_deg / 2.0) % 180.0

    # Soft alpha as float weight
    soft = (alpha.astype(np.float32) / 255.0)

    h = hsv[..., 0]
    diff = ((th - h + 90) % 180) - 90
    new_h = (h + diff * hue_blend * soft) % 180

    s = hsv[..., 1]
    new_s = s + (220 - s) * sat_boost * soft
    new_s = np.clip(new_s, 0, 255)

    out_hsv = hsv.copy()
    out_hsv[..., 0] = new_h
    out_hsv[..., 1] = new_s
    out_bgr = cv2.cvtColor(out_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    out_rgb = out_bgr[..., ::-1]

    out = rgba.copy()
    out[..., :3] = out_rgb
    return out


def alpha_composite(base_rgb, layer_rgba):
    """Composite layer_rgba onto base_rgb (HxWx3)."""
    a = (layer_rgba[..., 3:4].astype(np.float32) / 255.0)
    out = base_rgb.astype(np.float32) * (1 - a) + layer_rgba[..., :3].astype(np.float32) * a
    return np.clip(out, 0, 255).astype(np.uint8)


# --- per-part rules (return target hue + sat boost given t in 0..1) ---

def rule_tire(t):
    """Tire: preserve at neutral; hot -> red; cold -> blue."""
    dev = abs(t - 0.5)
    if dev < 0.06:
        return None
    return ((0 if t > 0.5 else 210), 0.50 * dev * 2)


def rule_shock(t):
    """Coilover: NORMAL = blue (overrides red original).
    Cold = cyan. Hot = red. Sempre transformava."""
    if t < 0.40: return (200, 0.55)        # cyan
    if t < 0.60: return (220, 0.60)        # blue
    return (0, 0.65)                       # red


def rule_engine(t):
    dev = abs(t - 0.5)
    if dev < 0.10:
        return None
    return ((15 if t > 0.5 else 200), 0.35 * dev * 2)


def rule_body(t):
    dev = abs(t - 0.5)
    if dev < 0.12:
        return None
    return ((0 if t > 0.5 else 220), 0.30 * dev * 2)


PARTS = {
    "tire-RR":     (rule_tire,   "tire-RR.png"),
    "coilover-RR": (rule_shock,  "coilover-RR.png"),
    "engine":      (rule_engine, "engine.png"),
    "body-paint":  (rule_body,   "body-paint.png"),
    "body-roof":   (rule_body,   "body-roof.png"),
}


def neutral():
    return {p: 0.5 for p in PARTS}


SCENARIOS = [
    ("Foto pura (sem override)",
     {p: None for p in PARTS}),
    ("Setup normal · coilover azul",
     neutral()),
    ("Pneu RR superaquecendo",
     {**neutral(), "tire-RR": 0.95}),
    ("Pneu RR muito frio",
     {**neutral(), "tire-RR": 0.05}),
    ("Coilover RR alarmando",
     {**neutral(), "coilover-RR": 0.95}),
    ("Motor superaquecendo",
     {**neutral(), "engine": 0.92}),
]


def render_scenario(base_rgb, layers, params):
    out = base_rgb.copy()
    for pid, t in params.items():
        if t is None:
            continue
        rule, _ = PARTS[pid]
        target = rule(t)
        if target is None:
            continue
        hue, sat = target
        shifted = shift_layer(layers[pid], hue, sat_boost=sat)
        out = alpha_composite(out, shifted)
    return out


def main():
    photo = cv2.imread(str(PHOTO), cv2.IMREAD_UNCHANGED)
    # base RGB (ignore photo alpha for compositing background -- we want
    # the original background where parts don't override)
    base_bgr = photo[..., :3] if photo.shape[2] == 4 else photo
    base_rgb = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2RGB)

    layers = {}
    for pid, (_, fname) in PARTS.items():
        arr = np.array(Image.open(LAYERS / fname).convert("RGBA"))
        layers[pid] = arr
        active = int((arr[..., 3] > 64).sum())
        print(f"  layer {pid:14s}  active={active}")

    rows = math.ceil(len(SCENARIOS) / COLS)
    canvas_w = PAD * 2 + CELL * COLS + GAP * (COLS - 1)
    canvas_h = PAD * 2 + HEADER + (CELL + LABEL_H + GAP) * rows
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
            "Celta · Phase E · camadas (GrabCut) + recolor por HSL shift",
            fill=(255, 204, 26), font=title_f)

    for idx, (label, params) in enumerate(SCENARIOS):
        col = idx % COLS; row = idx // COLS
        cx = PAD + col * (CELL + GAP)
        cy = PAD + HEADER + row * (CELL + LABEL_H + GAP)
        rendered = render_scenario(base_rgb, layers, params)
        cell = Image.fromarray(rendered).resize((CELL, CELL), Image.LANCZOS)
        canvas.paste(cell, (cx, cy))
        cd.text((cx, cy + CELL + 4), label, fill=(240, 240, 240), font=label_f)
        print(f"[ok] {label}")

    canvas.save(OUT, "PNG", optimize=True)
    print(f"\nwrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
