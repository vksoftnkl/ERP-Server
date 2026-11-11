"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClientInfoMiddleware = createClientInfoMiddleware;
exports.describeErrorResponse = describeErrorResponse;
exports.errorCodesOf = errorCodesOf;
const common_1 = require("@nestjs/common");
const client_info_1 = require("./client-info");
const SKIPPED_STATUSES = new Set([401, 404]);
const MAX_LOGGED_CODES = 5;
function createClientInfoMiddleware(sink = new common_1.Logger('HttpError')) {
    return function clientInfoMiddleware(request, response, next) {
        const req = request;
        try {
            req.clientInfo = (0, client_info_1.parseClientInfo)(request.headers);
        }
        catch {
            req.clientInfo = { ...client_info_1.EMPTY_CLIENT_INFO };
        }
        try {
            watchForErrorResponse(req, response, sink);
        }
        catch {
        }
        next();
    };
}
function watchForErrorResponse(request, response, sink) {
    let codes = [];
    const originalJson = response.json;
    response.json = function jsonWithCodeCapture(body) {
        if (response.statusCode >= 400) {
            codes = errorCodesOf(body);
        }
        return originalJson.call(this, body);
    };
    response.once('finish', () => {
        const status = response.statusCode;
        if (status < 400 || SKIPPED_STATUSES.has(status)) {
            return;
        }
        try {
            const line = describeErrorResponse(request, status, codes);
            if (status >= 500) {
                sink.error(line);
            }
            else {
                sink.warn(line);
            }
        }
        catch {
        }
    });
}
function describeErrorResponse(request, status, codes) {
    const client = request.clientInfo ?? (0, client_info_1.parseClientInfo)(request.headers);
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const user = request.user;
    const userName = textOf(user?.user_name) ?? textOf(user?.sub);
    return [
        `${status} ${request.method} ${path}`,
        `code=${codes.length > 0 ? codes.join(',') : '-'}`,
        `platform=${token(client.platform)}`,
        `build=${token(client.build)}`,
        `version=${token(client.version)}`,
        `device=${token(client.deviceId)}`,
        `company=${token(textOf(user?.company_id))}`,
        `user=${token(userName)}`,
    ].join(' ');
}
function errorCodesOf(body) {
    if (!body || typeof body !== 'object') {
        return [];
    }
    const errors = body.errors;
    if (!Array.isArray(errors)) {
        return [];
    }
    const codes = [];
    for (const entry of errors) {
        const code = entry && typeof entry === 'object' ? entry.code : undefined;
        if (typeof code === 'string' && code.length > 0 && !codes.includes(code)) {
            codes.push(code);
        }
        if (codes.length >= MAX_LOGGED_CODES) {
            break;
        }
    }
    return codes;
}
function textOf(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
function token(value) {
    if (value === null || value === '') {
        return '-';
    }
    const text = String(value);
    return /\s/.test(text) ? JSON.stringify(text) : text;
}
//# sourceMappingURL=client-info.middleware.js.map