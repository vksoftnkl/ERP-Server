"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContextMiddleware = void 0;
const common_1 = require("@nestjs/common");
const node_net_1 = require("node:net");
const request_context_service_1 = require("../request-context/request-context.service");
let RequestContextMiddleware = class RequestContextMiddleware {
    requestContextService;
    constructor(requestContextService) {
        this.requestContextService = requestContextService;
    }
    use(request, _response, next) {
        this.requestContextService.run({
            ipAddress: this.extractClientIp(request),
            userId: this.extractUserIdHeader(request),
            userType: null,
            companyId: null,
            branchId: null,
            deviceId: null,
        }, next);
    }
    extractClientIp(request) {
        const headerValue = request.headers['x-forwarded-for'];
        if (typeof headerValue === 'string') {
            const firstForwardedIp = headerValue
                .split(',')
                .map((value) => value.trim())
                .find((value) => value.length > 0);
            const normalizedForwardedIp = this.normalizeIpAddress(firstForwardedIp);
            if (normalizedForwardedIp) {
                return normalizedForwardedIp;
            }
        }
        const realIpHeader = request.headers['x-real-ip'];
        if (typeof realIpHeader === 'string') {
            const normalizedRealIp = this.normalizeIpAddress(realIpHeader.trim());
            if (normalizedRealIp) {
                return normalizedRealIp;
            }
        }
        const directIp = this.normalizeIpAddress(request.ip) ?? this.normalizeIpAddress(request.socket.remoteAddress);
        return directIp ?? null;
    }
    extractUserIdHeader(request) {
        const headerValue = request.headers['x-user-id'];
        if (typeof headerValue !== 'string') {
            return null;
        }
        const trimmed = headerValue.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    normalizeIpAddress(ipAddress) {
        if (!ipAddress) {
            return null;
        }
        const normalizedIp = ipAddress.trim().replace(/^\[|\]$/g, '');
        if (!normalizedIp) {
            return null;
        }
        return (0, node_net_1.isIP)(normalizedIp) === 0 ? null : normalizedIp;
    }
};
exports.RequestContextMiddleware = RequestContextMiddleware;
exports.RequestContextMiddleware = RequestContextMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [request_context_service_1.RequestContextService])
], RequestContextMiddleware);
//# sourceMappingURL=request-context.middleware.js.map