#!/usr/bin/env python3
"""
Rebuilds assets/celta_exploded_partmap.svg with photo-precise contours per part.

Pipeline:
  1) load celta_exploded.png (RGBA, 2048x2048)
  2) for each VISIBLE part: build a color/intensity mask, restrict to ROI,
     keep largest connected component, smooth contour (Douglas-Peucker),
     emit SVG <path d="...">.
  3) for each HIDDEN part: emit a hand-tuned polygon at the inferred location,
     with ghost-outline + glow filter so the absent pixels are visualized as
     translucent silhouettes.
  4) write the SVG with photo embedded as base64 data URI (self-contained).

Hidden parts: tire-FR, tire-RL, spring-FL, spring-FR, gearbox.
Visible parts: tire-FL, tire-RR, spring-RL, spring-RR, engine, radiator,
               body-paint, body-paint-2, body-roof.
"""
import base64
import cv2
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG_PATH = ROOT / "assets/celta_exploded.png"
OUT_SVG = ROOT / "assets/celta_exploded_partmap.svg"

W, H = 2048, 2048

# ---------------- masks ----------------

def to_hsv(bgr):
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

def yellow_mask(bgr):
    hsv = to_hsv(bgr)
    return cv2.inRange(hsv, (15, 110, 110), (38, 255, 255))

def green_mask(bgr):
    hsv = to_hsv(bgr)
    return cv2.inRange(hsv, (38, 60, 50), (85, 255, 230))

def red_mask(bgr):
    hsv = to_hsv(bgr)
    # Wider hue + lower S/V than before so we catch the full coilover spring
    # (including the duller red on the shaded side and the connecting links).
    m1 = cv2.inRange(hsv, (0, 70, 55), (14, 255, 255))
    m2 = cv2.inRange(hsv, (160, 70, 55), (180, 255, 255))
    return cv2.bitwise_or(m1, m2)

def tire_mask(bgr):
    """Very dark, low-saturation pixels = tire rubber + tread."""
    hsv = to_hsv(bgr)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    dark = cv2.inRange(gray, 0, 55)
    low_sat = cv2.inRange(hsv[:, :, 1], 0, 60)
    return cv2.bitwise_and(dark, low_sat)

def silver_mask(bgr):
    """Bright low-saturation pixels = chrome/silver/aluminum."""
    hsv = to_hsv(bgr)
    bright = cv2.inRange(hsv[:, :, 2], 130, 255)
    low_sat = cv2.inRange(hsv[:, :, 1], 0, 60)
    return cv2.bitwise_and(bright, low_sat)

def engine_mask(bgr):
    """Engine block: silver intake + dark exhaust + lower frame, all in ROI.
    Combine silver + dark to capture the whole block."""
    hsv = to_hsv(bgr)
    bright = cv2.inRange(hsv[:, :, 2], 90, 255)
    low_sat = cv2.inRange(hsv[:, :, 1], 0, 80)
    silver = cv2.bitwise_and(bright, low_sat)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    dark = cv2.inRange(gray, 25, 90)
    return cv2.bitwise_or(silver, cv2.bitwise_and(dark, low_sat))

# ---------------- ROIs (x, y, w, h) ----------------

# (x, y, w, h, close_kernel, open_kernel) — bigger close = bridges gaps
# between spring coils so the whole coilover ends up as one blob.
ROIS = {
    "tire-FL":     (320, 1500, 410, 290, 9, 5),
    "tire-RR":     (1580, 1140, 290, 290, 9, 5),
    "spring-RL":   (1080, 950, 200, 320, 35, 3),
    "spring-RR":   (1245, 940, 195, 320, 35, 3),
    "engine":      (430, 1310, 430, 460, 11, 5),
    "body-paint":  (260, 470, 820, 660, 11, 5),
    "body-roof":   (820,  90, 800, 1020, 11, 5),
}

MASKS = {
    "tire-FL":     tire_mask,
    "tire-RR":     tire_mask,
    "spring-RL":   red_mask,
    "spring-RR":   red_mask,
    "engine":      engine_mask,
    "body-paint":  yellow_mask,
    "body-roof":   green_mask,
}

# Manual polygons for parts that are hard to mask reliably.
# radiator = front bumper / grille face on the chassis (chassis nose).
MANUAL_VISIBLE = {
    "radiator": "M395 1830 L920 1828 L948 1856 L948 1972 L920 1996 L395 1996 L368 1972 L368 1856 Z",
}

# ---------------- hidden parts: hand-tuned silhouettes ----------------
# These geometries are inferred from car layout, not from photo pixels —
# they exist so the visualization has a "ghost" presence to glow through
# during alarms.

def ellipse_path(cx, cy, rx, ry, steps=28, rot_deg=0):
    pts = []
    cos_r = np.cos(np.deg2rad(rot_deg))
    sin_r = np.sin(np.deg2rad(rot_deg))
    for i in range(steps):
        t = 2 * np.pi * i / steps
        x = rx * np.cos(t)
        y = ry * np.sin(t)
        xr = x * cos_r - y * sin_r + cx
        yr = x * sin_r + y * cos_r + cy
        pts.append((int(round(xr)), int(round(yr))))
    return pts_to_d(pts)

def rect_path(x, y, w, h):
    return f"M{x} {y} L{x+w} {y} L{x+w} {y+h} L{x} {y+h} Z"

def pts_to_d(pts):
    if not pts: return ""
    d = f"M{pts[0][0]} {pts[0][1]}"
    for x, y in pts[1:]:
        d += f" L{x} {y}"
    return d + " Z"

# Hidden geometries — positioned to feel right next to their visible counterparts.
HIDDEN_PATHS = {
    # tire-FR: ghost behind engine block, mirrored from tire-FL roughly upward
    "tire-FR":   ellipse_path(640, 1430, 110, 95, rot_deg=-8),
    # tire-RL: ghost on the far rear-left, just behind the rear coilovers
    "tire-RL":   ellipse_path(1320, 1500, 130, 95, rot_deg=4),
    # spring-FL/FR: front struts behind engine block, vertical
    "spring-FL": ellipse_path(715, 1395, 38, 110),
    "spring-FR": ellipse_path(795, 1380, 38, 110),
    # gearbox: transaxle integrated with engine on driver side, partly hidden
    "gearbox":   ellipse_path(820, 1530, 110, 80, rot_deg=-12),
}

# ---------------- pipeline ----------------

def biggest_contour(mask, roi, close_size=7, open_size=7):
    x, y, w, h = roi
    sub = np.zeros_like(mask)
    sub[y:y+h, x:x+w] = mask[y:y+h, x:x+w]
    if close_size > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_size, close_size))
        sub = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, k)
    if open_size > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_size, open_size))
        sub = cv2.morphologyEx(sub, cv2.MORPH_OPEN, k)
    contours, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None
    return max(contours, key=cv2.contourArea)

def smooth_path(contour, eps_factor=0.0018):
    eps = eps_factor * cv2.arcLength(contour, True)
    poly = cv2.approxPolyDP(contour, eps, True)
    pts = [(int(p[0][0]), int(p[0][1])) for p in poly]
    return pts_to_d(pts)

def main():
    bgr = cv2.imread(str(IMG_PATH))
    if bgr is None:
        raise SystemExit(f"could not read {IMG_PATH}")

    extracted = {}
    for pid, mfn in MASKS.items():
        mask = mfn(bgr)
        roi = ROIS[pid]
        x, y, w, h, kc, ko = roi
        c = biggest_contour(mask, (x, y, w, h), close_size=kc, open_size=ko)
        if c is None:
            print(f"[warn] no contour for {pid}")
            extracted[pid] = ""
            continue
        d = smooth_path(c, eps_factor=0.0012 if pid.startswith("body") else 0.0020)
        extracted[pid] = d
        print(f"[ok]   {pid:14s} pts={len(d.split(' L'))}")
    for pid, d in MANUAL_VISIBLE.items():
        extracted[pid] = d
        print(f"[man]  {pid:14s} pts={len(d.split(' L'))}")

    # Tier-1 ordering (visible first, body on top so colored body pieces
    # composite over chassis):
    visible_order = [
        "tire-FL", "tire-RR",
        "spring-RL", "spring-RR",
        "radiator", "engine",
        "body-paint", "body-roof",
    ]
    hidden_order = ["tire-FR", "tire-RL", "spring-FL", "spring-FR", "gearbox"]

    # Embed image as base64
    img_b64 = base64.b64encode(IMG_PATH.read_bytes()).decode("ascii")

    parts = []
    parts.append('<?xml version="1.0" encoding="UTF-8"?>')
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
    parts.append(f'  <image href="data:image/png;base64,{img_b64}" x="0" y="0" width="{W}" height="{H}"/>')

    # defs: per-hidden-part glow filters (stdDeviation set by JS at runtime)
    parts.append("  <defs>")
    for hid in hidden_order:
        parts.append(
            f'    <filter id="glow-{hid}" x="-60%" y="-60%" width="220%" height="220%">'
            f'<feGaussianBlur stdDeviation="0" result="b"/>'
            f'<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>'
            f'</filter>'
        )
    parts.append("  </defs>")

    # visible parts: multiply blend
    parts.append('  <g class="visible-parts" style="mix-blend-mode: multiply;">')
    for pid in visible_order:
        d = extracted.get(pid, "")
        if not d: continue
        parts.append(
            f'    <path id="{pid}" data-part="{pid}" d="{d}" '
            f'fill="#000000" opacity="0"/>'
        )
    parts.append("  </g>")

    # hidden parts: screen blend, dashed ghost stroke, glow filter for alarms
    parts.append('  <g class="hidden-parts" style="mix-blend-mode: screen;">')
    for pid in hidden_order:
        d = HIDDEN_PATHS[pid]
        parts.append(
            f'    <path id="{pid}" data-part="{pid}" data-hidden="true" '
            f'd="{d}" fill="#000000" fill-opacity="0" '
            f'stroke="#FFFFFF" stroke-opacity="0.30" stroke-width="3" '
            f'stroke-dasharray="14 9" stroke-linejoin="round" '
            f'filter="url(#glow-{pid})"/>'
        )
    parts.append("  </g>")

    parts.append("</svg>")

    OUT_SVG.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(f"\nwrote {OUT_SVG} ({OUT_SVG.stat().st_size/1024/1024:.2f} MB)")

if __name__ == "__main__":
    main()
