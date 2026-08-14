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
exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
let TokenService = class TokenService {
    configService;
    secret;
    accessTokenLifetimeSeconds;
    constructor(configService) {
        this.configService = configService;
        this.secret = this.configService.get('auth.jwtSecret', '');
        this.accessTokenLifetimeSeconds = this.configService.get('auth.jwtExpiresIn', 3600);
    }
    signAccessToken(claims) {
        if (!this.secret) {
            throw new common_1.InternalServerErrorException('JWT secret is not configured');
        }
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            ...claims,
            iat: now,
            exp: now + this.accessTokenLifetimeSeconds,
        };
        const headerSegment = this.encodeBase64Url({
            alg: 'HS256',
            typ: 'JWT',
        });
        const payloadSegment = this.encodeBase64Url(payload);
        const unsignedToken = `${headerSegment}.${payloadSegment}`;
        const signature = (0, node_crypto_1.createHmac)('sha256', this.secret).update(unsignedToken).digest('base64url');
        return {
            token: `${unsignedToken}.${signature}`,
            expiresIn: this.accessTokenLifetimeSeconds,
        };
    }
    encodeBase64Url(data) {
        return Buffer.from(JSON.stringify(data)).toString('base64url');
    }
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TokenService);
//# sourceMappingURL=token.service.js.map