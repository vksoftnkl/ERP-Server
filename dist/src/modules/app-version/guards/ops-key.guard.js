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
exports.OpsKeyGuard = void 0;
exports.opsActorOf = opsActorOf;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const app_version_constants_1 = require("../app-version.constants");
const app_version_error_codes_1 = require("../types/app-version-error-codes");
let OpsKeyGuard = class OpsKeyGuard {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    canActivate(context) {
        const expected = (this.configService.get('OPS_API_KEY') ?? '').trim();
        if (!expected) {
            throw new common_1.ForbiddenException((0, app_version_error_codes_1.appVersionErrorBody)('The ops API is disabled on this server (OPS_API_KEY is not set)', 'x-ops-key', app_version_error_codes_1.AppVersionErrorCode.OPS_DISABLED));
        }
        const request = context.switchToHttp().getRequest();
        const presented = firstHeader(request.headers[app_version_constants_1.OPS_KEY_HEADER]);
        if (!presented || !sameSecret(presented, expected)) {
            throw new common_1.UnauthorizedException((0, app_version_error_codes_1.appVersionErrorBody)('Missing or invalid X-Ops-Key header', 'x-ops-key', app_version_error_codes_1.AppVersionErrorCode.OPS_KEY_INVALID));
        }
        return true;
    }
};
exports.OpsKeyGuard = OpsKeyGuard;
exports.OpsKeyGuard = OpsKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpsKeyGuard);
function opsActorOf(request) {
    const actor = firstHeader(request.headers[app_version_constants_1.OPS_ACTOR_HEADER]);
    return actor && /^[A-Za-z0-9._:@/#-]{1,60}$/.test(actor) ? `ops:${actor}` : 'ops';
}
function firstHeader(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
}
function sameSecret(presented, expected) {
    const a = (0, node_crypto_1.createHash)('sha256').update(presented, 'utf8').digest();
    const b = (0, node_crypto_1.createHash)('sha256').update(expected, 'utf8').digest();
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
//# sourceMappingURL=ops-key.guard.js.map