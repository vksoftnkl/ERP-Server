import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// One format for every secret a user holds: the login password (usr_password_hash) and the
// till PIN (usr_pin_hash, notes 95). `scrypt$<salt-hex>$<derived-hex>`, a random 16-byte
// salt and a 64-byte key — the format AuthService.verifyPassword already reads, so a hash
// written here is checked there unchanged.
const SECRET_SALT_BYTES = 16;
const SECRET_KEY_LENGTH = 64;

const scryptAsync = promisify(nodeScrypt);

export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(SECRET_SALT_BYTES).toString('hex');
  const derived = (await scryptAsync(plain, salt, SECRET_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

// Constant-time; a malformed or foreign-format hash is a plain mismatch, never a throw.
export async function verifySecret(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    return false;
  }
  try {
    const [algorithm, salt, hashHex] = stored.split('$');
    if (algorithm !== 'scrypt' || !salt || !hashHex) {
      return false;
    }
    const storedHash = Buffer.from(hashHex, 'hex');
    if (storedHash.length === 0) {
      return false;
    }
    const computed = (await scryptAsync(plain, salt, storedHash.length)) as Buffer;
    return computed.length === storedHash.length && timingSafeEqual(computed, storedHash);
  } catch {
    return false;
  }
}
