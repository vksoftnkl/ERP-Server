import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { buildSettingsErrorResponse } from 'src/common/utils/module-service.utils';
import { GST_CODES } from './gst-config.constants';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** `gcm:v<version>:<iv>:<tag>:<ciphertext>`, base64 parts. */
const ENVELOPE = /^gcm:v(\d+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)$/;

/**
 * Application encryption of every gst_* `_enc` column (plan-backend-gsp §1:
 * AES-256-GCM with GST_CRED_KEY). The key never lives in the database it
 * protects — a pgcrypto key next to its data is decoration.
 *
 * KEYS (env, read at call time):
 *   GST_CRED_KEY          the current key: 32 bytes as 64 hex characters or base64
 *   GST_CRED_KEY_VERSION  its version, default 1 — what `*_key_version` records
 *   GST_CRED_KEY_V<n>     an older key, only to read values still wrapped under it
 *
 * Each stored value names its own key version (`gcm:v1:…`), so a row half
 * re-wrapped during a rotation still decrypts. The row's `*_key_version` is the
 * version every one of its secrets is under: a write re-wraps the others too
 * (GstSecretWriter), so rotation is "save each row once", not a flag day.
 */
@Injectable()
export class GstCryptoService {
  /** The version a value written now is wrapped under. */
  currentVersion(): number {
    const raw = process.env.GST_CRED_KEY_VERSION?.trim();
    const version = raw ? Number(raw) : 1;
    if (!Number.isInteger(version) || version < 1 || version > 32767) {
      this.throwKeyProblem(`GST_CRED_KEY_VERSION must be a whole number from 1 (is "${raw}")`);
    }
    return version;
  }

  /** Whether a value written now could be wrapped: the key is set. */
  isConfigured(): boolean {
    return Boolean(process.env.GST_CRED_KEY?.trim());
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
      this.throwKeyProblem('A stored GST secret is not in the gcm:v<n>:… form this server writes');
    }
    const [, version, iv, tag, body] = match;
    const decipher = createDecipheriv(
      ALGORITHM,
      this.keyFor(Number(version)),
      Buffer.from(iv, 'base64'),
      { authTagLength: TAG_BYTES },
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    try {
      return Buffer.concat([
        decipher.update(Buffer.from(body, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      this.throwKeyProblem(
        `A stored GST secret does not open with key v${version}: the key changed without its version`,
      );
    }
  }

  /** The key version a stored value names, or null for a value not in our envelope. */
  versionOf(stored: string): number | null {
    const match = ENVELOPE.exec(stored);
    return match ? Number(match[1]) : null;
  }

  private keyFor(version: number): Buffer {
    const name = version === this.currentVersion() ? 'GST_CRED_KEY' : `GST_CRED_KEY_V${version}`;
    const raw = process.env[name]?.trim();
    if (!raw) {
      this.throwKeyProblem(
        name === 'GST_CRED_KEY'
          ? 'GST_CRED_KEY is not set on this server, so no GST secret can be stored or read'
          : `${name} is not set: a stored GST secret is wrapped under key v${version}`,
      );
    }
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      this.throwKeyProblem(`${name} must be 32 bytes, as 64 hex characters or base64`);
    }
    return key;
  }

  /** 503: the server is not configured for secrets; nothing the caller sent was wrong. */
  private throwKeyProblem(message: string): never {
    throw new HttpException(
      buildSettingsErrorResponse('GST credential key unavailable', [
        { field: 'GST_CRED_KEY', message, code: GST_CODES.CRED_KEY_MISSING },
      ]),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
