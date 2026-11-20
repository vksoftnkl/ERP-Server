"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaCryptoService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const wa_errors_1 = require("./wa-errors");
const wa_constants_1 = require("./wa.constants");
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENVELOPE = /^gcm:v(\d+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)$/;
let WaCryptoService = class WaCryptoService {
    currentVersion() {
        const raw = process.env.WA_CRED_KEY_VERSION?.trim();
        const version = raw ? Number(raw) : 1;
        if (!Number.isInteger(version) || version < 1 || version > 32767) {
            this.keyProblem(`WA_CRED_KEY_VERSION must be a whole number from 1 (is "${raw}")`);
        }
        return version;
    }
    isConfigured() {
        const raw = process.env.WA_CRED_KEY?.trim();
        return Boolean(raw) && raw !== 'CHANGE_ME';
    }
    encrypt(plain) {
        const version = this.currentVersion();
        const key = this.keyFor(version);
        const iv = (0, node_crypto_1.randomBytes)(IV_BYTES);
        const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
        const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        return [
            'gcm',
            `v${version}`,
            iv.toString('base64'),
            cipher.getAuthTag().toString('base64'),
            body.toString('base64'),
        ].join(':');
    }
    decrypt(stored) {
        const match = ENVELOPE.exec(stored);
        if (!match) {
            this.keyProblem('The stored WhatsApp key is not in the gcm:v<n>:… form this server writes');
        }
        const [, version, iv, tag, body] = match;
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, this.keyFor(Number(version)), Buffer.from(iv, 'base64'), {
            authTagLength: TAG_BYTES,
        });
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        try {
            return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
        }
        catch {
            this.keyProblem(`The stored WhatsApp key does not open with WA_CRED_KEY v${version}: the key changed without its version`);
        }
    }
    keyFor(version) {
        const name = version === this.currentVersion() ? 'WA_CRED_KEY' : `WA_CRED_KEY_V${version}`;
        const raw = process.env[name]?.trim();
        if (!raw || raw === 'CHANGE_ME') {
            this.keyProblem(name === 'WA_CRED_KEY'
                ? 'WA_CRED_KEY is not set on this server, so the WhatsApp key cannot be stored or read'
                : `${name} is not set: the stored WhatsApp key is wrapped under key v${version}`);
        }
        const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
        if (key.length !== 32) {
            this.keyProblem(`${name} must be 32 bytes, as 64 hex characters or base64`);
        }
        return key;
    }
    keyProblem(message) {
        (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.KEY_MISSING, message, 'WA_CRED_KEY');
    }
};
exports.WaCryptoService = WaCryptoService;
exports.WaCryptoService = WaCryptoService = __decorate([
    (0, common_1.Injectable)()
], WaCryptoService);
//# sourceMappingURL=wa-crypto.service.js.map