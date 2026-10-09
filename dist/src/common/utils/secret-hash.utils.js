"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashSecret = hashSecret;
exports.verifySecret = verifySecret;
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const SECRET_SALT_BYTES = 16;
const SECRET_KEY_LENGTH = 64;
const scryptAsync = (0, node_util_1.promisify)(node_crypto_1.scrypt);
async function hashSecret(plain) {
    const salt = (0, node_crypto_1.randomBytes)(SECRET_SALT_BYTES).toString('hex');
    const derived = (await scryptAsync(plain, salt, SECRET_KEY_LENGTH));
    return `scrypt$${salt}$${derived.toString('hex')}`;
}
async function verifySecret(plain, stored) {
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
        const computed = (await scryptAsync(plain, salt, storedHash.length));
        return computed.length === storedHash.length && (0, node_crypto_1.timingSafeEqual)(computed, storedHash);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=secret-hash.utils.js.map