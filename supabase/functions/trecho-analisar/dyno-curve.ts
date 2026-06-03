// ═══════════════════════════════════════════════════════════
// dyno-curve.ts — port TypeScript de ios/p1fast-core/.../DynoCurve.swift
// Bloco 3 do Plano Piloto + Engenheiro (2026-05-18).
// ═══════════════════════════════════════════════════════════
// Mesma estrutura e mesma fórmula que a versão Swift. As 2 fontes
// têm que continuar idênticas no comportamento — quando atualizar
// uma, atualizar a outra.

export interface DynoSample {
  rpm: number;
  torqueNm: number;
  powerHp: number;
}

export interface DynoCurve {
  label: string;
  samples: DynoSample[]; // sempre ordenadas por RPM crescente
}

/** Cria curva ordenando as amostras por RPM (cópia defensiva). */
export function makeDynoCurve(label: string, samples: DynoSample[]): DynoCurve {
  const sorted = [...samples].sort((a, b) => a.rpm - b.rpm);
  return { label, samples: sorted };
}

/** Interpolação linear de torque (N·m) no RPM dado. Clamp nos extremos. */
export function torqueAt(curve: DynoCurve, rpm: number): number {
  const s = curve.samples;
  if (s.length === 0) return 0;
  if (rpm <= s[0].rpm) return s[0].torqueNm;
  if (rpm >= s[s.length - 1].rpm) return s[s.length - 1].torqueNm;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (rpm >= a.rpm && rpm <= b.rpm) {
      const denom = b.rpm - a.rpm;
      if (denom === 0) return a.torqueNm;
      const t = (rpm - a.rpm) / denom;
      return a.torqueNm + t * (b.torqueNm - a.torqueNm);
    }
  }
  return s[s.length - 1].torqueNm;
}

/** Interpolação linear de potência (HP) no RPM dado. Clamp nos extremos. */
export function powerHpAt(curve: DynoCurve, rpm: number): number {
  const s = curve.samples;
  if (s.length === 0) return 0;
  if (rpm <= s[0].rpm) return s[0].powerHp;
  if (rpm >= s[s.length - 1].rpm) return s[s.length - 1].powerHp;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (rpm >= a.rpm && rpm <= b.rpm) {
      const denom = b.rpm - a.rpm;
      if (denom === 0) return a.powerHp;
      const t = (rpm - a.rpm) / denom;
      return a.powerHp + t * (b.powerHp - a.powerHp);
    }
  }
  return s[s.length - 1].powerHp;
}

export function peakTorque(curve: DynoCurve): DynoSample | null {
  if (curve.samples.length === 0) return null;
  let best = curve.samples[0];
  for (const s of curve.samples) {
    if (s.torqueNm > best.torqueNm) best = s;
  }
  return best;
}

export function peakPower(curve: DynoCurve): DynoSample | null {
  if (curve.samples.length === 0) return null;
  let best = curve.samples[0];
  for (const s of curve.samples) {
    if (s.powerHp > best.powerHp) best = s;
  }
  return best;
}

/** Curva oficial Celta Bubi 2026-05-18. Espelho do `DynoCurve.celtaBubi2026_05_18`. */
export const CELTA_BUBI_2026_05_18: DynoCurve = makeDynoCurve(
  "Celta Bubi 2026-05-18 (motor Onix 1.4 + câmbio Celta 1.0)",
  [
    { rpm: 2500, torqueNm: -2.2, powerHp: -0.8 },
    { rpm: 2550, torqueNm: 112.5, powerHp: 40.3 },
    { rpm: 2600, torqueNm: 143.9, powerHp: 52.5 },
    { rpm: 2650, torqueNm: 156.3, powerHp: 58.2 },
    { rpm: 2700, torqueNm: 159.1, powerHp: 60.3 },
    { rpm: 2750, torqueNm: 159.1, powerHp: 61.5 },
    { rpm: 2800, torqueNm: 159.7, powerHp: 62.8 },
    { rpm: 2850, torqueNm: 160.3, powerHp: 64.2 },
    { rpm: 2900, torqueNm: 160.6, powerHp: 65.4 },
    { rpm: 2950, torqueNm: 160.3, powerHp: 66.4 },
    { rpm: 3000, torqueNm: 159.2, powerHp: 67.1 },
    { rpm: 3050, torqueNm: 158.5, powerHp: 67.9 },
    { rpm: 3100, torqueNm: 158.1, powerHp: 68.8 },
    { rpm: 3150, torqueNm: 158.2, powerHp: 70.0 },
    { rpm: 3200, torqueNm: 158.2, powerHp: 71.1 },
    { rpm: 3250, torqueNm: 158.7, powerHp: 72.4 },
    { rpm: 3300, torqueNm: 159.6, powerHp: 74.0 },
    { rpm: 3350, torqueNm: 160.2, powerHp: 75.4 },
    { rpm: 3400, torqueNm: 160.1, powerHp: 76.4 },
    { rpm: 3450, torqueNm: 159.0, powerHp: 77.0 },
    { rpm: 3500, torqueNm: 157.9, powerHp: 77.6 },
    { rpm: 3550, torqueNm: 157.4, powerHp: 78.5 },
    { rpm: 3600, torqueNm: 157.5, powerHp: 79.7 },
    { rpm: 3650, torqueNm: 157.9, powerHp: 81.0 },
    { rpm: 3700, torqueNm: 158.5, powerHp: 82.4 },
    { rpm: 3750, torqueNm: 158.9, powerHp: 83.7 },
    { rpm: 3800, torqueNm: 159.4, powerHp: 85.1 },
    { rpm: 3850, torqueNm: 159.7, powerHp: 86.4 },
    { rpm: 3900, torqueNm: 160.0, powerHp: 87.7 },
    { rpm: 3950, torqueNm: 160.2, powerHp: 88.9 },
    { rpm: 4000, torqueNm: 160.2, powerHp: 90.0 },
    { rpm: 4050, torqueNm: 160.3, powerHp: 91.2 },
    { rpm: 4100, torqueNm: 160.4, powerHp: 92.3 },
    { rpm: 4150, torqueNm: 160.5, powerHp: 93.4 },
    { rpm: 4200, torqueNm: 160.5, powerHp: 94.5 },
    { rpm: 4250, torqueNm: 160.4, powerHp: 95.5 },
    { rpm: 4300, torqueNm: 160.0, powerHp: 96.5 },
    { rpm: 4350, torqueNm: 159.7, powerHp: 97.4 },
    { rpm: 4400, torqueNm: 159.3, powerHp: 98.4 },
    { rpm: 4450, torqueNm: 158.9, powerHp: 99.2 },
    { rpm: 4500, torqueNm: 158.6, powerHp: 99.9 },
    { rpm: 4550, torqueNm: 158.2, powerHp: 100.7 },
    { rpm: 4600, torqueNm: 158.0, powerHp: 101.6 },
    { rpm: 4650, torqueNm: 158.0, powerHp: 102.7 },
    { rpm: 4700, torqueNm: 158.1, powerHp: 103.8 },
    { rpm: 4750, torqueNm: 158.1, powerHp: 104.8 },
    { rpm: 4800, torqueNm: 158.0, powerHp: 105.8 },
    { rpm: 4850, torqueNm: 158.1, powerHp: 106.9 },
    { rpm: 4900, torqueNm: 158.2, powerHp: 108.0 },
    { rpm: 4950, torqueNm: 159.7, powerHp: 110.0 },
    { rpm: 5000, torqueNm: 160.9, powerHp: 112.4 },
    { rpm: 5050, torqueNm: 161.2, powerHp: 114.1 },
    { rpm: 5100, torqueNm: 161.7, powerHp: 115.7 },
    { rpm: 5150, torqueNm: 161.3, powerHp: 116.5 },
    { rpm: 5200, torqueNm: 162.1, powerHp: 117.8 },
    { rpm: 5250, torqueNm: 160.5, powerHp: 118.0 },
    { rpm: 5300, torqueNm: 160.0, powerHp: 118.9 },
    { rpm: 5350, torqueNm: 159.0, powerHp: 119.4 },
    { rpm: 5400, torqueNm: 157.8, powerHp: 119.5 },
    { rpm: 5450, torqueNm: 157.0, powerHp: 120.0 },
    { rpm: 5500, torqueNm: 156.1, powerHp: 120.4 },
    { rpm: 5550, torqueNm: 154.8, powerHp: 120.5 },
    { rpm: 5600, torqueNm: 153.6, powerHp: 120.6 },
    { rpm: 5650, torqueNm: 152.9, powerHp: 121.2 },
    { rpm: 5700, torqueNm: 152.1, powerHp: 121.6 },
    { rpm: 5750, torqueNm: 150.8, powerHp: 121.6 },
    { rpm: 5800, torqueNm: 149.7, powerHp: 121.8 },
    { rpm: 5850, torqueNm: 148.6, powerHp: 122.0 },
    { rpm: 5900, torqueNm: 147.5, powerHp: 122.2 },
    { rpm: 5950, torqueNm: 146.4, powerHp: 122.3 },
    { rpm: 6000, torqueNm: 145.6, powerHp: 122.7 },
    { rpm: 6050, torqueNm: 144.5, powerHp: 122.8 },
    { rpm: 6100, torqueNm: 142.1, powerHp: 121.7 },
    { rpm: 6150, torqueNm: 138.5, powerHp: 119.7 },
    { rpm: 6200, torqueNm: 136.3, powerHp: 118.7 },
    { rpm: 6250, torqueNm: 135.2, powerHp: 118.7 },
    { rpm: 6300, torqueNm: 130.1, powerHp: 115.1 },
    { rpm: 6350, torqueNm: 114.4, powerHp: 102.0 },
    { rpm: 6400, torqueNm: 78.7, powerHp: 70.8 },
  ]
);
