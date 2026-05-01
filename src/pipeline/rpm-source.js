// rpm-source — interface única pra fontes de RPM (e TPS).
//
// O Shift Light precisa de RPM em tempo real, mas a fonte muda conforme
// o setup do piloto: ECU via Bluetooth (Injepro/MoTeC), OBD-II, simulador,
// arquivo replay. Este módulo isola essa diversidade atrás de um contrato
// estável que o `shift-light-bridge` consome.
//
// Contrato de RpmSource:
//   {
//     getRpm():    number | null     // RPM corrente, null se sem leitura fresca
//     getTps():    number | null     // 0..100, null se sensor ausente
//     getStatus(): 'connected' | 'degraded' | 'lost'
//     start():     Promise<void> | void
//     stop():      void
//   }

const FRESHNESS_MS_DEFAULT = 500;

// createManualRpmSource — caller atualiza via setRpm()/setTps().
// Útil pra testes, simulador, ou pra ligar manualmente a qualquer canal
// externo (Web Bluetooth, MQTT, WebSocket) que ainda não vira adapter.
export function createManualRpmSource({ freshnessMs = FRESHNESS_MS_DEFAULT, now = () => Date.now() } = {}) {
  let rpm = null, tps = null, lastUpdate = -Infinity, started = false;
  return {
    setRpm(v) { rpm = Number.isFinite(v) && v >= 0 ? v : null; lastUpdate = now(); },
    setTps(v) { tps = Number.isFinite(v) ? v : null; },
    getRpm() {
      if (!started) return null;
      if (now() - lastUpdate > freshnessMs) return null;
      return rpm;
    },
    getTps() { return started ? tps : null; },
    getStatus() {
      if (!started) return 'lost';
      const age = now() - lastUpdate;
      if (age > freshnessMs * 2) return 'lost';
      if (age > freshnessMs) return 'degraded';
      return 'connected';
    },
    start() { started = true; },
    stop()  { started = false; rpm = null; tps = null; }
  };
}

// createMockRpmSource — RPM "scriptado" por trajetória (testes E2E).
// Aceita uma função `(t) => { rpm, tps }` que define o que reportar.
export function createMockRpmSource(scriptFn) {
  if (typeof scriptFn !== 'function') {
    throw new Error('createMockRpmSource: scriptFn obrigatório');
  }
  let started = false, lastT = null;
  return {
    tick(t) { lastT = t; },
    getRpm() {
      if (!started || lastT == null) return null;
      const v = scriptFn(lastT);
      return v && Number.isFinite(v.rpm) ? v.rpm : null;
    },
    getTps() {
      if (!started || lastT == null) return null;
      const v = scriptFn(lastT);
      return v && Number.isFinite(v.tps) ? v.tps : null;
    },
    getStatus() { return started ? 'connected' : 'lost'; },
    start() { started = true; },
    stop()  { started = false; lastT = null; }
  };
}

// connectBleRpmSource — esqueleto pra Web Bluetooth (Injepro/OBD-II).
// O parsing de characteristic é específico do dispositivo; o adapter
// concreto fica no app. Aqui só garantimos a forma do contrato.
export function createBleRpmSource({
  device,             // BluetoothDevice (já pareado pelo caller)
  rpmCharacteristic,  // BluetoothRemoteGATTCharacteristic
  parseValue,         // (DataView) → { rpm, tps }
  freshnessMs = FRESHNESS_MS_DEFAULT,
  now = () => Date.now()
} = {}) {
  if (!device || !rpmCharacteristic || typeof parseValue !== 'function') {
    throw new Error('createBleRpmSource: device + rpmCharacteristic + parseValue obrigatórios');
  }
  let rpm = null, tps = null, lastUpdate = -Infinity, started = false;
  function onValueChanged(ev) {
    const v = ev?.target?.value;
    if (!v) return;
    let parsed;
    try { parsed = parseValue(v); } catch { parsed = null; }
    if (!parsed) return;
    if (Number.isFinite(parsed.rpm)) rpm = parsed.rpm;
    if (Number.isFinite(parsed.tps)) tps = parsed.tps;
    lastUpdate = now();
  }
  return {
    async start() {
      if (started) return;
      rpmCharacteristic.addEventListener('characteristicvaluechanged', onValueChanged);
      await rpmCharacteristic.startNotifications();
      started = true;
    },
    stop() {
      if (!started) return;
      rpmCharacteristic.removeEventListener('characteristicvaluechanged', onValueChanged);
      try { rpmCharacteristic.stopNotifications(); } catch { /* ignore */ }
      started = false;
      rpm = null; tps = null;
    },
    getRpm() {
      if (!started) return null;
      if (now() - lastUpdate > freshnessMs) return null;
      return rpm;
    },
    getTps() { return started ? tps : null; },
    getStatus() {
      if (!started || !device.gatt?.connected) return 'lost';
      const age = now() - lastUpdate;
      if (age > freshnessMs * 2) return 'lost';
      if (age > freshnessMs) return 'degraded';
      return 'connected';
    }
  };
}
