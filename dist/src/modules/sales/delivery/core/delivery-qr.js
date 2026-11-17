"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeDeliveryQr = encodeDeliveryQr;
exports.deliveryQrCaption = deliveryQrCaption;
exports.decodeDeliveryQr = decodeDeliveryQr;
exports.looksLikeDeliveryQr = looksLikeDeliveryQr;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = { BILL: 'NXB1', NOTE: 'NXD1' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACC_YEAR = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/;
const TOKEN = /^(NXB1|NXD1)-([0-9A-HJKMNP-TV-Z]{26})-(\d{4})-([0-9A-HJKMNP-TV-Z]{2})$/;
function encodeDeliveryQr(kind, id, accYear) {
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
function deliveryQrCaption(token) {
    return token.slice(-12);
}
function decodeDeliveryQr(raw) {
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
function looksLikeDeliveryQr(raw) {
    return /^NX[BD]1-/i.test((raw ?? '').trim());
}
function base32(uuid) {
    let n = BigInt(`0x${uuid.replace(/-/g, '')}`);
    let out = '';
    for (let i = 0; i < 26; i++) {
        out = ALPHABET[Number(n & 31n)] + out;
        n >>= 5n;
    }
    return out;
}
function fromBase32(s) {
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
function check(body) {
    let sum = 0;
    for (let i = 0; i < body.length; i++) {
        sum = (sum + (i + 1) * body.charCodeAt(i)) % 1024;
    }
    return ALPHABET[(sum >> 5) & 31] + ALPHABET[sum & 31];
}
//# sourceMappingURL=delivery-qr.js.map