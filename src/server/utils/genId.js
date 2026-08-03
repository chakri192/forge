import crypto from 'crypto';

export function genId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function nowIso() {
  return new Date().toISOString();
}
