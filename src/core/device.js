// ═══════════════════════════════════════════════════════════
// device — identificação do dispositivo local
// ═══════════════════════════════════════════════════════════
// Cada dispositivo (tablet/iPhone/outro) gera um ID único persistido
// em localStorage (não IndexedDB — IndexedDB poderia ser limpo sem afetar identidade
// entre sessões de navegador).
//
// Esse ID é local, não replica entre devices. Dois iPhones do mesmo piloto
// têm deviceId diferente.

import { db } from './db.js';
import { uid } from './id.js';
import { logger } from './logger.js';

const STORAGE_KEY = 'fam_device_id';
const ENTITY = 'Device';

function buildFingerprint() {
  const ua = navigator.userAgent;
  const lang = navigator.language;
  const platform = navigator.platform;
  const screen = `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { ua, lang, platform, screen, tz };
}

function describePlatform() {
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return 'iPad';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'unknown';
}

export const Device = {
  /** Retorna (ou cria) o registro do device local. Idempotente. */
  async getOrCreate() {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = uid('dev');
      localStorage.setItem(STORAGE_KEY, id);
    }
    let record = await db.devices.get(id);
    if (!record) {
      const now = Date.now();
      record = {
        id,
        fingerprint: buildFingerprint(),
        plataforma: describePlatform(),
        criadoEm: now,
        vistoEm: now,
      };
      await db.devices.add(record);
      logger.info('[device] criado', { id, plataforma: record.plataforma });
    } else {
      // Atualiza vistoEm silenciosamente
      record.vistoEm = Date.now();
      await db.devices.put(record);
    }
    return record;
  },

  async current() {
    return this.getOrCreate();
  },

  async list() {
    return db.devices.toArray();
  },

  async get(id) {
    return db.devices.get(id);
  },

  /** Debug: limpa identidade (gera novo ID na próxima). */
  _reset() {
    localStorage.removeItem(STORAGE_KEY);
    logger.warn('[device] identidade resetada');
  },
};
