import {
  constants,
  createDecipheriv,
  createPublicKey,
  publicEncrypt,
  X509Certificate,
  type KeyObject,
} from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

/**
 * NIC's own auth scheme (NIC_SEK with gps_payload_encryption AES_SEK / RSA —
 * we encrypt, not the GSP). Code, not rows, by decision G1: the scheme is the
 * government's and does not vary by provider.
 *
 *   request  {"Data": base64(RSA-PKCS#1(base64(JSON{UserName, Password, AppKey, ForceRefreshAccessToken})))}
 *            with the IRP public key named by gcc_public_key_ref;
 *   reply    Data.Sek = base64(AES-256-ECB(session key, AppKey)) — the key every
 *            later payload is encrypted with.
 */

/** Where `<gcc_public_key_ref>.pem` files live: GST_PUBLIC_KEY_DIR, else ./certs/gst. */
export function publicKeyDir(): string {
  return process.env.GST_PUBLIC_KEY_DIR?.trim() || path.join(process.cwd(), 'certs', 'gst');
}

/**
 * The key a ref names, or null when there is no such file. Accepts a PEM
 * public key, an X.509 certificate, or the bare base64 body NIC publishes.
 */
export async function loadPublicKey(ref: string): Promise<KeyObject | null> {
  if (!/^[A-Za-z0-9._-]+$/.test(ref) || ref.includes('..')) {
    return null;
  }
  const file = path.join(
    publicKeyDir(),
    ref.endsWith('.pem') || ref.endsWith('.cer') ? ref : `${ref}.pem`,
  );
  let text: string;
  try {
    text = (await readFile(file, 'utf8')).trim();
  } catch {
    return null;
  }
  if (text.includes('BEGIN CERTIFICATE')) {
    return new X509Certificate(text).publicKey;
  }
  if (!text.includes('-----BEGIN')) {
    const body = text.replace(/\s+/g, '').replace(/(.{64})/g, '$1\n');
    text = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
  }
  return createPublicKey(text);
}

export function encryptAuthPayload(key: KeyObject, payload: object): string {
  const base64Json = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return publicEncrypt(
    { key, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(base64Json, 'utf8'),
  ).toString('base64');
}

/** The session key out of a Sek, or null when it does not open with this AppKey. */
export function decryptSek(sek: string, appKey: Buffer): Buffer | null {
  try {
    const decipher = createDecipheriv('aes-256-ecb', appKey, null);
    return Buffer.concat([decipher.update(Buffer.from(sek, 'base64')), decipher.final()]);
  } catch {
    return null;
  }
}

/**
 * The AppKey as bytes: the stored one (base64 of 32 bytes, or 32 plain
 * characters) when the credential has one, else null — the caller then mints
 * a fresh one for this sign-in, as NIC recommends.
 */
export function appKeyBytes(stored: string | null): Buffer | null {
  if (!stored) {
    return null;
  }
  const decoded = Buffer.from(stored, 'base64');
  if (decoded.length === 32 && decoded.toString('base64') === stored) {
    return decoded;
  }
  const plain = Buffer.from(stored, 'utf8');
  return plain.length === 32 ? plain : null;
}
