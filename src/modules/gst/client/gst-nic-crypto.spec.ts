import {
  constants,
  createCipheriv,
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import {
  appKeyBytes,
  decryptSek,
  encryptAuthPayload,
  loadPublicKey,
  publicKeyDir,
} from './gst-nic-crypto';

/** A throwaway self-signed certificate (CN=test-irp-public-key) and the key it certifies. */
const IRP_CERT = `-----BEGIN CERTIFICATE-----
MIIDHzCCAgegAwIBAgIUFFNiVbQjsos6o8DgTMEtNJvnW9UwDQYJKoZIhvcNAQEL
BQAwHjEcMBoGA1UEAwwTdGVzdC1pcnAtcHVibGljLWtleTAgFw0yNjEwMjEwNjQ1
NDZaGA8yMTI2MDkyNzA2NDU0NlowHjEcMBoGA1UEAwwTdGVzdC1pcnAtcHVibGlj
LWtleTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL5YiNkotaQ2OqyY
fZIeizdEGQjMkbAc7lGaZwzFYIfBKO0Ih0L8qSfoG/z6wHjU3C00LQwyLwV81QbY
VjHNhE2Ji2fcLn79FokY+1urSxfpxwT7N8pemdoAYVSjzsAnp47NjSgs+s81psH4
YgvzmrRPAsTyHPUf1Gctu0EklWALWhdcfS5hjF3mn4tppqGbe79/Ydz0TGfWoIBE
qYL1WzzvPi+5u0HJi48jMSoj26OtnCExFogb/6MRDNhH05l3HDw7X5WOh3EY3LDT
3spZ0RVnPB1TUKOovGJI4KGEzSeeFi/mTXwn3l85AYXtjnsB75EToyUY279qL81K
Rboek68CAwEAAaNTMFEwHQYDVR0OBBYEFJqDuDDB2ec1bT/ROVNDtw0fKJ52MB8G
A1UdIwQYMBaAFJqDuDDB2ec1bT/ROVNDtw0fKJ52MA8GA1UdEwEB/wQFMAMBAf8w
DQYJKoZIhvcNAQELBQADggEBAClxCV8sM7+26LCIQQ0JVjQsT379h2tjNoe5qYfT
8nXIHOqJ3r2p56qV9cPMqHYaC/5spyUenSnJfTTHu2/CU9/cOoov+IiG+G1ibfRA
05Qe6exabRXr+z6h3xlGGzQdQH5J7Sg74x+B1Hm54tdcqeHC3LnZAY2AseuS9Bzn
yxZHCjzLvt/f2zA3+HzILo13RChunSM5K19K4S8GDOmzdwqEzSWOPCSU2YGWSyOP
BRyDRHyakrPm0F1tbq9ZwnbhGDdfnJqNoFYmooceNQNDjkPbrv8m9m1RBdB83yvx
2tbBYaN84w7vixA02lc+tckDJEOD0u6+7ULOmivd19qQW2U=
-----END CERTIFICATE-----`;
const IRP_CERT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvliI2Si1pDY6rJh9kh6L
N0QZCMyRsBzuUZpnDMVgh8Eo7QiHQvypJ+gb/PrAeNTcLTQtDDIvBXzVBthWMc2E
TYmLZ9wufv0WiRj7W6tLF+nHBPs3yl6Z2gBhVKPOwCenjs2NKCz6zzWmwfhiC/Oa
tE8CxPIc9R/UZy27QSSVYAtaF1x9LmGMXeafi2mmoZt7v39h3PRMZ9aggESpgvVb
PO8+L7m7QcmLjyMxKiPbo62cITEWiBv/oxEM2EfTmXccPDtflY6HcRjcsNPeylnR
FWc8HVNQo6i8YkjgoYTNJ54WL+ZNfCfeXzkBhe2OewHvkROjJRjbv2ovzUpFuh6T
rwIDAQAB
-----END PUBLIC KEY-----
`;

const spkiPem = (key: KeyObject) => key.export({ type: 'spki', format: 'pem' }).toString();
const spkiBase64 = (key: KeyObject) =>
  key.export({ type: 'spki', format: 'der' }).toString('base64');

/** What NIC does with the Data field: RSA-open it, then base64-decode the JSON. */
const openAuthPayload = (privateKey: KeyObject, data: string): unknown => {
  const base64Json = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(data, 'base64'),
  ).toString('utf8');
  return JSON.parse(Buffer.from(base64Json, 'base64').toString('utf8'));
};

describe('gst-nic-crypto', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const savedDir = process.env.GST_PUBLIC_KEY_DIR;
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'gst-nic-'));
  });
  beforeEach(() => {
    process.env.GST_PUBLIC_KEY_DIR = dir;
  });
  afterEach(() => {
    if (savedDir === undefined) {
      delete process.env.GST_PUBLIC_KEY_DIR;
    } else {
      process.env.GST_PUBLIC_KEY_DIR = savedDir;
    }
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // ── publicKeyDir ──────────────────────────────────────────────────────────
  describe('publicKeyDir', () => {
    it('reads GST_PUBLIC_KEY_DIR, trimmed', () => {
      process.env.GST_PUBLIC_KEY_DIR = `  ${dir}  `;

      expect(publicKeyDir()).toBe(dir);
    });

    it.each([
      ['unset', undefined],
      ['blank', '   '],
    ])('falls back to ./certs/gst under the working directory when it is %s', (_label, value) => {
      if (value === undefined) {
        delete process.env.GST_PUBLIC_KEY_DIR;
      } else {
        process.env.GST_PUBLIC_KEY_DIR = value;
      }

      expect(publicKeyDir()).toBe(path.join(process.cwd(), 'certs', 'gst'));
    });
  });

  // ── loadPublicKey ─────────────────────────────────────────────────────────
  describe('loadPublicKey', () => {
    it('loads the PEM public key a bare ref names, from <ref>.pem', async () => {
      await writeFile(path.join(dir, 'irp-sandbox.pem'), spkiPem(publicKey));

      const key = await loadPublicKey('irp-sandbox');

      expect(key && spkiPem(key)).toBe(spkiPem(publicKey));
    });

    it('reads an X.509 certificate to the key it certifies', async () => {
      await writeFile(path.join(dir, 'irp-cert.pem'), `\n${IRP_CERT}\n`);

      const key = await loadPublicKey('irp-cert');

      expect(key && spkiPem(key)).toBe(IRP_CERT_PUBLIC_KEY);
    });

    it('takes a ref that already ends in .pem or .cer as the file name itself', async () => {
      await writeFile(path.join(dir, 'irp.cer'), IRP_CERT);
      await writeFile(path.join(dir, 'irp-prod.pem'), spkiPem(publicKey));

      const fromCer = await loadPublicKey('irp.cer');
      const fromPem = await loadPublicKey('irp-prod.pem');

      expect(fromCer && spkiPem(fromCer)).toBe(IRP_CERT_PUBLIC_KEY);
      expect(fromPem && spkiPem(fromPem)).toBe(spkiPem(publicKey));
    });

    it.each([
      ['on one line', (body: string) => body],
      ['wrapped and indented', (body: string) => `  ${body.replace(/(.{40})/g, '$1\n  ')}\n`],
    ])('reads the bare base64 body NIC publishes, %s', async (_label, layout) => {
      await writeFile(path.join(dir, 'nic-body.pem'), layout(spkiBase64(publicKey)));

      const key = await loadPublicKey('nic-body');

      expect(key && spkiPem(key)).toBe(spkiPem(publicKey));
    });

    it('answers null when the ref names no file', async () => {
      await expect(loadPublicKey('not-on-this-server')).resolves.toBeNull();
    });

    it.each([
      ['climbs out of the key directory', '../outside'],
      ['names a sub-directory', 'keys/irp'],
      ['is an absolute path', '/etc/irp'],
      ['holds a double dot', 'evil..pem'],
      ['holds a space', 'irp key'],
      ['is empty', ''],
    ])('answers null for a ref that %s, without reading anything', async (_label, ref) => {
      // A real key sits behind the dotted name: the ref is refused, not merely missing.
      await writeFile(path.join(dir, 'evil..pem'), spkiPem(publicKey));

      await expect(loadPublicKey(ref)).resolves.toBeNull();
    });
  });

  // ── encryptAuthPayload ────────────────────────────────────────────────────
  describe('encryptAuthPayload', () => {
    const payload = {
      UserName: 'API_ZETA',
      Password: 'p@ss',
      AppKey: randomBytes(32).toString('base64'),
      ForceRefreshAccessToken: true,
    };

    it('RSA-wraps base64(JSON) so the private key holder reads the payload back', () => {
      const data = encryptAuthPayload(publicKey, payload);

      expect(Buffer.from(data, 'base64')).toHaveLength(256);
      expect(openAuthPayload(privateKey, data)).toEqual(payload);
    });

    it('pads at random: the same payload never encrypts the same way twice', () => {
      expect(encryptAuthPayload(publicKey, payload)).not.toBe(
        encryptAuthPayload(publicKey, payload),
      );
    });

    it('encrypts under a key loaded from the key directory', async () => {
      await writeFile(path.join(dir, 'roundtrip.pem'), spkiBase64(publicKey));
      const key = await loadPublicKey('roundtrip');

      expect(openAuthPayload(privateKey, encryptAuthPayload(key!, payload))).toEqual(payload);
    });
  });

  // ── decryptSek / appKeyBytes edges ────────────────────────────────────────
  describe('decryptSek', () => {
    it('answers null, not a throw, for an AppKey of the wrong length', () => {
      expect(decryptSek(randomBytes(32).toString('base64'), randomBytes(16))).toBeNull();
    });

    it('answers null for a Sek that is not whole AES blocks', () => {
      expect(decryptSek(randomBytes(20).toString('base64'), randomBytes(32))).toBeNull();
    });

    it('opens a Sek NIC wrapped around a 32-byte session key', () => {
      const appKey = randomBytes(32);
      const sessionKey = randomBytes(32);
      const cipher = createCipheriv('aes-256-ecb', appKey, null);
      const sek = Buffer.concat([cipher.update(sessionKey), cipher.final()]).toString('base64');

      expect(decryptSek(sek, appKey)).toEqual(sessionKey);
    });
  });

  describe('appKeyBytes', () => {
    it('answers null for an empty AppKey, so the caller mints a fresh one', () => {
      expect(appKeyBytes('')).toBeNull();
    });

    it('takes base64 only in its canonical form; anything else must be 32 plain bytes', () => {
      const raw = randomBytes(32);
      // base64url decodes to the same 32 bytes but is not what we stored.
      expect(appKeyBytes(raw.toString('base64url'))).toBeNull();
      // 32 characters that also happen to be valid base64 (of 24 bytes) are plain text.
      const plain = 'abcdefghijklmnopqrstuvwxyz012345';
      expect(appKeyBytes(plain)?.toString('utf8')).toBe(plain);
    });

    it('counts plain AppKeys in bytes, not characters', () => {
      expect(appKeyBytes('é'.repeat(16))).toHaveLength(32);
      expect(appKeyBytes('é'.repeat(32))).toBeNull();
    });
  });
});
