import { HttpException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { GstCryptoService } from './gst-crypto.service';
import { GstConfigSupport } from './gst-config.support';

const ENV_KEYS = ['GST_CRED_KEY', 'GST_CRED_KEY_VERSION', 'GST_CRED_KEY_V1'] as const;

describe('GstCryptoService', () => {
  const saved: Record<string, string | undefined> = {};
  const crypto = new GstCryptoService();
  const keyHex = randomBytes(32).toString('hex');

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.GST_CRED_KEY = keyHex;
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const statusOf = (fn: () => unknown): number | undefined => {
    try {
      fn();
    } catch (error) {
      return error instanceof HttpException ? error.getStatus() : -1;
    }
    return undefined;
  };

  it('round-trips, names its key version, and never repeats a ciphertext', () => {
    const a = crypto.encrypt('s3cret pass ');
    const b = crypto.encrypt('s3cret pass ');
    expect(a).toMatch(/^gcm:v1:/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('s3cret');
    expect(crypto.decrypt(a)).toBe('s3cret pass ');
    expect(crypto.versionOf(a)).toBe(1);
  });

  it('accepts the key as base64 too', () => {
    process.env.GST_CRED_KEY = Buffer.from(keyHex, 'hex').toString('base64');
    expect(crypto.decrypt(crypto.encrypt('x'))).toBe('x');
  });

  it('reads a value wrapped under an older key once that key is given as GST_CRED_KEY_V1', () => {
    const old = crypto.encrypt('old secret');
    process.env.GST_CRED_KEY_V1 = keyHex;
    process.env.GST_CRED_KEY = randomBytes(32).toString('hex');
    process.env.GST_CRED_KEY_VERSION = '2';
    expect(crypto.decrypt(old)).toBe('old secret');
    expect(crypto.encrypt('new')).toMatch(/^gcm:v2:/);
    delete process.env.GST_CRED_KEY_V1;
    expect(statusOf(() => crypto.decrypt(old))).toBe(503);
  });

  it('is a 503 without a key, with a short key, or when the key changed under the same version', () => {
    const stored = crypto.encrypt('x');
    process.env.GST_CRED_KEY = randomBytes(32).toString('hex');
    expect(statusOf(() => crypto.decrypt(stored))).toBe(503);
    process.env.GST_CRED_KEY = 'abc';
    expect(statusOf(() => crypto.encrypt('x'))).toBe(503);
    delete process.env.GST_CRED_KEY;
    expect(statusOf(() => crypto.encrypt('x'))).toBe(503);
    expect(crypto.isConfigured()).toBe(false);
  });

  describe('writeSecrets (notes 79 §3)', () => {
    const support = new GstConfigSupport(
      {} as never,
      { getUserId: () => null } as never,
      {} as never,
      crypto,
    );
    const specs = [
      { key: 'clientId', column: 'idEnc' },
      { key: 'clientSecret', column: 'secretEnc' },
      { key: 'apiKey', column: 'apiEnc' },
    ];

    it('absent or "" keeps, a value writes, clear nulls', () => {
      const out = support.writeSecrets({
        specs,
        input: { clientId: 'id-1', clientSecret: '', apiKey: undefined },
        clear: ['apiKey'],
        stored: { idEnc: null, secretEnc: crypto.encrypt('keep me'), apiEnc: crypto.encrypt('k') },
        storedVersion: 1,
      });
      expect(Object.keys(out.data).sort()).toEqual(['apiEnc', 'idEnc']);
      expect(crypto.decrypt(out.data.idEnc!)).toBe('id-1');
      expect(out.data.apiEnc).toBeNull();
      expect(out.written).toEqual(['clientId']);
      expect(out.keyVersion).toBe(1);
    });

    it('re-wraps the row’s other secrets under the current key when one is written', () => {
      process.env.GST_CRED_KEY_V1 = keyHex;
      const underV1 = crypto.encrypt('older');
      process.env.GST_CRED_KEY = randomBytes(32).toString('hex');
      process.env.GST_CRED_KEY_VERSION = '2';
      const out = support.writeSecrets({
        specs,
        input: { clientId: 'fresh' },
        clear: [],
        stored: { idEnc: null, secretEnc: underV1, apiEnc: null },
        storedVersion: 1,
      });
      expect(out.keyVersion).toBe(2);
      expect(crypto.versionOf(out.data.secretEnc!)).toBe(2);
      expect(crypto.decrypt(out.data.secretEnc!)).toBe('older');
    });

    it('refuses a key both given and cleared', () => {
      expect(
        statusOf(() =>
          support.writeSecrets({
            specs,
            input: { apiKey: 'x' },
            clear: ['apiKey'],
            stored: null,
            storedVersion: null,
          }),
        ),
      ).toBe(400);
    });

    it('writes nothing and keeps the version when no secret is sent', () => {
      const out = support.writeSecrets({
        specs,
        input: {},
        clear: undefined,
        stored: null,
        storedVersion: null,
      });
      expect(out).toEqual({ data: {}, keyVersion: 1, written: [] });
    });
  });
});
