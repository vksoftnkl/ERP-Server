import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { waRefuse } from './wa-errors';
import { WA_CODES } from './wa.constants';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** `gcm:v<version>:<iv>:<tag>:<ciphertext>`, base64 parts — the GstCryptoService envelope. */
const ENVELOPE = /^gcm:v(\d+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)$/;

/**
 * Decision 13 — the relay install key, encrypted at rest with WA_CRED_KEY
 * (AES-256-GCM, the same `gcm:v<n>:` envelope as GstCryptoService, which is
 * left untouched). The ERP never holds a Meta token: only this key.
 *
 * KEYS (env, read at call time):
 *   WA_CRED_KEY          the current key: 32 bytes as 64 hex characters or base64
 *   WA_CRED_KEY_VERSION  its version, default 1 (wac_key_version)
 *   WA_CRED_KEY_V<n>     an older key, only to read a value still wrapped under it
 *
 * A server with no WA_CRED_KEY refuses activation with 503 WA_KEY_MISSING (risk 9).
 */
@Injectable()
export class WaCryptoService {
  currentVersion(): number {
    const raw = process.env.WA_CRED_KEY_VERSION?.trim();
    const version = raw ? Number(raw) : 1;
    if (!Number.isInteger(version) || version < 1 || version > 32767) {
      this.keyProblem(`WA_CRED_KEY_VERSION must be a whole number from 1 (is "${raw}")`);
    }
    return version;
  }

  isConfigured(): boolean {
    const raw = process.env.WA_CRED_KEY?.trim();
    return Boolean(raw) && raw !== 'CHANGE_ME';
  }

  encrypt(plain: string): string {
    const version = this.currentVersion();
    const key = this.keyFor(version);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      'gcm',
      `v${version}`,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      body.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const match = ENVELOPE.exec(stored);
    if (!match) {
      this.keyProblem('The stored WhatsApp key is not in the gcm:v<n>:… form this server writes');
    }
    const [, version, iv, tag, body] = match;
    const decipher = createDecipheriv(ALGORITHM, this.keyFor(Number(version)), Buffer.from(iv, 'base64'), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    try {
      return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      this.keyProblem(
        `The stored WhatsApp key does not open with WA_CRED_KEY v${version}: the key changed without its version`,
      );
    }
  }

  private keyFor(version: number): Buffer {
    const name = version === this.currentVersion() ? 'WA_CRED_KEY' : `WA_CRED_KEY_V${version}`;
    const raw = process.env[name]?.trim();
    if (!raw || raw === 'CHANGE_ME') {
      this.keyProblem(
        name === 'WA_CRED_KEY'
          ? 'WA_CRED_KEY is not set on this server, so the WhatsApp key cannot be stored or read'
          : `${name} is not set: the stored WhatsApp key is wrapped under key v${version}`,
      );
    }
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      this.keyProblem(`${name} must be 32 bytes, as 64 hex characters or base64`);
    }
    return key;
  }

  private keyProblem(message: string): never {
    waRefuse(WA_CODES.KEY_MISSING, message, 'WA_CRED_KEY');
  }
}
