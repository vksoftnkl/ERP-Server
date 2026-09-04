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
exports.AccessTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const auth_session_service_1 = require("../auth-session.service");
const token_service_1 = require("../token.service");
let AccessTokenGuard = class AccessTokenGuard {
    reflector;
    tokenService;
    authSessionService;
    requestContextService;
    constructor(reflector, tokenService, authSessionService, requestContextService) {
        this.reflector = reflector;
        this.tokenService = tokenService;
        this.authSessionService = authSessionService;
        this.requestContextService = requestContextService;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        if (request.method.toUpperCase() === 'OPTIONS') {
            return true;
        }
        const accessToken = this.extractBearerToken(request);
        if (!accessToken) {
            throw new common_1.UnauthorizedException('Missing or invalid Authorization header');
        }
        request.user = this.tokenService.verifyAccessToken(accessToken);
        await this.authSessionService.assertAccessTokenIsActive(accessToken, request.user);
        this.requestContextService.setUserId(request.user.sub);
        this.requestContextService.setUserType(request.user.user_type);
        this.requestContextService.setCompanyId(request.user.company_id);
        this.requestContextService.setBranchId(request.user.branch_id);
        this.requestContextService.setDeviceId(request.user.device_id);
        return true;
    }
    extractBearerToken(request) {
        const authorizationHeader = request.headers.authorization;
        if (!authorizationHeader) {
            return null;
        }
        const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);
        if (rest.length > 0 || !scheme || !token || scheme.toLowerCase() !== 'bearer') {
            return null;
        }
        return token;
    }
};
exports.AccessTokenGuard = AccessTokenGuard;
exports.AccessTokenGuard = AccessTokenGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        token_service_1.TokenService,
        auth_session_service_1.AuthSessionService,
        request_context_service_1.RequestContextService])
], AccessTokenGuard);
//# sourceMappingURL=access-token.guard.js.map