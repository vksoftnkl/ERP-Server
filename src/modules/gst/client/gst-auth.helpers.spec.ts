import { getPath, parsePath, redactPaths, REDACTED } from './gst-json-path';
import { istAccYear, parseProviderDateTime } from './gst-auth.service';
import { appKeyBytes, decryptSek } from './gst-nic-crypto';
import { createCipheriv, randomBytes } from 'node:crypto';

describe('gst-json-path', () => {
  const reply = {
    Status: 1,
    Data: { AuthToken: 'tok', Sek: 'sek', 'odd key': 'x' },
    ErrorDetails: [{ ErrorCode: '1005', ErrorMessage: 'Invalid Token' }],
  };

  it('reads the subset the rows use', () => {
    expect(getPath(reply, '$.Status')).toBe(1);
    expect(getPath(reply, '$.Data.AuthToken')).toBe('tok');
    expect(getPath(reply, '$.ErrorDetails[0].ErrorCode')).toBe('1005');
    expect(getPath(reply, "$.Data['odd key']")).toBe('x');
    expect(getPath(reply, '$')).toBe(reply);
    expect(getPath(reply, '$.Missing.Deeper')).toBeUndefined();
    expect(getPath(null, '$.Data')).toBeUndefined();
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(() => parsePath('Data.AuthToken')).toThrow('must start with $');
    expect(() => parsePath('$.Data[*]')).toThrow('Unsupported');
  });

  it('redacts a copy, path by path, and leaves the original alone', () => {
    const out = redactPaths(reply, ['$.Data.AuthToken', '$.Data.Sek', '$.Nowhere']) as typeof reply;
    expect(out.Data.AuthToken).toBe(REDACTED);
    expect(out.Data.Sek).toBe(REDACTED);
    expect(out.Status).toBe(1);
    expect(reply.Data.AuthToken).toBe('tok');
    expect(redactPaths(reply, ['$.Data'])).toEqual({ ...reply, Data: REDACTED });
  });

  it('blanks the whole value when a redact path is unreadable — never logs a secret by accident', () => {
    expect(redactPaths(reply, ['$..AuthToken'])).toBe(REDACTED);
  });
});

describe('parseProviderDateTime', () => {
  it("reads NIC's IST TokenExpiry with no zone", () => {
    expect(parseProviderDateTime('2026-10-02 18:30:00', 'DATETIME_NIC')?.toISOString()).toBe(
      '2026-10-02T13:00:00.000Z',
    );
  });

  it('reads dd/MM/yyyy with AM / PM', () => {
    expect(parseProviderDateTime('16/09/2017 10:30:00 PM', 'DATETIME_NIC')?.toISOString()).toBe(
      '2017-09-16T17:00:00.000Z',
    );
    expect(parseProviderDateTime('16/09/2017 12:05:00 AM', 'NONE')?.toISOString()).toBe(
      '2017-09-15T18:35:00.000Z',
    );
  });

  it('reads epoch milliseconds and ISO, and gives up on nonsense', () => {
    expect(parseProviderDateTime('1759400000000', 'EPOCH_MS')?.getTime()).toBe(1759400000000);
    expect(parseProviderDateTime('2026-10-02T10:00:00Z', 'NONE')?.toISOString()).toBe(
      '2026-10-02T10:00:00.000Z',
    );
    expect(parseProviderDateTime('soon', 'NONE')).toBeNull();
  });
});

describe('istAccYear', () => {
  it('splits the year on 1 April, in IST', () => {
    expect(istAccYear(new Date('2026-10-02T10:00:00Z'))).toBe('2026-2027');
    expect(istAccYear(new Date('2027-03-31T18:00:00Z'))).toBe('2026-2027');
    // 31 Mar 19:00 UTC is already 1 April in India.
    expect(istAccYear(new Date('2027-03-31T19:00:00Z'))).toBe('2027-2028');
  });
});

describe('NIC crypto helpers', () => {
  it('opens a Sek with the AppKey it was wrapped with, and only that one', () => {
    const appKey = randomBytes(32);
    const sessionKey = randomBytes(32);
    const cipher = createCipheriv('aes-256-ecb', appKey, null);
    const sek = Buffer.concat([cipher.update(sessionKey), cipher.final()]).toString('base64');
    expect(decryptSek(sek, appKey)?.equals(sessionKey)).toBe(true);
    expect(decryptSek(sek, randomBytes(32))).toBeNull();
  });

  it('takes an AppKey as base64 of 32 bytes or as 32 characters', () => {
    const raw = randomBytes(32);
    expect(appKeyBytes(raw.toString('base64'))?.equals(raw)).toBe(true);
    expect(appKeyBytes('a'.repeat(32))?.toString()).toBe('a'.repeat(32));
    expect(appKeyBytes('short')).toBeNull();
    expect(appKeyBytes(null)).toBeNull();
  });
});
