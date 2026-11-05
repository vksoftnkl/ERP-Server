"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicKeyDir = publicKeyDir;
exports.loadPublicKey = loadPublicKey;
exports.encryptAuthPayload = encryptAuthPayload;
exports.decryptSek = decryptSek;
exports.appKeyBytes = appKeyBytes;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const path = require("node:path");
function publicKeyDir() {
    return process.env.GST_PUBLIC_KEY_DIR?.trim() || path.join(process.cwd(), 'certs', 'gst');
}
async function loadPublicKey(ref) {
    if (!/^[A-Za-z0-9._-]+$/.test(ref) || ref.includes('..')) {
        return null;
    }
    const file = path.join(publicKeyDir(), ref.endsWith('.pem') || ref.endsWith('.cer') ? ref : `${ref}.pem`);
    let text;
    try {
        text = (await (0, promises_1.readFile)(file, 'utf8')).trim();
    }
    catch {
        return null;
    }
    if (text.includes('BEGIN CERTIFICATE')) {
        return new node_crypto_1.X509Certificate(text).publicKey;
    }
    if (!text.includes('-----BEGIN')) {
        const body = text.replace(/\s+/g, '').replace(/(.{64})/g, '$1\n');
        text = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
    }
    return (0, node_crypto_1.createPublicKey)(text);
}
function encryptAuthPayload(key, payload) {
    const base64Json = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    return (0, node_crypto_1.publicEncrypt)({ key, padding: node_crypto_1.constants.RSA_PKCS1_PADDING }, Buffer.from(base64Json, 'utf8')).toString('base64');
}
function decryptSek(sek, appKey) {
    try {
        const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-ecb', appKey, null);
        return Buffer.concat([decipher.update(Buffer.from(sek, 'base64')), decipher.final()]);
    }
    catch {
        return null;
    }
}
function appKeyBytes(stored) {
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
//# sourceMappingURL=gst-nic-crypto.js.map