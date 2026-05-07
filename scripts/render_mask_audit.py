#!/usr/bin/env python3
"""
Renders assets/_previews/MASK-AUDIT.png — grid mostrando cada máscara
overlay sobre a foto (vermelho semi-transparente onde a máscara está
ativa) pra verificar se a máscara cobre realmente a peça.
"""
import math
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "assets/celta_exploded.png"
MASK_DIR = ROOT / "assets/masks"
OUT = ROOT / "assets/_previews/MASK-AUDIT.png"

CELL = 420
COLS = 3
GAP = 10
PAD = 16
HEADER = 44
LABEL_H = 32

OVERLAY_COLOR = (0, 28, 255)  # BGR red
OVERLAY_ALPHA = 0.55


def main():
    photo = cv2.imread(str(PHOTO))
    masks = sorted(MASK_DIR.glob("*.png"))
    rows = math.ceil(len(masks) / COLS)
    canvas_w = PAD * 2 + CELL * COLS + GAP * (COLS - 1)
    canvas_h = PAD * 2 + HEADER + (CELL + LABEL_H + GAP) * rows
    canvas = np.full((canvas_h, canvas_w, 3), 18, dtype=np.uint8)
    cv2.putText(canvas, "MASK AUDIT - Phase C  (red = mask active)",
                (PAD, PAD + 26), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (26, 204, 255), 2)

    for i, mp in enumerate(masks):
        col = i % COLS; row = i // COLS
        cx = PAD + col * (CELL + GAP)
        cy = PAD + HEADER + row * (CELL + LABEL_H + GAP)

        m = cv2.imread(str(mp), cv2.IMREAD_GRAYSCALE)
        overlay = photo.copy()
        red = np.zeros_like(photo); red[:, :] = OVERLAY_COLOR
        a = (m.astype(np.float32) / 255.0)[..., None]
        overlay = (photo.astype(np.float32) * (1 - a * OVERLAY_ALPHA)
                   + red.astype(np.float32) * (a * OVERLAY_ALPHA)).astype(np.uint8)
        cell = cv2.resize(overlay, (CELL, CELL), interpolation=cv2.INTER_AREA)
        canvas[cy:cy + CELL, cx:cx + CELL] = cell
        cv2.putText(canvas, mp.stem,
                    (cx, cy + CELL + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (240, 240, 240), 1, cv2.LINE_AA)

    cv2.imwrite(str(OUT), canvas)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.0f} KB, {len(masks)} masks)")


if __name__ == "__main__":
    main()
