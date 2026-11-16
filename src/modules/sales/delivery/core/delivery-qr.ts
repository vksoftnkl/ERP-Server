/**
 * Decision 51 — the godown QR: computed, never stored (no column, no UNIQUE,
 * so it cannot clash between sites).
 *
 *   NXB1-<26 base32 of the bill's sb_id>-<yyyy>-<2 check>   a bill
 *   NXD1-<26 base32 of the note's sdn_id>-<yyyy>-<2 check>  a gate pass
 *
 * `yyyy` is the accounting year shortened ("2026-2027" → "2627"). Every
 * character is in the QR alphanumeric set (Crockford base32 upper case, digits
 * and '-'), so the code prints as a dense alphanumeric QR. It holds no price
 * and no name. The printed caption is the last 12 characters.
 */
export type DeliveryQrKind = 'BILL' | 'NOTE';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I L O U
const PREFIX: Record<DeliveryQrKind, string> = { BILL: 'NXB1', NOTE: 'NXD1' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACC_YEAR = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/;
const TOKEN = /^(NXB1|NXD1)-([0-9A-HJKMNP-TV-Z]{26})-(\d{4})-([0-9A-HJKMNP-TV-Z]{2})$/;

export interface DeliveryQr {
  kind: DeliveryQrKind;
  id: string;
  accYear: string;
}

/** The token of a bill / note. Throws on a malformed id or year (a programming error). */
export function encodeDeliveryQr(kind: DeliveryQrKind, id: string, accYear: string): string {
  if (!UUID.test(id)) {
    throw new Error(`encodeDeliveryQr: not a uuid: ${id}`);
  }
  const y = ACC_YEAR.exec(accYear.trim());
  if (!y) {
    throw new Error(`encodeDeliveryQr: not an accounting year: ${accYear}`);
  }
  const body = `${PREFIX[kind]}-${base32(id)}-${y[2]}${y[4]}`;
  return `${body}-${check(body)}`;
}

/** The printed caption: the last 12 characters of the token. */
export function deliveryQrCaption(token: string): string {
  return token.slice(-12);
}

/**
 * The bill / note a token names, or null when it is not a well-formed token
 * or its check characters do not match (a misread scan). The year's century
 * is taken from the id's own era: "2627" → "2026-2027".
 */
export function decodeDeliveryQr(raw: string): DeliveryQr | null {
  const token = (raw ?? '').trim().toUpperCase();
  const m = TOKEN.exec(token);
  if (!m) {
    return null;
  }
  const body = token.slice(0, token.length - 3);
  if (check(body) !== m[4]) {
    return null;
  }
  const id = fromBase32(m[2]);
  if (!id) {
    return null;
  }
  const a = Number(m[3].slice(0, 2));
  const b = Number(m[3].slice(2));
  if ((a + 1) % 100 !== b) {
    return null;
  }
  return {
    kind: m[1] === 'NXB1' ? 'BILL' : 'NOTE',
    id,
    accYear: `20${m[3].slice(0, 2)}-${b === 0 ? '21' : '20'}${m[3].slice(2)}`,
  };
}

/** Does the string look like one of our tokens (prefix only)? */
export function looksLikeDeliveryQr(raw: string): boolean {
  return /^NX[BD]1-/i.test((raw ?? '').trim());
}

function base32(uuid: string): string {
  let n = BigInt(`0x${uuid.replace(/-/g, '')}`);
  let out = '';
  for (let i = 0; i < 26; i++) {
    out = ALPHABET[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return out;
}

function fromBase32(s: string): string | null {
  let n = 0n;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) {
      return null;
    }
    n = (n << 5n) | BigInt(v);
  }
  if (n >> 128n !== 0n) {
    return null;
  }
  const hex = n.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Two base32 check characters over the body (position-weighted, mod 1024). */
function check(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum = (sum + (i + 1) * body.charCodeAt(i)) % 1024;
  }
  return ALPHABET[(sum >> 5) & 31] + ALPHABET[sum & 31];
}
