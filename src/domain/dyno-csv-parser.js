// dyno-csv-parser — lê CSV de dinamômetro (Dynojet/Mustang/Dynapack/genérico)
// e devolve uma curva normalizada `{ format, points: [{rpm, torque_nm, power_kw}] }`.
//
// Estratégia: detecta o separador, identifica colunas por regex no header,
// converte unidades (lb-ft → Nm, hp/cv → kW) e completa torque↔potência via
// a relação P(kW) = T(Nm) × RPM / 9549.

const HP_TO_KW = 0.7457;
const LBFT_TO_NM = 1.355818;

function detectSeparator(line) {
  const candidates = [',', ';', '\t'];
  let best = ',', bestCount = 0;
  for (const c of candidates) {
    const re = new RegExp(c === '\t' ? '\\t' : c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
    const cnt = (line.match(re) || []).length;
    if (cnt > bestCount) { bestCount = cnt; best = c; }
  }
  return best;
}

function detectFormat(headersStr) {
  const h = headersStr.toLowerCase();
  if (h.includes('dynojet')) return 'dynojet';
  if (h.includes('mustang')) return 'mustang';
  if (h.includes('dynapack')) return 'dynapack';
  return 'generic';
}

function findCol(headers, patterns) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    for (const p of patterns) {
      if (p.test(h)) return i;
    }
  }
  return -1;
}

function parseNum(s) {
  if (s == null) return NaN;
  const cleaned = String(s).replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : NaN;
}

export function parseDynoCsv(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('CSV vazio ou inválido');
  }
  const allLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (allLines.length < 2) {
    throw new Error('CSV precisa de header + ao menos 1 linha de dados');
  }
  // CSVs reais frequentemente têm linhas de metadata antes do header.
  // Header = primeira linha que contém a palavra "rpm" (case-insensitive).
  let headerIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (/\brpm\b/i.test(allLines[i]) && /[,;\t]/.test(allLines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 0;
  const preamble = allLines.slice(0, headerIdx).join(' ');
  const lines = allLines.slice(headerIdx);
  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => h.trim());
  const format = detectFormat(preamble + ' ' + lines[0]);

  const idxRpm = findCol(headers, [/^rpm$/i, /\brpm\b/i, /engine\s*rpm/i, /eng\.?\s*rpm/i]);
  if (idxRpm < 0) throw new Error('Coluna de RPM não encontrada');

  const idxTorqueNm  = findCol(headers, [/torque.*\bnm\b/i, /torq.*\bnm\b/i, /torque.*\(n[·\.\s\-]*m\)/i]);
  const idxTorqueLb  = idxTorqueNm < 0 ? findCol(headers, [/torque.*lb[\s\-]?ft/i, /torq.*lb[\s\-]?ft/i, /torque.*ftlb/i]) : -1;
  const idxTorqueGen = (idxTorqueNm < 0 && idxTorqueLb < 0) ? findCol(headers, [/^torque$/i, /\btorque\b/i, /\btorq\b/i]) : -1;

  const idxPowerKw   = findCol(headers, [/power.*\bkw\b/i, /pot.*\bkw\b/i, /\(kw\)/i]);
  const idxPowerHp   = idxPowerKw < 0 ? findCol(headers, [/power.*\bhp\b/i, /\bhp\b/i, /\bbhp\b/i]) : -1;
  const idxPowerCv   = (idxPowerKw < 0 && idxPowerHp < 0) ? findCol(headers, [/\bcv\b/i]) : -1;
  const idxPowerGen  = (idxPowerKw < 0 && idxPowerHp < 0 && idxPowerCv < 0) ? findCol(headers, [/^power$/i, /\bpower\b/i, /\bpot[eê]ncia\b/i]) : -1;

  if (idxTorqueNm < 0 && idxTorqueLb < 0 && idxTorqueGen < 0
      && idxPowerKw < 0 && idxPowerHp < 0 && idxPowerCv < 0 && idxPowerGen < 0) {
    throw new Error('Nenhuma coluna de torque ou potência encontrada');
  }

  const points = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = lines[li].split(sep).map(c => c.trim());
    if (cells.length < 2) continue;
    const rpm = parseNum(cells[idxRpm]);
    if (!Number.isFinite(rpm) || rpm <= 0) continue;

    let torque_nm = null;
    if (idxTorqueNm >= 0) torque_nm = parseNum(cells[idxTorqueNm]);
    else if (idxTorqueLb >= 0) {
      const v = parseNum(cells[idxTorqueLb]);
      if (Number.isFinite(v)) torque_nm = v * LBFT_TO_NM;
    } else if (idxTorqueGen >= 0) {
      torque_nm = parseNum(cells[idxTorqueGen]);
    }

    let power_kw = null;
    if (idxPowerKw >= 0) power_kw = parseNum(cells[idxPowerKw]);
    else if (idxPowerHp >= 0) {
      const v = parseNum(cells[idxPowerHp]);
      if (Number.isFinite(v)) power_kw = v * HP_TO_KW;
    } else if (idxPowerCv >= 0) {
      const v = parseNum(cells[idxPowerCv]);
      if (Number.isFinite(v)) power_kw = v * HP_TO_KW; // cv ≈ 0.7457 kW
    } else if (idxPowerGen >= 0) {
      power_kw = parseNum(cells[idxPowerGen]);
    }

    if (Number.isFinite(torque_nm) && !Number.isFinite(power_kw)) {
      power_kw = torque_nm * rpm / 9549;
    }
    if (!Number.isFinite(torque_nm) && Number.isFinite(power_kw)) {
      torque_nm = power_kw * 9549 / rpm;
    }

    if (!Number.isFinite(torque_nm) && !Number.isFinite(power_kw)) continue;

    points.push({
      rpm,
      torque_nm: Number.isFinite(torque_nm) ? torque_nm : null,
      power_kw: Number.isFinite(power_kw) ? power_kw : null
    });
  }

  if (points.length < 3) {
    throw new Error('Curva precisa de ao menos 3 pontos válidos (encontrei ' + points.length + ')');
  }
  points.sort((a, b) => a.rpm - b.rpm);
  return { format, points };
}
