"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GstCryptoService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const gst_config_constants_1 = require("./gst-config.constants");
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENVELOPE = /^gcm:v(\d+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)$/;
let GstCryptoService = class GstCryptoService {
    currentVersion() {
        const raw = process.env.GST_CRED_KEY_VERSION?.trim();
        const version = raw ? Number(raw) : 1;
        if (!Number.isInteger(version) || version < 1 || version > 32767) {
            this.throwKeyProblem(`GST_CRED_KEY_VERSION must be a whole number from 1 (is "${raw}")`);
        }
        return version;
    }
    isConfigured() {
        return Boolean(process.env.GST_CRED_KEY?.trim());
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
            this.throwKeyProblem('A stored GST secret is not in the gcm:v<n>:… form this server writes');
        }
        const [, version, iv, tag, body] = match;
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, this.keyFor(Number(version)), Buffer.from(iv, 'base64'), { authTagLength: TAG_BYTES });
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        try {
            return Buffer.concat([
                decipher.update(Buffer.from(body, 'base64')),
                decipher.final(),
            ]).toString('utf8');
        }
        catch {
            this.throwKeyProblem(`A stored GST secret does not open with key v${version}: the key changed without its version`);
        }
    }
    versionOf(stored) {
        const match = ENVELOPE.exec(stored);
        return match ? Number(match[1]) : null;
    }
    keyFor(version) {
        const name = version === this.currentVersion() ? 'GST_CRED_KEY' : `GST_CRED_KEY_V${version}`;
        const raw = process.env[name]?.trim();
        if (!raw) {
            this.throwKeyProblem(name === 'GST_CRED_KEY'
                ? 'GST_CRED_KEY is not set on this server, so no GST secret can be stored or read'
                : `${name} is not set: a stored GST secret is wrapped under key v${version}`);
        }
        const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
        if (key.length !== 32) {
            this.throwKeyProblem(`${name} must be 32 bytes, as 64 hex characters or base64`);
        }
        return key;
    }
    throwKeyProblem(message) {
        throw new common_1.HttpException((0, module_service_utils_1.buildSettingsErrorResponse)('GST credential key unavailable', [
            { field: 'GST_CRED_KEY', message, code: gst_config_constants_1.GST_CODES.CRED_KEY_MISSING },
        ]), common_1.HttpStatus.SERVICE_UNAVAILABLE);
    }
};
exports.GstCryptoService = GstCryptoService;
exports.GstCryptoService = GstCryptoService = __decorate([
    (0, common_1.Injectable)()
], GstCryptoService);
//# sourceMappingURL=gst-crypto.service.js.map