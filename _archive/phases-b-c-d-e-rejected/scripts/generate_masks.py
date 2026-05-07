#!/usr/bin/env python3
"""
Phase C step 1 — gera uma máscara binária PNG por objeto VISÍVEL.

REGRA: só mascara o que realmente aparece na foto. Não inventa pneus
escondidos atrás do bumper, não confunde cinto Sparco com coilover.

Inventário (auditado contra crops da foto, 2026-05-07):

  VISÍVEL (com máscara)
    tire-RR       pneu traseiro-direito              (1490..1900, 1240..1550)
    coilover-RR   coilover real atrás do pneu        (1490..1670, 1140..1340)
    engine        bloco motor + intake + bowtie      (430..870,   1280..1700)
    body-paint    amarelo (frente + rocker)
    body-roof     verde (teto + laterais)

  HIDDEN (sem máscara — só visualização ghost se quisermos depois)
    tire-FL/FR/RL    cobertos por bumper / chassis
    coilover-RL      lado oposto, oculto
    front shocks     atrás do motor

  REJEITADOS (eram identificação errada)
    "spring-RL/RR"   eram cinto Sparco vermelho do banco, não coilover
    "tire-FL"        polígono pegava grade do bumper, não pneu

Estratégia de máscara: combinação de mask de cor + ROI + post-process.
Para o pneu traseiro: dark+lowsat dentro de ROI elíptica + dilate. Para
o coilover real: red mask dentro de ROI estreita + close. Para engine
e body: igual antes (já estavam corretos).
"""
from __future__ import annotations
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / "assets/celta_exploded.png"
OUT_DIR = ROOT / "assets/masks"
OUT_DIR.mkdir(parents=True, exist_ok=True)
W, H = 2048, 2048


# ---------------- color masks ----------------

def hsv(bgr):
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)


def yellow_mask(bgr):
    return cv2.inRange(hsv(bgr), (15, 110, 110), (38, 255, 255))


def green_mask(bgr):
    return cv2.inRange(hsv(bgr), (38, 60, 50), (85, 255, 230))


def red_mask(bgr):
    h = hsv(bgr)
    m1 = cv2.inRange(h, (0, 100, 70), (12, 255, 255))
    m2 = cv2.inRange(h, (165, 100, 70), (180, 255, 255))
    return cv2.bitwise_or(m1, m2)


def tire_rubber_mask(bgr):
    h = hsv(bgr)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    dark = cv2.inRange(gray, 0, 65)
    low_sat = cv2.inRange(h[:, :, 1], 0, 65)
    return cv2.bitwise_and(dark, low_sat)


def engine_mask(bgr):
    """Silver intake + dark valve cover, both low saturation."""
    h = hsv(bgr)
    bright = cv2.inRange(h[:, :, 2], 105, 255)
    low_sat = cv2.inRange(h[:, :, 1], 0, 70)
    silver = cv2.bitwise_and(bright, low_sat)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mid = cv2.inRange(gray, 35, 95)
    return cv2.bitwise_or(silver, cv2.bitwise_and(mid, low_sat))


# ---------------- helpers ----------------

def biggest_blob(mask):
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n <= 1:
        return mask
    sizes = stats[1:, cv2.CC_STAT_AREA]
    idx = 1 + int(np.argmax(sizes))
    out = np.zeros_like(mask)
    out[labels == idx] = 255
    return out


def fill_holes(mask):
    """Fill enclosed holes (donut -> solid disk)."""
    if mask.max() == 0:
        return mask
    inv = cv2.bitwise_not(mask)
    flood = inv.copy()
    ff = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 0)
    return cv2.bitwise_or(mask, flood)


def morph(mask, close=0, open_=0, dilate=0):
    if close > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
    if open_ > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_, open_))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
    if dilate > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate, dilate))
        mask = cv2.dilate(mask, k)
    return mask


def feather(mask, radius=1):
    if radius <= 0 or mask.max() == 0:
        return mask
    return cv2.GaussianBlur(mask, (radius * 2 + 1, radius * 2 + 1), 0)


def roi_only(mask, roi):
    x, y, w, h = roi
    out = np.zeros_like(mask)
    out[y:y + h, x:x + w] = mask[y:y + h, x:x + w]
    return out


def write(name, mask):
    out = OUT_DIR / f"{name}.png"
    cv2.imwrite(str(out), mask)
    n = int((mask > 64).sum())
    pct = n * 100 / (W * H)
    print(f"[ok] {name:14s} -> {out.relative_to(ROOT)}   {n:>7d} px  ({pct:.2f}% canvas)")


# ---------------- pipeline ----------------

def main():
    bgr = cv2.imread(str(PHOTO))
    if bgr is None:
        raise SystemExit(f"missing {PHOTO}")

    # Wipe stale masks (we may have removed parts since last run)
    for old in OUT_DIR.glob("*.png"):
        old.unlink()

    # tire-RR: rubber sidewall + tread, includes hub face. ROI is the
    # rear-right tire bbox confirmed by photo crop.
    tm = roi_only(tire_rubber_mask(bgr), (1490, 1240, 410, 320))
    tm = morph(tm, close=15, open_=5, dilate=8)
    tm = biggest_blob(tm)
    tm = fill_holes(tm)
    write("tire-RR", feather(tm, 2))

    # coilover-RR: the real visible rear-right coilover behind the tire.
    # Red mask within tight ROI; the seat harnesses (also red) are in
    # different x range so safe.
    cm = roi_only(red_mask(bgr), (1490, 1140, 200, 220))
    cm = morph(cm, close=15, open_=3, dilate=4)
    cm = biggest_blob(cm)
    write("coilover-RR", feather(cm, 1))

    # engine: silver intake + dark block, ROI matches photo crop.
    em = roi_only(engine_mask(bgr), (430, 1280, 460, 420))
    em = morph(em, close=11, open_=7, dilate=4)
    em = biggest_blob(em)
    em = fill_holes(em)
    write("engine", feather(em, 1))

    # body-paint: yellow blob (frente + rocker)
    bp = roi_only(yellow_mask(bgr), (260, 470, 820, 660))
    bp = morph(bp, close=11, open_=5)
    bp = biggest_blob(bp)
    bp = fill_holes(bp)
    write("body-paint", feather(bp, 1))

    # body-roof: green blob
    br = roi_only(green_mask(bgr), (820, 90, 800, 1020))
    br = morph(br, close=11, open_=5)
    br = biggest_blob(br)
    br = fill_holes(br)
    write("body-roof", feather(br, 1))

    print(f"\nmasks under {OUT_DIR.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
