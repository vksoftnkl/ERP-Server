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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_info_1 = require("../../common/client-info/client-info");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const password_change_allowed_decorator_1 = require("../../common/decorators/password-change-allowed.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const auth_service_1 = require("./auth.service");
const change_password_dto_1 = require("./dto/change-password.dto");
const login_auth_dto_1 = require("./dto/login-auth.dto");
const login_response_dto_1 = require("./dto/login-response.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const api_version_1 = require("../../common/constants/api-version");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async login(loginAuthDto, request) {
        return this.authService.login(loginAuthDto, {
            userAgent: this.extractHeader(request.headers['user-agent']),
            appVersion: this.extractHeader(request.headers['x-app-version']),
            client: (0, client_info_1.clientInfoOf)(request),
        });
    }
    async refresh(refreshTokenDto, request) {
        return this.authService.refresh(refreshTokenDto.refresh_token, (0, client_info_1.clientInfoOf)(request));
    }
    async changePassword(dto) {
        const data = await this.authService.changePassword(dto);
        return { success: true, message: 'Password changed', data };
    }
    extractHeader(headerValue) {
        if (typeof headerValue === 'string') {
            const trimmed = headerValue.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
        if (Array.isArray(headerValue)) {
            const firstValue = headerValue.find((value) => typeof value === 'string' && value.trim().length > 0);
            return typeof firstValue === 'string' ? firstValue.trim() : null;
        }
        return null;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Login user and return access token',
        description: 'Wrong password or unknown login name: 401 AUTH_INVALID_CREDENTIALS (nothing more is said). ' +
            'Only after the password is proved right does the answer name the account state ' +
            '(review step 6): 401 AUTH_USER_INACTIVE (inactive or deleted), 401 AUTH_USER_LOCKED, ' +
            '401 AUTH_CHANNEL_DISABLED (detail `channel`: desktop | web | mobile). ' +
            '`mustChangePassword: true` = an administrator reset the password: this session may call ' +
            'POST /auth/change-password only (anything else is 403 AUTH_PASSWORD_CHANGE_REQUIRED) ' +
            'until the user has changed it.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: login_response_dto_1.LoginResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_auth_dto_1.LoginAuthDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token' }),
    (0, swagger_1.ApiOkResponse)({ type: login_response_dto_1.LoginResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, password_change_allowed_decorator_1.AllowWhilePasswordChangeRequired)(),
    (0, common_1.Post)('change-password'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiOperation)({
        summary: "Change the signed-in user's own password (current password checked)",
        description: 'The user comes from the access token only; a usrId in the body is refused ' +
            '(VALIDATION_WHITELIST). 400 AUTH_CURRENT_PASSWORD_WRONG (field currentPassword), ' +
            '400 AUTH_NEW_PASSWORD_TOO_SHORT / AUTH_NEW_PASSWORD_SAME (field newPassword), ' +
            '401 AUTH_USER_INACTIVE when the account was deactivated, deleted or locked since login. ' +
            'Clears usr_must_change_password; this session stays signed in, and a session that ' +
            'logged in with mustChangePassword: true may call every other route again at once.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: change_password_dto_1.ChangePasswordResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [change_password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map