#!/usr/bin/env python3
"""
Phase F (resgate Direction D) — gera o HTML demo interativo da tile CARRO
do direction-D-live.svg, com sliders bindando dados ao vivo.

Pipeline:
  1) extrai a tile CARRO (g translate(1100, 132) ... </g>) do SVG mestre
  2) remove o transform externo, ajusta viewBox pra 780x552
  3) injeta IDs nos elementos de valor (T.MOTOR=92, PNEU FL psi/temp, ...)
  4) escreve HTML com SVG inline + painel de sliders + JS de bind
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/command-box/premium-styles/direction-D-live.svg"
OUT = ROOT / "_design-reference/celta-cockpit-D.html"


def extract_tile():
    src = SRC.read_text(encoding="utf-8")
    start_marker = "TILE: CARRO HERO"
    end_marker = "TILE: MAPA PILOTO"
    a = src.index(start_marker)
    b = src.index(end_marker)
    block = src[a:b]
    # Find the outer group opener and walk forward counting only XML group tags
    g_open = block.index('<g transform="translate(1100, 132)">')
    block = block[g_open:]
    # The outer </g> we want is the LAST `</g>` in the block (since after it,
    # the next comment immediately follows and our slice ended at "TILE: MAPA").
    last_close = block.rindex("</g>")
    return block[: last_close + 4]   # include the </g>


def parametrize(g_block):
    """Inject `data-bind` ids into value text/tspans + dot circles + leaders.
    The original mockup has hardcoded numbers; we wrap them so JS can swap."""
    out = g_block

    # Engine cluster (top): "92<tspan>°C</tspan>", "108", "4.2<tspan>bar</tspan>"
    out = out.replace(
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0">92<tspan font-size="10" fill="#6E7681" dx="2">°C</tspan>',
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0"><tspan id="v-engine-temp">92</tspan><tspan font-size="10" fill="#6E7681" dx="2">°C</tspan>',
        1,
    )
    out = out.replace(
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0">108<tspan font-size="10" fill="#6E7681" dx="2">°C</tspan>',
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0"><tspan id="v-oil-temp">108</tspan><tspan font-size="10" fill="#6E7681" dx="2">°C</tspan>',
        1,
    )
    out = out.replace(
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0">4.2<tspan font-size="10" fill="#6E7681" dx="2">bar</tspan>',
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0"><tspan id="v-oil-press">4.2</tspan><tspan font-size="10" fill="#6E7681" dx="2">bar</tspan>',
        1,
    )
    # Gearbox label (78°C, only one occurrence on the right of car)
    out = out.replace(
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0">78<tspan font-size="10" fill="#6E7681" dx="2">°C</tspan>',
        '<text y="18" font-size="16" font-weight="500" fill="#E8EBF0"><tspan id="v-gearbox-temp">78</tspan><tspan font-size="10" fill="#6E7681" dx="2">°C</tspan>',
        1,
    )

    # Tires — patch by sequence (FL, FR, RL, RR). Each block has psi line then °C line.
    tire_patches = [
        # FL psi
        ('<text y="20" font-size="22" font-weight="500" fill="#E8EBF0">28.4</text>',
         '<text y="20" font-size="22" font-weight="500" fill="#E8EBF0" id="v-tire-FL-psi">28.4</text>'),
        ('<text y="38" font-size="13" fill="#E8EBF0">84<tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>',
         '<text y="38" font-size="13" fill="#E8EBF0" id="t-tire-FL-temp"><tspan id="v-tire-FL-temp">84</tspan><tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>'),
        # FR
        ('<text y="20" font-size="22" font-weight="500" fill="#E8EBF0">28.5</text>',
         '<text y="20" font-size="22" font-weight="500" fill="#E8EBF0" id="v-tire-FR-psi">28.5</text>'),
        ('<text y="38" font-size="13" fill="#E8EBF0">86<tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>',
         '<text y="38" font-size="13" fill="#E8EBF0" id="t-tire-FR-temp"><tspan id="v-tire-FR-temp">86</tspan><tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>'),
        # RL
        ('<text y="20" font-size="22" font-weight="500" fill="#E8EBF0">29.1</text>',
         '<text y="20" font-size="22" font-weight="500" fill="#E8EBF0" id="v-tire-RL-psi">29.1</text>'),
        ('<text y="38" font-size="13" fill="#E8EBF0">91<tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>',
         '<text y="38" font-size="13" fill="#E8EBF0" id="t-tire-RL-temp"><tspan id="v-tire-RL-temp">91</tspan><tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>'),
        # RR (the alarm one — already amber/yellow)
        ('<text y="20" font-size="22" font-weight="500" fill="#FFCC1A">29.0</text>',
         '<text y="20" font-size="22" font-weight="500" fill="#FFCC1A" id="v-tire-RR-psi">29.0</text>'),
        ('<text y="38" font-size="13" fill="#FFCC1A">98<tspan font-size="9" fill="#6E7681" dx="2">°C</tspan> <tspan font-size="11">+6</tspan></text>',
         '<text y="38" font-size="13" fill="#FFCC1A" id="t-tire-RR-temp"><tspan id="v-tire-RR-temp">98</tspan><tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>'),
    ]
    for old, new in tire_patches:
        out = out.replace(old, new, 1)

    # Tank %
    out = out.replace(
        '<text x="270" y="0" font-size="16" font-weight="500" fill="#E8EBF0">45<tspan font-size="10" fill="#6E7681">%</tspan></text>',
        '<text x="270" y="0" font-size="16" font-weight="500" fill="#E8EBF0"><tspan id="v-tank-pct">45</tspan><tspan font-size="10" fill="#6E7681">%</tspan></text>',
        1,
    )
    # Tank bar — fill width is hardcoded "90" out of 200. We'll bind via JS.
    out = out.replace(
        '<rect x="60" y="-12" width="90" height="14" fill="#FFCC1A" fill-opacity="0.85"/>',
        '<rect x="60" y="-12" width="90" height="14" fill="#FFCC1A" fill-opacity="0.85" id="v-tank-bar"/>',
        1,
    )
    # Δ team best
    out = out.replace(
        '<text y="0" font-size="22" font-weight="600" fill="#FF5A1F">+0.42',
        '<text y="0" font-size="22" font-weight="600" fill="#FF5A1F" id="t-delta">+0.42',
        1,
    )

    # Tag the alarm dot (RR pulsante) — outer pulsing circle keeps animate
    # Also tag the static dots so we can recolor them on alarm
    # WHEEL FL/FR/RL/RR dots: "<circle cx=X cy=Y r=4 fill=#5DD18C/>"
    # We add ids by find-replace each unique cx/cy combo.
    dot_ids = [
        ((333, 194, 4), "dot-tire-FL"),
        ((333, 194, 8), "halo-tire-FL"),
        ((447, 194, 4), "dot-tire-FR"),
        ((447, 194, 8), "halo-tire-FR"),
        ((329, 365, 4), "dot-tire-RL"),
        ((329, 365, 8), "halo-tire-RL"),
        ((451, 365, 4), "dot-tire-RR"),
        ((451, 365, 7), "halo-tire-RR-mid"),
        ((451, 365, 11), "halo-tire-RR-outer"),
        ((390, 251, 3.5), "dot-gearbox"),
        ((390, 251, 6),   "halo-gearbox"),
    ]
    for (cx, cy, r), pid in dot_ids:
        # match either int or float; original may be "4" or "3.5"
        rstr = str(r) if isinstance(r, float) and r != int(r) else str(int(r))
        pat = re.compile(
            rf'<circle cx="{cx}" cy="{cy}" r="{rstr}"\s+fill="(#[0-9A-Fa-f]+)"',
        )
        out, n = pat.subn(
            lambda m, pid=pid: m.group(0).replace("<circle ", f'<circle id="{pid}" ', 1),
            out, count=1,
        )

    # Drop the outer <g transform="translate(1100, 132)">
    out = out.replace('<g transform="translate(1100, 132)">', '<g>', 1)
    return out


SVG_DEFS = """  <defs>
    <linearGradient id="tile" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#171C25" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#10141B" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#12161D"/>
      <stop offset="100%" stop-color="#0A0D12"/>
    </linearGradient>
  </defs>
"""


HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Celta · Cockpit Direction D · LIVE</title>
<style>
  :root {{
    --bg: #0F1216; --tile: #171C25; --border: #1F252E;
    --text: #E8EBF0; --text-dim: #6E7681; --accent: #FFCC1A;
    --ok: #5DD18C; --warn: #FFCC1A; --crit: #FF5A1F;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: var(--bg); color: var(--text);
    font-family: Inter, -apple-system, system-ui, sans-serif;
    min-height: 100vh; padding: 24px;
    display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; }}
  .header {{ grid-column: 1 / -1; display: flex;
    justify-content: space-between; align-items: baseline;
    padding-bottom: 14px; border-bottom: 1px solid var(--border); }}
  .header h1 {{ font-size: 17px; font-weight: 500; }}
  .header h1 span {{ color: var(--accent); }}
  .header .meta {{ color: var(--text-dim); font-size: 11px;
    letter-spacing: 1.5px; text-transform: uppercase; }}

  .stage {{ background: linear-gradient(160deg,#12161D 0%,#0A0D12 100%);
    border: 1px solid var(--border); border-radius: 4px;
    padding: 18px; display: flex; align-items: center;
    justify-content: center; min-height: 600px;
    position: sticky; top: 24px; max-height: calc(100vh - 48px); }}
  .stage svg {{ max-width: 100%; max-height: 760px; }}
  .stage svg [data-binds-color] {{ transition: fill 280ms ease, stroke 280ms ease; }}

  .controls {{ display: flex; flex-direction: column; gap: 12px; }}
  .group {{ background: var(--tile); border: 1px solid var(--border);
    border-radius: 4px; padding: 12px 14px; }}
  .group h2 {{ font-size: 10px; font-weight: 700; letter-spacing: 2px;
    color: var(--accent); text-transform: uppercase; margin-bottom: 8px; }}
  .row {{ display: grid; grid-template-columns: 90px 1fr 60px;
    align-items: center; gap: 10px; margin: 8px 0; font-size: 11px; }}
  .row .lbl {{ color: var(--text); font-weight: 500; }}
  .row .val {{ font-family: 'JetBrains Mono', monospace;
    text-align: right; font-weight: 600; font-size: 11px; }}
  .row input[type=range] {{ width: 100%; -webkit-appearance: none;
    appearance: none; height: 4px; border-radius: 2px;
    background: linear-gradient(to right, #1B5BFF 0%, #5DD18C 35%, #FFCC1A 65%, #FF5A1F 100%); }}
  .row input[type=range]::-webkit-slider-thumb {{ -webkit-appearance: none;
    width: 13px; height: 13px; border-radius: 50%; background: #fff;
    cursor: pointer; border: 2px solid #0F1216; }}
  .presets button {{ background: transparent; color: var(--text);
    border: 1px solid var(--border); padding: 6px 10px;
    font-family: inherit; font-size: 11px; cursor: pointer;
    width: 100%; margin-bottom: 4px; text-align: left; transition: all 0.15s; }}
  .presets button:hover {{ border-color: var(--accent); color: var(--accent); }}
</style>
</head>
<body>
<div class="header">
  <h1>Celta · <span>Cockpit · Direction D · LIVE</span></h1>
  <div class="meta">P1 FAST · TELEMETRIA SOBREPOSTA · TOP-DOWN</div>
</div>

<div class="stage">
{SVG_INLINE}
</div>

<div class="controls">
  <div class="group">
    <h2>Powertrain</h2>
    <div class="row"><span class="lbl">T.MOTOR</span>
      <input type="range" id="s-engine-temp" min="60" max="120" value="92"><span class="val" id="d-engine-temp">--</span></div>
    <div class="row"><span class="lbl">T.ÓLEO</span>
      <input type="range" id="s-oil-temp" min="60" max="150" value="108"><span class="val" id="d-oil-temp">--</span></div>
    <div class="row"><span class="lbl">P.ÓLEO</span>
      <input type="range" id="s-oil-press" min="0" max="10" step="0.1" value="4.2"><span class="val" id="d-oil-press">--</span></div>
    <div class="row"><span class="lbl">T.CÂMBIO</span>
      <input type="range" id="s-gearbox-temp" min="40" max="120" value="78"><span class="val" id="d-gearbox-temp">--</span></div>
  </div>

  <div class="group">
    <h2>Pneus · pressão (psi)</h2>
    <div class="row"><span class="lbl">FL</span>
      <input type="range" id="s-tire-FL-psi" min="20" max="40" step="0.1" value="28.4"><span class="val" id="d-tire-FL-psi">--</span></div>
    <div class="row"><span class="lbl">FR</span>
      <input type="range" id="s-tire-FR-psi" min="20" max="40" step="0.1" value="28.5"><span class="val" id="d-tire-FR-psi">--</span></div>
    <div class="row"><span class="lbl">RL</span>
      <input type="range" id="s-tire-RL-psi" min="20" max="40" step="0.1" value="29.1"><span class="val" id="d-tire-RL-psi">--</span></div>
    <div class="row"><span class="lbl">RR</span>
      <input type="range" id="s-tire-RR-psi" min="20" max="40" step="0.1" value="29.0"><span class="val" id="d-tire-RR-psi">--</span></div>
  </div>

  <div class="group">
    <h2>Pneus · temperatura (°C)</h2>
    <div class="row"><span class="lbl">FL</span>
      <input type="range" id="s-tire-FL-temp" min="50" max="130" value="84"><span class="val" id="d-tire-FL-temp">--</span></div>
    <div class="row"><span class="lbl">FR</span>
      <input type="range" id="s-tire-FR-temp" min="50" max="130" value="86"><span class="val" id="d-tire-FR-temp">--</span></div>
    <div class="row"><span class="lbl">RL</span>
      <input type="range" id="s-tire-RL-temp" min="50" max="130" value="91"><span class="val" id="d-tire-RL-temp">--</span></div>
    <div class="row"><span class="lbl">RR</span>
      <input type="range" id="s-tire-RR-temp" min="50" max="130" value="98"><span class="val" id="d-tire-RR-temp">--</span></div>
  </div>

  <div class="group">
    <h2>Combustível</h2>
    <div class="row"><span class="lbl">TANQUE</span>
      <input type="range" id="s-tank" min="0" max="100" value="45"><span class="val" id="d-tank">--</span></div>
  </div>

  <div class="group presets">
    <h2>Cenários rápidos</h2>
    <button onclick="preset('start')">Início de stint · tudo verde</button>
    <button onclick="preset('rr-warn')">Pneu RR atenção (preset original)</button>
    <button onclick="preset('engine-hot')">Motor superaquecendo</button>
    <button onclick="preset('low-fuel')">Tanque baixando</button>
    <button onclick="preset('all-clear')">Tudo dentro da janela ideal</button>
  </div>
</div>

<script>
// Threshold-based color rule per channel: returns 'ok' / 'warn' / 'crit'.
function classifyEngineTemp(c) {{ return c < 100 ? 'ok' : c < 110 ? 'warn' : 'crit'; }}
function classifyOilTemp(c)    {{ return c < 115 ? 'ok' : c < 130 ? 'warn' : 'crit'; }}
function classifyOilPress(b)   {{ return b > 3.5 ? 'ok' : b > 2.0 ? 'warn' : 'crit'; }}
function classifyGearbox(c)    {{ return c < 90  ? 'ok' : c < 105 ? 'warn' : 'crit'; }}
function classifyTirePsi(p)    {{
  const dev = Math.abs(p - 29.0);
  return dev < 1.5 ? 'ok' : dev < 3.0 ? 'warn' : 'crit';
}}
function classifyTireTemp(c)   {{ return c < 95 ? 'ok' : c < 110 ? 'warn' : 'crit'; }}

const COLOR = {{
  ok:   '#5DD18C',
  warn: '#FFCC1A',
  crit: '#FF5A1F',
  dim:  '#6E7681',
}};

function setText(id, v) {{
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}}

function setColor(id, hex) {{
  const el = document.getElementById(id);
  if (!el) return;
  // Update both fill and stroke if present
  el.setAttribute('fill', hex);
  if (el.tagName.toLowerCase() === 'line' || el.hasAttribute('stroke')) {{
    el.setAttribute('stroke', hex);
  }}
}}

function colorTireGroup(corner, hex) {{
  // Recolora dot + halo + label do canto
  setColor('dot-tire-' + corner, hex);
  setColor('halo-tire-' + corner, hex);
  const t = document.getElementById('t-tire-' + corner + '-temp');
  if (t) t.setAttribute('fill', hex);
  const psi = document.getElementById('v-tire-' + corner + '-psi');
  if (psi) psi.setAttribute('fill', hex);
}}

function tickEngine() {{
  const t = +document.getElementById('s-engine-temp').value;
  const o = +document.getElementById('s-oil-temp').value;
  const p = parseFloat(document.getElementById('s-oil-press').value);
  const g = +document.getElementById('s-gearbox-temp').value;
  setText('v-engine-temp', t);   setText('d-engine-temp', t + '°C');
  setText('v-oil-temp',    o);   setText('d-oil-temp',    o + '°C');
  setText('v-oil-press',   p.toFixed(1)); setText('d-oil-press', p.toFixed(1) + ' bar');
  setText('v-gearbox-temp', g);  setText('d-gearbox-temp', g + '°C');
  // Câmbio dot/halo cor segue T.CÂMBIO
  const gColor = COLOR[classifyGearbox(g)];
  setColor('dot-gearbox', gColor);
  setColor('halo-gearbox', gColor);
}}

function tickTires() {{
  ['FL','FR','RL','RR'].forEach(corner => {{
    const psi  = parseFloat(document.getElementById('s-tire-' + corner + '-psi').value);
    const temp = +document.getElementById('s-tire-' + corner + '-temp').value;
    setText('v-tire-' + corner + '-psi', psi.toFixed(1));
    setText('d-tire-' + corner + '-psi', psi.toFixed(1) + ' psi');
    setText('v-tire-' + corner + '-temp', temp);
    setText('d-tire-' + corner + '-temp', temp + '°C');
    // Color = pior dos dois
    const cls = ['ok','warn','crit'];
    const idx = Math.max(cls.indexOf(classifyTirePsi(psi)),
                          cls.indexOf(classifyTireTemp(temp)));
    colorTireGroup(corner, COLOR[cls[idx]]);
  }});
}}

function tickTank() {{
  const v = +document.getElementById('s-tank').value;
  setText('v-tank-pct', v);
  setText('d-tank', v + '%');
  const bar = document.getElementById('v-tank-bar');
  if (bar) bar.setAttribute('width', (v / 100 * 200).toFixed(1));
}}

function tickAll() {{ tickEngine(); tickTires(); tickTank(); }}

// Wire up sliders
document.querySelectorAll('input[type=range]').forEach(sl => {{
  sl.addEventListener('input', tickAll);
}});
tickAll();

// Presets
function setSlider(id, v) {{
  const sl = document.getElementById(id); if (!sl) return;
  sl.value = v;
}}
function preset(name) {{
  const presets = {{
    'start': {{
      'engine-temp': 78, 'oil-temp': 88, 'oil-press': 4.5, 'gearbox-temp': 72,
      'tire-FL-psi': 29.0, 'tire-FR-psi': 29.0, 'tire-RL-psi': 29.0, 'tire-RR-psi': 29.0,
      'tire-FL-temp': 65, 'tire-FR-temp': 65, 'tire-RL-temp': 65, 'tire-RR-temp': 65,
      'tank': 95,
    }},
    'rr-warn': {{
      'engine-temp': 92, 'oil-temp': 108, 'oil-press': 4.2, 'gearbox-temp': 78,
      'tire-FL-psi': 28.4, 'tire-FR-psi': 28.5, 'tire-RL-psi': 29.1, 'tire-RR-psi': 29.0,
      'tire-FL-temp': 84, 'tire-FR-temp': 86, 'tire-RL-temp': 91, 'tire-RR-temp': 98,
      'tank': 45,
    }},
    'engine-hot': {{
      'engine-temp': 113, 'oil-temp': 128, 'oil-press': 3.4, 'gearbox-temp': 96,
      'tire-FL-psi': 29.8, 'tire-FR-psi': 29.8, 'tire-RL-psi': 30.2, 'tire-RR-psi': 30.0,
      'tire-FL-temp': 92, 'tire-FR-temp': 95, 'tire-RL-temp': 96, 'tire-RR-temp': 102,
      'tank': 30,
    }},
    'low-fuel': {{
      'engine-temp': 95, 'oil-temp': 110, 'oil-press': 4.0, 'gearbox-temp': 82,
      'tire-FL-psi': 29.4, 'tire-FR-psi': 29.4, 'tire-RL-psi': 29.6, 'tire-RR-psi': 29.5,
      'tire-FL-temp': 88, 'tire-FR-temp': 89, 'tire-RL-temp': 92, 'tire-RR-temp': 94,
      'tank': 8,
    }},
    'all-clear': {{
      'engine-temp': 88, 'oil-temp': 100, 'oil-press': 4.5, 'gearbox-temp': 80,
      'tire-FL-psi': 29.0, 'tire-FR-psi': 29.0, 'tire-RL-psi': 29.0, 'tire-RR-psi': 29.0,
      'tire-FL-temp': 80, 'tire-FR-temp': 80, 'tire-RL-temp': 82, 'tire-RR-temp': 82,
      'tank': 70,
    }},
  }};
  const p = presets[name]; if (!p) return;
  Object.entries(p).forEach(([k, v]) => setSlider('s-' + k, v));
  tickAll();
}}
</script>
</body>
</html>
"""


def main():
    block = extract_tile()
    block = parametrize(block)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 552" '
        f'preserveAspectRatio="xMidYMid meet">\n'
        f'{SVG_DEFS}'
        f'{block}\n'
        f'</svg>'
    )

    # The HTML template has {{}} as format() escapes. Now that we use plain
    # replace, undo them. Then substitute SVG.
    out = HTML.replace("{{", "{").replace("}}", "}").replace("{SVG_INLINE}", svg)
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
