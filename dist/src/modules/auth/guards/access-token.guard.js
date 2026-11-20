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
const optional_auth_decorator_1 = require("../../../common/decorators/optional-auth.decorator");
const password_change_allowed_decorator_1 = require("../../../common/decorators/password-change-allowed.decorator");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const auth_epoch_service_1 = require("../../app-version/services/auth-epoch.service");
const auth_session_service_1 = require("../auth-session.service");
const token_service_1 = require("../token.service");
const auth_error_codes_1 = require("../types/auth-error-codes");
let AccessTokenGuard = class AccessTokenGuard {
    reflector;
    tokenService;
    authSessionService;
    requestContextService;
    authEpoch;
    prisma;
    constructor(reflector, tokenService, authSessionService, requestContextService, authEpoch, prisma) {
        this.reflector = reflector;
        this.tokenService = tokenService;
        this.authSessionService = authSessionService;
        this.requestContextService = requestContextService;
        this.authEpoch = authEpoch;
        this.prisma = prisma;
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
            if (!request.headers.authorization && this.isOptionalAuth(context)) {
                return true;
            }
            throw new common_1.UnauthorizedException((0, auth_error_codes_1.authErrorBody)('Missing or invalid Authorization header', 'authorization', auth_error_codes_1.AuthErrorCode.AUTHORIZATION_MISSING));
        }
        request.user = this.tokenService.verifyAccessToken(accessToken);
        this.authEpoch.assertTokenEpoch(request.user.ep, 'access');
        await this.authSessionService.assertAccessTokenIsActive(accessToken, request.user);
        this.requestContextService.setUserId(request.user.sub);
        this.requestContextService.setUserType(request.user.user_type);
        this.requestContextService.setCompanyId(request.user.company_id);
        this.requestContextService.setBranchId(request.user.branch_id);
        this.requestContextService.setDeviceId(request.user.device_id);
        if (request.user.pwc === true && !this.isPasswordChangeAllowed(context)) {
            await this.assertPasswordChanged(request.user.sub);
        }
        return true;
    }
    async assertPasswordChanged(usrId) {
        const user = await this.prisma.userMaster.findUnique({
            where: { usrId },
            select: { usrMustChangePassword: true },
        });
        if (user?.usrMustChangePassword === false) {
            return;
        }
        throw new common_1.ForbiddenException((0, auth_error_codes_1.authErrorBody)('Your password was reset: change it before you go on', 'authorization', auth_error_codes_1.AuthErrorCode.PASSWORD_CHANGE_REQUIRED));
    }
    isPasswordChangeAllowed(context) {
        return (this.reflector.getAllAndOverride(password_change_allowed_decorator_1.PASSWORD_CHANGE_ALLOWED_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) === true);
    }
    isOptionalAuth(context) {
        return (this.reflector.getAllAndOverride(optional_auth_decorator_1.IS_OPTIONAL_AUTH_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) === true);
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
        request_context_service_1.RequestContextService,
        auth_epoch_service_1.AuthEpochService,
        prisma_service_1.PrismaService])
], AccessTokenGuard);
//# sourceMappingURL=access-token.guard.js.map