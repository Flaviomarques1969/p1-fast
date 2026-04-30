// ═══════════════════════════════════════════════════════════
// logger — logs técnicos estruturados
// ═══════════════════════════════════════════════════════════
// - 4 níveis: debug / info / warn / error
// - buffer circular em memória (últimos N)
// - espelha no console do navegador
// - pode persistir em IndexedDB via setSink() (opcional)
// - exportação JSON pra diagnóstico

const LEVELS = Object.freeze(['debug', 'info', 'warn', 'error']);
const LEVEL_IDX = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

class Logger {
  constructor() {
    this.buffer = [];
    this.maxBuffer = 500;
    this.minLevel = 'debug'; // em prod, 'info'
    this.sink = null;        // callback opcional p/ persistência externa
  }

  setLevel(level) {
    if (!LEVELS.includes(level)) throw new Error(`nível inválido: ${level}`);
    this.minLevel = level;
  }

  setSink(fn) {
    this.sink = fn;
  }

  _emit(level, msg, meta) {
    if (LEVEL_IDX[level] < LEVEL_IDX[this.minLevel]) return;
    const entry = {
      ts: Date.now(),
      level,
      msg: String(msg),
      meta: meta == null ? null : meta,
    };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();

    // Console mirror
    const fn = console[level] || console.log;
    if (meta != null) fn(`[${level}]`, msg, meta);
    else fn(`[${level}]`, msg);

    // Sink externo
    if (this.sink) {
      try { this.sink(entry); } catch (_) { /* nunca deixar sink derrubar o logger */ }
    }
  }

  debug(msg, meta) { this._emit('debug', msg, meta); }
  info(msg, meta)  { this._emit('info',  msg, meta); }
  warn(msg, meta)  { this._emit('warn',  msg, meta); }
  error(msg, meta) { this._emit('error', msg, meta); }

  getAll() { return [...this.buffer]; }
  clear()  { this.buffer = []; }
  exportJson() { return JSON.stringify(this.buffer, null, 2); }
}

export const logger = new Logger();
