#!/usr/bin/env python3
"""
Extrai cada peça VISÍVEL da foto como camada PNG transparente, usando
GrabCut iterativo (fronteira segue a curva real do objeto, não polígono).

Saída: assets/layers/<part-id>.png — RGBA, mesmo tamanho da foto.
A camada tem o pixel original da peça onde ela existe e alpha=0 onde não.

Compor a cena = empilhar layers sobre a foto base. Recolorir uma peça =
HSL shift dentro da própria camada, sem tocar o resto da foto.
"""
from __future__ import annotations
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "assets/celta_exploded.png"
OUT = ROOT / "assets/layers"
OUT.mkdir(parents=True, exist_ok=True)

# (part_id, rect (x,y,w,h), grabcut_iters)
# rect = bounding box conhecido (do meu inventário visual auditado)
PARTS = [
    ("tire-RR",     (1490, 1240, 410, 320), 8),
    ("coilover-RR", (1490, 1140, 200, 220), 8),
    ("engine",      (430,  1280, 460, 420), 10),
    ("body-paint",  (260,  470,  820, 660), 6),
    ("body-roof",   (820,   90,  800, 1020), 6),
]


def grabcut_layer(bgr, rect, iters=8):
    """Roda GrabCut com init de retângulo, devolve máscara com 0=bg, 255=fg.
    A fronteira segue gradiente real da imagem — pixel-perfeita."""
    mask = np.zeros(bgr.shape[:2], np.uint8)
    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, rect, bg_model, fg_model, iters, cv2.GC_INIT_WITH_RECT)
    binary = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    return binary


def keep_largest(mask):
    """Removes specks, keeps biggest connected component."""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n <= 1:
        return mask
    sizes = stats[1:, cv2.CC_STAT_AREA]
    idx = 1 + int(np.argmax(sizes))
    out = np.zeros_like(mask)
    out[labels == idx] = 255
    return out


def feather(mask, radius=2):
    if mask.max() == 0:
        return mask
    return cv2.GaussianBlur(mask, (radius * 2 + 1, radius * 2 + 1), 0)


def make_layer(bgr, mask):
    """Compose RGBA: original RGB where mask>0, alpha = mask."""
    rgba = np.zeros((bgr.shape[0], bgr.shape[1], 4), np.uint8)
    rgba[..., :3] = bgr[..., ::-1]   # BGR -> RGB
    rgba[..., 3] = mask
    return rgba


def main():
    bgr = cv2.imread(str(PHOTO))
    if bgr is None:
        raise SystemExit(f"missing {PHOTO}")

    for old in OUT.glob("*.png"):
        old.unlink()

    for pid, rect, iters in PARTS:
        print(f"... {pid}  rect={rect}")
        mask = grabcut_layer(bgr, rect, iters=iters)
        mask = keep_largest(mask)
        mask = feather(mask, 2)
        layer = make_layer(bgr, mask)

        out = OUT / f"{pid}.png"
        # PIL handles RGBA save cleanly
        from PIL import Image
        Image.fromarray(layer, "RGBA").save(out, "PNG", optimize=True)
        active = int((mask > 64).sum())
        print(f"   wrote {out.relative_to(ROOT)}  ({active} px alpha>0)")


if __name__ == "__main__":
    main()
