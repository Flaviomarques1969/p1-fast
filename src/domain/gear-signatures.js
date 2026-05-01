// gear-signatures — leitura/aprendizado de assinaturas rpm/speed por marcha.
// Funções puras; persistência fica a cargo do chamador (cars.js, etc).

const MIN_SPEED_KMH = 5;
const MIN_SAMPLES = 5;

// loadSignatures(car) — extrai gear_signatures do carro, ou null se ausente
export function loadSignatures(car) {
  if (!car || !car.gear_signatures) return null;
  return car.gear_signatures;
}

// learnSignature(samples) — aprende a assinatura rpm_speed_ratio de uma marcha
// a partir de samples constantes (carro estabilizado nessa marcha).
//   samples: [{ rpm, speed }, ...]
// Retorna: { rpm_speed_ratio, rpm_speed_ratio_std, sample_count } ou
//          { rpm_speed_ratio: null, ..., reason } se insuficiente.
export function learnSignature(samples) {
  if (!Array.isArray(samples)) {
    return { rpm_speed_ratio: null, sample_count: 0, reason: 'samples not array' };
  }
  const valid = samples.filter(s =>
    s && Number.isFinite(s.rpm) && s.rpm > 0
      && Number.isFinite(s.speed) && s.speed >= MIN_SPEED_KMH
  );
  if (valid.length < MIN_SAMPLES) {
    return { rpm_speed_ratio: null, sample_count: valid.length, reason: 'insufficient samples' };
  }
  const ratios = valid.map(s => s.rpm / s.speed).sort((a, b) => a - b);
  const trim = Math.floor(ratios.length * 0.1);
  const trimmed = trim > 0 ? ratios.slice(trim, ratios.length - trim) : ratios;
  const mean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  const variance = trimmed.reduce((a, b) => a + (b - mean) * (b - mean), 0) / trimmed.length;
  return {
    rpm_speed_ratio: mean,
    rpm_speed_ratio_std: Math.sqrt(variance),
    sample_count: valid.length
  };
}
