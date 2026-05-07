#!/usr/bin/env python3
"""
Phase C step 2 — render por-pixel paint usando as máscaras de
assets/masks/*.png.

Para cada cenário (cold/normal/hot/etc.), aplica HSL shift apenas
nos pixels da máscara de cada peça em alarme. Não cobre com polígono;
recolora a peça preservando a luminância (textura/brilho da foto).

Cenários gerados em assets/_previews/celta-phase-c-COMPARISON.png:
  1. Janela ideal — foto pura
  2. Tudo normal — amortecedores azuis (override do vermelho original)
  3. Pneu RR superaquecendo
  4. Mola traseira RL com problema (coil-RL vermelho)
  5. Shock-RR comprometido (shock-body vermelho, spring azul)
  6. Motor superaquecendo (tint sutil)
"""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "assets/celta_exploded.png"
MASK_DIR = ROOT / "assets/masks"
OUT = ROOT / "assets/_previews/celta-phase-c-COMPARISON.png"

CELL = 580
COLS = 3
GAP = 12
PAD = 18
HEADER = 40
LABEL_H = 28


# --- HSL recolor ---

def shift_part(bgr, mask, target_hue_deg, sat_boost=0.30, blend=0.85):
    """Recolor pixels of `bgr` where `mask` is active, keeping luminance.
    Uses HSV space (close enough for this purpose):
      - Hue is fully replaced with target hue, weighted by `blend` so we
        keep some original chrominance for naturalness.
      - Saturation is lifted toward 220 by `sat_boost`, so dark areas
        (e.g. tire rubber) actually pick up the color instead of looking
        muddy.
      - Value (luminance) is untouched — the photo texture survives.

    target_hue_deg: 0..360 (red=0, yellow=60, green=120, cyan=180, blue=240).
    OpenCV HSV uses 0..180 for hue, so we divide by 2.
    """
    if mask.max() == 0:
        return bgr
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    th = (target_hue_deg / 2.0) % 180.0
    soft = (mask.astype(np.float32) / 255.0)[..., None]
    soft_v = soft.squeeze()

    # Hue: blend toward target. Wraparound aware.
    h = hsv[..., 0]
    diff = ((th - h + 90) % 180) - 90       # signed shortest-path delta
    new_h = (h + diff * blend * soft_v) % 180
    # Saturation: push up
    new_s = hsv[..., 1] + (220 - hsv[..., 1]) * sat_boost * soft_v
    new_s = np.clip(new_s, 0, 255)
    # Value (luminance): preserve

    out = hsv.copy()
    out[..., 0] = new_h
    out[..., 1] = new_s
    out_bgr = cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_HSV2BGR)
    # Composite via mask alpha so unmasked pixels stay byte-identical.
    return (out_bgr.astype(np.float32) * soft
            + bgr.astype(np.float32) * (1 - soft)).astype(np.uint8)


# Per-part rules:
#   t in [0..1] is the telemetry value, 0.5 neutral, 1 hot.
#   each entry returns (target_hue_deg, sat_boost) given t,
#   or None if "no transform" (preserve original).

def rule_tire(t):
    """Tire: preserves original at neutral. Hot -> red.
       Cold -> blue (frio = pneu não aderindo)."""
    dev = abs(t - 0.5)
    if dev < 0.06:
        return None
    if t > 0.5:                # hot
        return (0,  0.45 * dev * 2)        # red
    return (210, 0.55 * dev * 2)            # frigid blue


def rule_shock(t):
    """Shock body: NORMAL = blue (override the red paint).
       Cold (telemetry t<0.35) = brighter cyan. Hot = red.
       Always recolors — there is no 'preserve original' regime, because
       the original red is what we are intentionally suppressing."""
    if t < 0.35:               # cold-side, going cyan
        return (190, 0.50)
    if t < 0.65:               # normal -> blue
        return (220, 0.55)
    # hot -> red (problem on the damper itself)
    return (0,   0.55)


def rule_coil(t):
    """Spring coil: only goes red on PROBLEM (per Flávio).
       Otherwise it tints blue like the rest of the coilover."""
    if t < 0.65:               # quiet
        return (220, 0.50)
    return (0,   0.55)         # alarming


def rule_engine(t):
    """Engine block: subtle tint based on water/oil temperature.
       At neutral, stays photo-original (no transform)."""
    dev = abs(t - 0.5)
    if dev < 0.10:
        return None
    if t > 0.5:
        return (15, 0.30 * dev * 2)         # warm orange
    return (200, 0.30 * dev * 2)            # cool blue


def rule_body(t):
    """Body paint: optional aesthetic recolor (e.g. low battery -> tint).
       Default neutral = preserve."""
    dev = abs(t - 0.5)
    if dev < 0.10:
        return None
    if t > 0.5:
        return (0, 0.20 * dev * 2)
    return (220, 0.25 * dev * 2)


# Inventário REAL — só objetos visíveis na foto. Hidden parts tratados
# em separado via translucidez ghost (Phase B v3 carryover).
PARTS = {
    "tire-RR":     (rule_tire,   "tire-RR.png"),
    "coilover-RR": (rule_shock,  "coilover-RR.png"),  # cilindro inteiro como uma peça só por enquanto
    "engine":      (rule_engine, "engine.png"),
    "body-paint":  (rule_body,   "body-paint.png"),
    "body-roof":   (rule_body,   "body-roof.png"),
}


def neutral_state():
    return {p: 0.5 for p in PARTS}


def merge(a, **upd):
    out = dict(a); out.update(upd); return out


SCENARIOS = [
    ("Janela ideal · foto pura (sem override)",
     {p: 0.5 for p in PARTS} | {"coilover-RR": None}),
    ("Setup normal · coilover RR azul",
     neutral_state()),
    ("Pneu RR superaquecendo",
     merge(neutral_state(), **{"tire-RR": 0.92})),
    ("Pneu RR muito frio (azul)",
     merge(neutral_state(), **{"tire-RR": 0.10})),
    ("Coilover RR alarmando (vermelho)",
     merge(neutral_state(), **{"coilover-RR": 0.92})),
    ("Motor superaquecendo",
     merge(neutral_state(), engine=0.92)),
]


def render_scenario(photo_bgr, masks, params):
    out = photo_bgr.copy()
    for pid, t in params.items():
        if t is None:                      # part disabled in this scenario
            continue
        rule, _ = PARTS[pid]
        target = rule(t)
        if target is None:
            continue
        hue, sat = target
        out = shift_part(out, masks[pid], hue, sat_boost=sat)
    return out


def main():
    photo = cv2.imread(str(PHOTO))
    if photo is None:
        raise SystemExit(f"can't read {PHOTO}")
    masks = {}
    for pid, (_, fname) in PARTS.items():
        m = cv2.imread(str(MASK_DIR / fname), cv2.IMREAD_GRAYSCALE)
        if m is None:
            raise SystemExit(f"missing mask {fname}; run scripts/generate_masks.py first")
        masks[pid] = m
    print(f"loaded {len(masks)} masks")

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
            "Celta · Phase C · paint per-pixel via mask + HSL shift",
            fill=(255, 204, 26), font=title_f)

    for idx, (label, params) in enumerate(SCENARIOS):
        col = idx % COLS; row = idx // COLS
        cx = PAD + col * (CELL + GAP)
        cy = PAD + HEADER + row * (CELL + LABEL_H + GAP)
        rendered = render_scenario(photo, masks, params)
        rgb = cv2.cvtColor(rendered, cv2.COLOR_BGR2RGB)
        cell = Image.fromarray(rgb).resize((CELL, CELL), Image.LANCZOS)
        canvas.paste(cell, (cx, cy))
        cd.text((cx, cy + CELL + 4), label, fill=(240, 240, 240), font=label_f)
        print(f"[ok] {label}")

    canvas.save(OUT, "PNG", optimize=True)
    print(f"\nwrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
