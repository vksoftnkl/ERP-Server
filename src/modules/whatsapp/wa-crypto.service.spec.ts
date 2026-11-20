import { HttpException } from '@nestjs/common';
import { WaCryptoService } from './wa-crypto.service';

describe('WaCryptoService (WA_CRED_KEY, the gcm:v<n>: envelope)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  it('wraps and opens the install key; the stored form never holds it', () => {
    process.env.WA_CRED_KEY = 'a'.repeat(64);
    process.env.WA_CRED_KEY_VERSION = '1';
    const c = new WaCryptoService();
    const enc = c.encrypt('Um7La5I1-the-relay-key');
    expect(enc.startsWith('gcm:v1:')).toBe(true);
    expect(enc).not.toContain('Um7La5I1');
    expect(c.decrypt(enc)).toBe('Um7La5I1-the-relay-key');
  });
  it('no key → 503 WA_KEY_MISSING; CHANGE_ME counts as no key', () => {
    process.env.WA_CRED_KEY = 'CHANGE_ME';
    const c = new WaCryptoService();
    expect(c.isConfigured()).toBe(false);
    try {
      c.encrypt('x');
      fail('should refuse');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(503);
      expect(JSON.stringify((e as HttpException).getResponse())).toContain('WA_KEY_MISSING');
    }
  });
});
