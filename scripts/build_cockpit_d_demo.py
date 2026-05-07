#!/usr/bin/env python3
"""Cockpit Direction D — premium tile (rebuild from scratch).

Disciplina de design:
  - grid 8px: todas posições e tamanhos múltiplos de 8 ou 4
  - tipografia hierárquica: eyebrow 7pt 700 / label 8pt 700 / value 16pt 500 / unit 8pt 400
  - leaders ortogonais (sem diagonais que cruzam)
  - hairlines 1px opacity 0.5 pra separadores
  - dots com halo radial sutil (não solid circle)
  - paleta: charcoal warm + race yellow + status (green/amber/red)
  - carro com proporção real (ratio 0.6 width/height)
"""
from pathlib import Path

ROOT = Path("/home/user/p1-fast")
SRC_SVG = ROOT / "assets/command-box/premium-styles/direction-D-live.svg"
CELTA_PATHS = Path("/tmp/celta_vector_paths.txt")
OUT = ROOT / "_design-reference/celta-cockpit-D.html"

# ─── Grid 8px ───────────────────────────────────────────────────────────
W, H = 480, 384
PAD = 16

# Header band: y=0..48
HEADER_Y = 24
HEADER_LINE_2 = 38

# Car: centered, proper top-down aspect ratio (~0.6 w/h)
CAR_W, CAR_H = 152, 240
CAR_X = (W - CAR_W) // 2          # 164
CAR_Y = 56
CAR_CX = CAR_X + CAR_W // 2       # 240

# Powertrain band: y=304..352
PT_Y = 304
PT_LABEL_Y = PT_Y + 0
PT_VALUE_Y = PT_Y + 24

# Footer band: y=352..384
FT_DIVIDER_Y = 352
FT_Y = 372

# Wheel positions on the car (in tile coords).
# Top-down Celta: wheels at ~12% from each side, ~28% & ~78% top-bottom.
DOTS = {
    "FL": (CAR_X +  16, CAR_Y +  72),
    "FR": (CAR_X + 136, CAR_Y +  72),
    "RL": (CAR_X +  16, CAR_Y + 184),
    "RR": (CAR_X + 136, CAR_Y + 184),
}

# Tire callout text anchors. Left callouts right-aligned at x=148 (just
# left of car which starts at 164); right callouts left-aligned at x=332
# (just right of car ending at 316).
CALLOUT = {
    "FL": (148, CAR_Y +  64),     # right-aligned
    "FR": (332, CAR_Y +  64),     # left-aligned
    "RL": (148, CAR_Y + 176),
    "RR": (332, CAR_Y + 176),
}


def get_paths():
    if CELTA_PATHS.exists():
        return CELTA_PATHS.read_text()
    src = SRC_SVG.read_text()
    a = src.index('<svg x="200" y="88"')
    a = src.index(">", a) + 1
    b = src.index("</svg>", a)
    s = src[a:b].strip()
    CELTA_PATHS.write_text(s)
    return s


def wheel_block(c, dot, label, anchor, alarm=False):
    """Premium tire callout. Orthogonal leader (horizontal) from dot to text.
    LEFT side: text-anchor=end, leader goes from dot LEFT to text right edge.
    RIGHT side: text-anchor=start, leader goes from dot RIGHT to text left edge."""
    dx, dy = dot
    lx, ly = label
    color = "#FFCC1A" if alarm else "#5DD18C"
    ta = 'end' if anchor == 'left' else 'start'
    halo_anim = ('<animate attributeName="r" values="7;10;7" dur="2.4s" repeatCount="indefinite"/>'
                 if alarm else '')
    label_suffix = ' · ATENÇÃO' if alarm else ''
    psi_default = {'FL':'28.4','FR':'28.5','RL':'29.1','RR':'29.0'}[c]
    temp_default = {'FL':'84','FR':'86','RL':'91','RR':'98'}[c]
    return f'''  <g>
    <circle id="halo-tire-{c}" cx="{dx}" cy="{dy}" r="7" fill="{color}" fill-opacity="0.16">{halo_anim}</circle>
    <circle id="dot-tire-{c}"  cx="{dx}" cy="{dy}" r="2.5" fill="{color}"/>
    <line x1="{dx}" y1="{dy}" x2="{lx}" y2="{dy}" stroke="{color}" stroke-width="0.6" stroke-opacity="0.45" stroke-linecap="round"/>
  </g>
  <g transform="translate({lx}, {ly})" text-anchor="{ta}">
    <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="2" fill="{color}">PNEU {c}{label_suffix}</text>
    <text y="20" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="18" font-weight="500" fill="#E8EBF0" letter-spacing="-0.4"><tspan id="v-tire-{c}-psi">{psi_default}</tspan><tspan font-size="9" fill="#6E7681" dx="3" font-weight="400" letter-spacing="0">psi</tspan></text>
    <text id="t-tire-{c}-temp" y="36" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="11" fill="#9DA3AC" letter-spacing="-0.2"><tspan id="v-tire-{c}-temp">{temp_default}</tspan><tspan font-size="8" fill="#6E7681" dx="2" letter-spacing="0">°C</tspan></text>
  </g>
'''


def main():
    paths = get_paths()

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="tile" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#171C25" stop-opacity="0.97"/>
      <stop offset="100%" stop-color="#0E1218" stop-opacity="0.97"/>
    </linearGradient>
    <radialGradient id="dotHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="currentColor" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="{W}" height="{H}" rx="3" ry="3" fill="url(#tile)" stroke="#1F252E" stroke-width="1"/>

  <!-- ── HEADER (y=0..48) ── -->
  <text x="{PAD}" y="{HEADER_Y}" font-family="Inter, -apple-system, sans-serif" font-size="9" font-weight="700" letter-spacing="2.2" fill="#6E7681">CARRO · #16 · BRUNO M.</text>
  <text x="{PAD}" y="{HEADER_LINE_2}" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="#E8EBF0">Telemetria sobreposta</text>
  <g transform="translate({W-PAD}, {HEADER_Y})" text-anchor="end" font-family="'JetBrains Mono', ui-monospace, monospace">
    <text font-size="8" font-weight="500" fill="#5DD18C" letter-spacing="0.5">TIER 1 · 12Hz · 184ms</text>
    <text y="14" font-size="7" fill="#6E7681" letter-spacing="0.3">INJEPRO T4000 · BLE</text>
  </g>
  <line x1="{PAD}" y1="48" x2="{W-PAD}" y2="48" stroke="#1F252E" stroke-width="1" opacity="0.6"/>

  <!-- ── CARRO (y=56..296) ── -->
  <svg x="{CAR_X}" y="{CAR_Y}" width="{CAR_W}" height="{CAR_H}" viewBox="0 0 2048 2048" preserveAspectRatio="xMidYMid meet">
    {paths}
  </svg>

'''
    svg += wheel_block('FL', DOTS['FL'], CALLOUT['FL'], 'left')
    svg += wheel_block('FR', DOTS['FR'], CALLOUT['FR'], 'right')
    svg += wheel_block('RL', DOTS['RL'], CALLOUT['RL'], 'left')
    svg += wheel_block('RR', DOTS['RR'], CALLOUT['RR'], 'right', alarm=True)

    # ── POWERTRAIN BAND (y=304..344) ──
    # MOTOR section: 3 metrics, x=PAD..328
    # divider at x=328, y=296..344
    # CÂMBIO section: 1 metric, x=336..W-PAD
    svg += f'''
  <line x1="{PAD}" y1="296" x2="{W-PAD}" y2="296" stroke="#1F252E" stroke-width="1" opacity="0.6"/>

  <!-- MOTOR section (3 metrics) -->
  <g transform="translate({PAD}, 312)">
    <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="2.2" fill="#6E7681">MOTOR</text>
    <g transform="translate(0, 14)">
      <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="1.6" fill="#5DD18C">T.MOTOR</text>
      <text y="16" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" font-weight="500" fill="#E8EBF0" letter-spacing="-0.3"><tspan id="v-engine-temp">92</tspan><tspan font-size="8" fill="#6E7681" dx="2" letter-spacing="0">°C</tspan></text>
    </g>
    <g transform="translate(80, 14)">
      <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="1.6" fill="#5DD18C">T.ÓLEO</text>
      <text y="16" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" font-weight="500" fill="#E8EBF0" letter-spacing="-0.3"><tspan id="v-oil-temp">108</tspan><tspan font-size="8" fill="#6E7681" dx="2" letter-spacing="0">°C</tspan></text>
    </g>
    <g transform="translate(160, 14)">
      <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="1.6" fill="#5DD18C">P.ÓLEO</text>
      <text y="16" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" font-weight="500" fill="#E8EBF0" letter-spacing="-0.3"><tspan id="v-oil-press">4.2</tspan><tspan font-size="8" fill="#6E7681" dx="2" letter-spacing="0">bar</tspan></text>
    </g>
  </g>

  <!-- divider between MOTOR and CÂMBIO -->
  <line x1="{W-PAD-128}" y1="306" x2="{W-PAD-128}" y2="346" stroke="#1F252E" stroke-width="1" opacity="0.7"/>

  <!-- CÂMBIO section (1 metric) -->
  <g transform="translate({W-PAD-112}, 312)">
    <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="2.2" fill="#6E7681">CÂMBIO</text>
    <g transform="translate(0, 14)">
      <text id="lbl-gearbox" font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="1.6" fill="#5DD18C">T.CÂMBIO</text>
      <text id="t-gearbox-temp" y="16" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" font-weight="500" fill="#E8EBF0" letter-spacing="-0.3"><tspan id="v-gearbox-temp">78</tspan><tspan font-size="8" fill="#6E7681" dx="2" letter-spacing="0">°C</tspan></text>
    </g>
  </g>

  <!-- invisible gearbox dot anchors (recolor handled on cluster labels) -->
  <circle id="halo-gearbox" cx="{CAR_CX}" cy="{CAR_Y + CAR_H - 24}" r="0" fill="#5DD18C"/>
  <circle id="dot-gearbox" cx="{CAR_CX}" cy="{CAR_Y + CAR_H - 24}" r="0" fill="#5DD18C"/>

  <!-- ── FOOTER (y=352..384) ── -->
  <line x1="{PAD}" y1="{FT_DIVIDER_Y}" x2="{W-PAD}" y2="{FT_DIVIDER_Y}" stroke="#1F252E" stroke-width="1" opacity="0.6"/>

  <g transform="translate({PAD}, {FT_Y})">
    <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="2.2" fill="#FFCC1A" y="-2">TANQUE</text>
    <rect x="48" y="-12" width="120" height="11" fill="none" stroke="#2A3140" stroke-width="1"/>
    <rect x="48" y="-12" width="54" height="11" fill="#FFCC1A" fill-opacity="0.85" id="v-tank-bar"/>
    <text x="176" y="-2" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="12" font-weight="500" fill="#E8EBF0" letter-spacing="-0.2"><tspan id="v-tank-pct">45</tspan><tspan font-size="8" fill="#6E7681">%</tspan></text>
    <text x="206" y="-2" font-family="Inter, sans-serif" font-size="8" fill="#6E7681">~21L · ~12 voltas</text>
  </g>
  <g transform="translate({W-PAD}, {FT_Y})" text-anchor="end">
    <text font-family="Inter, sans-serif" font-size="7" font-weight="700" letter-spacing="2.2" fill="#6E7681" y="-14">Δ TEAM BEST</text>
    <text id="t-delta" y="-2" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="14" font-weight="600" fill="#FF5A1F" letter-spacing="-0.4">+0.42<tspan font-size="8" fill="#6E7681" dx="2" font-weight="400">s</tspan>
      <animate attributeName="fill-opacity" values="1;0.65;1" dur="2.4s" repeatCount="indefinite"/>
    </text>
  </g>
</svg>
'''
    template_html = '''<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Celta · Cockpit Direction D</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#0F1216;--tile:#171C25;--border:#1F252E;--text:#E8EBF0;--text-dim:#6E7681;--accent:#FFCC1A}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;min-height:100vh;padding:24px;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:24px}
.header{grid-column:1/-1;display:flex;justify-content:space-between;align-items:baseline;padding-bottom:14px;border-bottom:1px solid var(--border)}
.header h1{font-size:17px;font-weight:500} .header h1 span{color:var(--accent)}
.header .meta{color:var(--text-dim);font-size:11px;letter-spacing:1.5px;text-transform:uppercase}
.stage{background:linear-gradient(160deg,#12161D 0%,#0A0D12 100%);border:1px solid var(--border);border-radius:4px;padding:24px;display:flex;align-items:center;justify-content:center;min-height:600px;position:sticky;top:24px}
.stage svg{max-width:100%;max-height:720px;filter:drop-shadow(0 8px 20px rgba(0,0,0,0.45))}
.stage svg circle,.stage svg [id^="v-tire"],.stage svg [id^="t-tire"],.stage svg [id^="lbl-"],.stage svg [id^="t-gearbox"]{transition:fill 280ms ease}
.controls{display:flex;flex-direction:column;gap:12px}
.group{background:var(--tile);border:1px solid var(--border);border-radius:4px;padding:12px 14px}
.group h2{font-size:10px;font-weight:700;letter-spacing:2px;color:var(--accent);text-transform:uppercase;margin-bottom:8px}
.row{display:grid;grid-template-columns:90px 1fr 60px;align-items:center;gap:10px;margin:8px 0;font-size:11px}
.row .lbl{font-weight:500} .row .val{font-family:'JetBrains Mono',monospace;text-align:right;font-weight:600;font-size:11px}
.row input[type=range]{width:100%;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:linear-gradient(to right,#1B5BFF 0%,#5DD18C 35%,#FFCC1A 65%,#FF5A1F 100%)}
.row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;cursor:pointer;border:2px solid #0F1216}
.presets button{background:transparent;color:var(--text);border:1px solid var(--border);padding:6px 10px;font-family:inherit;font-size:11px;cursor:pointer;width:100%;margin-bottom:4px;text-align:left;transition:all 0.15s}
.presets button:hover{border-color:var(--accent);color:var(--accent)}
</style></head><body>
<div class="header"><h1>Celta · <span>Cockpit · Direction D</span></h1><div class="meta">P1 FAST · TILE 480x384 · GRID 8PX</div></div>
<div class="stage">__SVG__</div>
<div class="controls">
<div class="group"><h2>Powertrain · MOTOR</h2>
<div class="row"><span class="lbl">T.MOTOR</span><input type="range" id="s-engine-temp" min="60" max="120" value="92"><span class="val" id="d-engine-temp">--</span></div>
<div class="row"><span class="lbl">T.ÓLEO</span><input type="range" id="s-oil-temp" min="60" max="150" value="108"><span class="val" id="d-oil-temp">--</span></div>
<div class="row"><span class="lbl">P.ÓLEO</span><input type="range" id="s-oil-press" min="0" max="10" step="0.1" value="4.2"><span class="val" id="d-oil-press">--</span></div>
</div>
<div class="group"><h2>Powertrain · CÂMBIO</h2>
<div class="row"><span class="lbl">T.CÂMBIO</span><input type="range" id="s-gearbox-temp" min="40" max="120" value="78"><span class="val" id="d-gearbox-temp">--</span></div>
</div>
<div class="group"><h2>Pneus · pressão (psi)</h2>
<div class="row"><span class="lbl">FL</span><input type="range" id="s-tire-FL-psi" min="20" max="40" step="0.1" value="28.4"><span class="val" id="d-tire-FL-psi">--</span></div>
<div class="row"><span class="lbl">FR</span><input type="range" id="s-tire-FR-psi" min="20" max="40" step="0.1" value="28.5"><span class="val" id="d-tire-FR-psi">--</span></div>
<div class="row"><span class="lbl">RL</span><input type="range" id="s-tire-RL-psi" min="20" max="40" step="0.1" value="29.1"><span class="val" id="d-tire-RL-psi">--</span></div>
<div class="row"><span class="lbl">RR</span><input type="range" id="s-tire-RR-psi" min="20" max="40" step="0.1" value="29.0"><span class="val" id="d-tire-RR-psi">--</span></div>
</div>
<div class="group"><h2>Pneus · temperatura (°C)</h2>
<div class="row"><span class="lbl">FL</span><input type="range" id="s-tire-FL-temp" min="50" max="130" value="84"><span class="val" id="d-tire-FL-temp">--</span></div>
<div class="row"><span class="lbl">FR</span><input type="range" id="s-tire-FR-temp" min="50" max="130" value="86"><span class="val" id="d-tire-FR-temp">--</span></div>
<div class="row"><span class="lbl">RL</span><input type="range" id="s-tire-RL-temp" min="50" max="130" value="91"><span class="val" id="d-tire-RL-temp">--</span></div>
<div class="row"><span class="lbl">RR</span><input type="range" id="s-tire-RR-temp" min="50" max="130" value="98"><span class="val" id="d-tire-RR-temp">--</span></div>
</div>
<div class="group"><h2>Combustível</h2>
<div class="row"><span class="lbl">TANQUE</span><input type="range" id="s-tank" min="0" max="100" value="45"><span class="val" id="d-tank">--</span></div>
</div>
<div class="group presets"><h2>Cenários rápidos</h2>
<button onclick="preset('start')">Início de stint · tudo verde</button>
<button onclick="preset('rr-warn')">Pneu RR atenção</button>
<button onclick="preset('engine-hot')">Motor superaquecendo</button>
<button onclick="preset('low-fuel')">Tanque baixando</button>
<button onclick="preset('all-clear')">Tudo na janela ideal</button>
</div></div>
<script>
const COLOR={ok:'#5DD18C',warn:'#FFCC1A',crit:'#FF5A1F'};
const cls=(v,a,b)=>v<a?'ok':v<b?'warn':'crit';
const clsGbox=c=>cls(c,90,105);
const clsTirePsi=p=>{const d=Math.abs(p-29.0);return d<1.5?'ok':d<3.0?'warn':'crit'};
const clsTireTemp=c=>cls(c,95,110);
const worst=(...xs)=>{const r=['ok','warn','crit'];return r[Math.max(...xs.map(x=>r.indexOf(x)))]};
const $=id=>document.getElementById(id);
const setText=(id,v)=>{const e=$(id);if(e)e.textContent=v};
const setFill=(id,h)=>{const e=$(id);if(e)e.setAttribute('fill',h)};
function tickAll(){
  const t=+$('s-engine-temp').value,o=+$('s-oil-temp').value,p=parseFloat($('s-oil-press').value),g=+$('s-gearbox-temp').value;
  setText('v-engine-temp',t);setText('d-engine-temp',t+'°C');
  setText('v-oil-temp',o);setText('d-oil-temp',o+'°C');
  setText('v-oil-press',p.toFixed(1));setText('d-oil-press',p.toFixed(1)+' bar');
  setText('v-gearbox-temp',g);setText('d-gearbox-temp',g+'°C');
  const gh=COLOR[clsGbox(g)];setFill('lbl-gearbox',gh);setFill('t-gearbox-temp',gh);
  ['FL','FR','RL','RR'].forEach(c=>{
    const psi=parseFloat($('s-tire-'+c+'-psi').value),temp=+$('s-tire-'+c+'-temp').value;
    setText('v-tire-'+c+'-psi',psi.toFixed(1));setText('d-tire-'+c+'-psi',psi.toFixed(1)+' psi');
    setText('v-tire-'+c+'-temp',temp);setText('d-tire-'+c+'-temp',temp+'°C');
    const h=COLOR[worst(clsTirePsi(psi),clsTireTemp(temp))];
    setFill('dot-tire-'+c,h);setFill('halo-tire-'+c,h);
    setFill('v-tire-'+c+'-psi',h);setFill('t-tire-'+c+'-temp',h);
  });
  const v=+$('s-tank').value;setText('v-tank-pct',v);setText('d-tank',v+'%');
  const bar=$('v-tank-bar');if(bar)bar.setAttribute('width',(v/100*120).toFixed(1));
}
document.querySelectorAll('input[type=range]').forEach(s=>s.addEventListener('input',tickAll));tickAll();
function preset(name){
  const P={
    start:{'engine-temp':78,'oil-temp':88,'oil-press':4.5,'gearbox-temp':72,'tire-FL-psi':29,'tire-FR-psi':29,'tire-RL-psi':29,'tire-RR-psi':29,'tire-FL-temp':65,'tire-FR-temp':65,'tire-RL-temp':65,'tire-RR-temp':65,tank:95},
    'rr-warn':{'engine-temp':92,'oil-temp':108,'oil-press':4.2,'gearbox-temp':78,'tire-FL-psi':28.4,'tire-FR-psi':28.5,'tire-RL-psi':29.1,'tire-RR-psi':29.0,'tire-FL-temp':84,'tire-FR-temp':86,'tire-RL-temp':91,'tire-RR-temp':98,tank:45},
    'engine-hot':{'engine-temp':113,'oil-temp':128,'oil-press':3.4,'gearbox-temp':96,'tire-FL-psi':29.8,'tire-FR-psi':29.8,'tire-RL-psi':30.2,'tire-RR-psi':30.0,'tire-FL-temp':92,'tire-FR-temp':95,'tire-RL-temp':96,'tire-RR-temp':102,tank:30},
    'low-fuel':{'engine-temp':95,'oil-temp':110,'oil-press':4.0,'gearbox-temp':82,'tire-FL-psi':29.4,'tire-FR-psi':29.4,'tire-RL-psi':29.6,'tire-RR-psi':29.5,'tire-FL-temp':88,'tire-FR-temp':89,'tire-RL-temp':92,'tire-RR-temp':94,tank:8},
    'all-clear':{'engine-temp':88,'oil-temp':100,'oil-press':4.5,'gearbox-temp':80,'tire-FL-psi':29,'tire-FR-psi':29,'tire-RL-psi':29,'tire-RR-psi':29,'tire-FL-temp':80,'tire-FR-temp':80,'tire-RL-temp':82,'tire-RR-temp':82,tank:70},
  };
  const v=P[name];if(!v)return;
  Object.entries(v).forEach(([k,x])=>{const s=$('s-'+k);if(s)s.value=x});tickAll();
}
</script></body></html>
'''
    OUT.write_text(template_html.replace('__SVG__', svg), encoding='utf-8')
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size//1024} KB)")

main()
