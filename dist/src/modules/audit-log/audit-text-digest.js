"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stylesheetDigest = stylesheetDigest;
const node_crypto_1 = require("node:crypto");
function stylesheetDigest(text) {
    return {
        stylesheetHash: (0, node_crypto_1.createHash)('sha256').update(text, 'utf8').digest('hex'),
        stylesheetSize: Buffer.byteLength(text, 'utf8'),
        stylesheetLines: text.length === 0 ? 0 : text.split('\n').length,
    };
}
//# sourceMappingURL=audit-text-digest.js.map