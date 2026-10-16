"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GstHttpClient = exports.GstHttpError = void 0;
const common_1 = require("@nestjs/common");
const gst_route_guard_1 = require("./gst-route-guard");
class GstHttpError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.kind = kind;
    }
}
exports.GstHttpError = GstHttpError;
let GstHttpClient = class GstHttpClient {
    async send(request) {
        (0, gst_route_guard_1.assertGstRouteActive)(request.route, { field: 'gstProvider' });
        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                signal: AbortSignal.timeout(request.timeoutMs),
            });
            return { status: response.status, text: await response.text() };
        }
        catch (error) {
            const name = error instanceof Error ? error.name : '';
            if (name === 'TimeoutError' || name === 'AbortError') {
                throw new GstHttpError('TIMEOUT', `No reply within ${request.timeoutMs} ms`);
            }
            const cause = error?.cause?.message;
            throw new GstHttpError('NETWORK', `Could not reach ${new URL(request.url).host}: ${cause ?? (error instanceof Error ? error.message : String(error))}`);
        }
    }
};
exports.GstHttpClient = GstHttpClient;
exports.GstHttpClient = GstHttpClient = __decorate([
    (0, common_1.Injectable)()
], GstHttpClient);
//# sourceMappingURL=gst-http.client.js.map