"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaRelayClient = void 0;
exports.mapRelayFailure = mapRelayFailure;
const common_1 = require("@nestjs/common");
const wa_errors_1 = require("./wa-errors");
const wa_constants_1 = require("./wa.constants");
let WaRelayClient = class WaRelayClient {
    fetchFn = (...args) => fetch(...args);
    configuredUrl() {
        const raw = process.env.WA_RELAY_URL?.trim();
        return raw ? raw.replace(/\/+$/, '') : null;
    }
    async activate(baseUrl, body) {
        return this.json(baseUrl, 'POST', '/v1/activate', null, body);
    }
    async connection(baseUrl, key) {
        return this.json(baseUrl, 'GET', '/v1/connection', key);
    }
    async connectCode(baseUrl, key, body) {
        return this.json(baseUrl, 'POST', '/v1/connect-codes', key, body);
    }
    async events(baseUrl, key, after, limit = 200) {
        return this.json(baseUrl, 'GET', `/v1/events?after=${after.toString()}&limit=${limit}`, key);
    }
    async ack(baseUrl, key, upTo) {
        return this.json(baseUrl, 'POST', '/v1/events/ack', key, { upTo });
    }
    async rotate(baseUrl, key) {
        return this.json(baseUrl, 'POST', '/v1/keys/rotate', key);
    }
    async disconnect(baseUrl, key, body) {
        return this.json(baseUrl, 'POST', '/v1/disconnect', key, body);
    }
    async send(baseUrl, key, meta, pdf) {
        const form = new FormData();
        form.append('meta', JSON.stringify(meta));
        if (pdf) {
            form.append('document', new Blob([new Uint8Array(pdf.bytes)], { type: 'application/pdf' }), pdf.filename);
        }
        return this.request(baseUrl, 'POST', '/v1/messages', key, form, wa_constants_1.WA_RELAY_SEND_TIMEOUT_MS);
    }
    async healthy(baseUrl) {
        try {
            const data = await this.request(baseUrl, 'GET', '/health', null, undefined, wa_constants_1.WA_HEALTH_TIMEOUT_MS);
            return data?.ok === true;
        }
        catch {
            return false;
        }
    }
    json(baseUrl, method, path, key, body) {
        return this.request(baseUrl, method, path, key, body === undefined ? undefined : JSON.stringify(body), wa_constants_1.WA_RELAY_TIMEOUT_MS);
    }
    async request(baseUrl, method, path, key, body, timeoutMs) {
        const headers = { Accept: 'application/json' };
        if (key) {
            headers.Authorization = `Bearer ${key}`;
        }
        if (typeof body === 'string') {
            headers['Content-Type'] = 'application/json';
        }
        const version = (process.env.APP_VERSION ?? '').trim();
        if (version) {
            headers['X-ERP-Version'] = version.slice(0, 40);
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let res;
        try {
            res = await this.fetchFn(`${baseUrl}${path}`, {
                method,
                headers,
                body: method === 'POST' ? (body ?? '{}') : undefined,
                signal: controller.signal,
            });
        }
        catch (error) {
            const why = controller.signal.aborted ? `no answer in ${timeoutMs / 1000} s` : errorText(error);
            throw new wa_errors_1.WaRelayError(wa_constants_1.WA_CODES.RELAY_UNREACHABLE, `The WhatsApp service could not be reached: ${why}`, {
                httpStatus: null,
                relayCode: null,
            });
        }
        finally {
            clearTimeout(timer);
        }
        let parsed = null;
        const text = await res.text().catch(() => '');
        try {
            parsed = text ? JSON.parse(text) : null;
        }
        catch {
            parsed = null;
        }
        const env = (parsed ?? {});
        if (res.ok && env.success === true) {
            return env.data;
        }
        throw mapRelayFailure(res.status, parsed, text);
    }
};
exports.WaRelayClient = WaRelayClient;
exports.WaRelayClient = WaRelayClient = __decorate([
    (0, common_1.Injectable)()
], WaRelayClient);
function errorText(error) {
    const e = error;
    return (e?.cause?.code ?? e?.cause?.message ?? e?.message ?? 'network error').toString().slice(0, 120);
}
function mapRelayFailure(httpStatus, body, rawText = '') {
    const b = (body ?? {});
    const first = Array.isArray(b.errors) ? b.errors[0] : undefined;
    const relayCode = b.code ?? first?.code ?? null;
    const field = first?.field ?? null;
    const message = (b.message ?? first?.message ?? rawText ?? '').toString().slice(0, 300);
    const relay = {
        httpStatus,
        relayCode,
        field,
        metaCode: typeof first?.metaCode === 'number' ? first.metaCode : null,
        metaTitle: first?.metaTitle ?? null,
        relayMsgId: typeof first?.relayMsgId === 'string' ? first.relayMsgId : null,
    };
    const err = (code, text) => new wa_errors_1.WaRelayError(code, text, relay);
    if (b.success !== false || !relayCode) {
        return err(wa_constants_1.WA_CODES.RELAY_ERROR, `The WhatsApp service gave an answer this server cannot read (HTTP ${httpStatus})`);
    }
    switch (relayCode) {
        case wa_constants_1.RELAY_CODES.KEY_INVALID:
        case wa_constants_1.RELAY_CODES.KEY_REVOKED:
            return err(wa_constants_1.WA_CODES.KEY_REVOKED, message || 'VK has turned off WhatsApp for this server');
        case wa_constants_1.RELAY_CODES.SHOP_SUSPENDED:
            return err(wa_constants_1.WA_CODES.SHOP_SUSPENDED, message || 'VK has paused WhatsApp for this company');
        case wa_constants_1.RELAY_CODES.NOT_CONNECTED:
            return err(wa_constants_1.WA_CODES.NOT_CONNECTED, message || 'The WhatsApp number is not connected');
        case wa_constants_1.RELAY_CODES.ALREADY_CONNECTED:
            return err(wa_constants_1.WA_CODES.ALREADY_CONNECTED, message || 'The WhatsApp number is already connected');
        case wa_constants_1.RELAY_CODES.CODE_INVALID:
            return err(wa_constants_1.WA_CODES.ACTIVATION_INVALID, message || 'The activation code is wrong, used or expired');
        case wa_constants_1.RELAY_CODES.TEMPLATE_NOT_APPROVED:
            return err(wa_constants_1.WA_CODES.TEMPLATE_NOT_APPROVED, message || 'Meta has not approved this template');
        case wa_constants_1.RELAY_CODES.PDF_TOO_BIG:
        case wa_constants_1.RELAY_CODES.PAYLOAD_TOO_BIG:
            return err(wa_constants_1.WA_CODES.PDF_TOO_BIG, message || 'The PDF is larger than WhatsApp allows');
        case wa_constants_1.RELAY_CODES.META_ERROR:
            return err((0, wa_constants_1.waMetaCode)(relay.metaCode), message || `Meta refused the message (${relay.metaCode ?? '?'})`);
        case wa_constants_1.RELAY_CODES.META_UNREACHABLE:
            return err(wa_constants_1.WA_CODES.RELAY_UNREACHABLE, message || 'Meta did not answer');
        case wa_constants_1.RELAY_CODES.RATE_LIMITED:
            return err(wa_constants_1.WA_CODES.RELAY_BUSY, message || 'Too many requests to the WhatsApp service');
        case wa_constants_1.RELAY_CODES.BAD_REQUEST:
            return field === 'to'
                ? err(wa_constants_1.WA_CODES.BAD_NUMBER, message || 'Not a mobile number')
                : err(wa_constants_1.WA_CODES.RELAY_BAD_REQUEST, message || 'The WhatsApp service refused the message details');
        case wa_constants_1.RELAY_CODES.SEND_UNCONFIRMED:
            return err(wa_constants_1.WA_CODES.RELAY_ERROR, message || 'The WhatsApp service has not confirmed the send yet');
        default:
            return err(wa_constants_1.WA_CODES.RELAY_ERROR, message || `The WhatsApp service failed (${relayCode})`);
    }
}
//# sourceMappingURL=wa-relay.client.js.map