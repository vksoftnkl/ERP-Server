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
exports.UserLoginSessionsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const list_user_login_sessions_query_dto_1 = require("./dto/list-user-login-sessions-query.dto");
const save_user_login_session_dto_1 = require("./dto/save-user-login-session.dto");
const user_login_sessions_response_dto_1 = require("./dto/user-login-sessions-response.dto");
const user_login_sessions_exception_filter_1 = require("./user-login-sessions-exception.filter");
const user_login_sessions_service_1 = require("./user-login-sessions.service");
const api_version_1 = require("../../../common/constants/api-version");
let UserLoginSessionsController = class UserLoginSessionsController {
    userLoginSessionsService;
    constructor(userLoginSessionsService) {
        this.userLoginSessionsService = userLoginSessionsService;
    }
    async save(saveUserLoginSessionDto) {
        const data = await this.userLoginSessionsService.save(saveUserLoginSessionDto);
        return {
            success: true,
            message: saveUserLoginSessionDto.ulsId
                ? 'User login session updated successfully'
                : 'User login session created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.userLoginSessionsService.list(queryDto);
        return {
            success: true,
            message: 'User login sessions fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(ulsId) {
        const data = await this.userLoginSessionsService.getById(ulsId);
        return {
            success: true,
            message: 'User login session fetched successfully',
            data,
        };
    }
    async remove(ulsId) {
        const data = await this.userLoginSessionsService.softDelete(ulsId);
        return {
            success: true,
            message: 'User login session deleted successfully',
            data,
        };
    }
};
exports.UserLoginSessionsController = UserLoginSessionsController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update user login session (by ulsId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_user_login_session_dto_1.SaveUserLoginSessionDto]),
    __metadata("design:returntype", Promise)
], UserLoginSessionsController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List user login sessions with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_user_login_sessions_query_dto_1.ListUserLoginSessionsQueryDto]),
    __metadata("design:returntype", Promise)
], UserLoginSessionsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get user login session by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ulsId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    __param(0, (0, common_1.Query)('ulsId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserLoginSessionsController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete user login session by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ulsId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_login_sessions_response_dto_1.UserLoginSessionsErrorResponseDto }),
    __param(0, (0, common_1.Query)('ulsId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserLoginSessionsController.prototype, "remove", null);
exports.UserLoginSessionsController = UserLoginSessionsController = __decorate([
    (0, swagger_1.ApiTags)('User Login Sessions'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('user-login-sessions'),
    (0, common_1.UseFilters)(user_login_sessions_exception_filter_1.UserLoginSessionsExceptionFilter),
    __metadata("design:paramtypes", [user_login_sessions_service_1.UserLoginSessionsService])
], UserLoginSessionsController);
//# sourceMappingURL=user-login-sessions.controller.js.map