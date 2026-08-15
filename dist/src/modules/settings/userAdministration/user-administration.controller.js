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
exports.UserAdministrationController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const user_administration_response_dto_1 = require("./dto/user-administration-response.dto");
const save_user_administration_dto_1 = require("./dto/save-user-administration.dto");
const user_administration_exception_filter_1 = require("./user-administration-exception.filter");
const user_administration_service_1 = require("./user-administration.service");
const api_version_1 = require("../../../common/constants/api-version");
let UserAdministrationController = class UserAdministrationController {
    userAdministrationService;
    constructor(userAdministrationService) {
        this.userAdministrationService = userAdministrationService;
    }
    async save(dto) {
        const data = await this.userAdministrationService.save(dto);
        return {
            success: true,
            message: dto.usrId ? 'User updated successfully' : 'User created successfully',
            data,
        };
    }
    async getById(usrId) {
        const data = await this.userAdministrationService.getById(usrId);
        return {
            success: true,
            message: 'User fetched successfully',
            data,
        };
    }
    async remove(usrId) {
        const data = await this.userAdministrationService.softDelete(usrId);
        return {
            success: true,
            message: 'User deleted successfully',
            data,
        };
    }
};
exports.UserAdministrationController = UserAdministrationController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update user with menu permissions (by usrId presence)',
        description: 'Omit usrId to create a new user. Provide usrId to update. ' +
            'The menus array fully replaces existing menu assignments: omit the field entirely to leave menus unchanged on update.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: user_administration_response_dto_1.UserAdminSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_user_administration_dto_1.SaveUserAdministrationDto]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get user by id including all active menu permissions' }),
    (0, swagger_1.ApiQuery)({ name: 'usrId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_administration_response_dto_1.UserAdminSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    __param(0, (0, common_1.Query)('usrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete user and all their menu assignments by usrId' }),
    (0, swagger_1.ApiQuery)({ name: 'usrId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_administration_response_dto_1.UserAdminSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    __param(0, (0, common_1.Query)('usrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "remove", null);
exports.UserAdministrationController = UserAdministrationController = __decorate([
    (0, swagger_1.ApiTags)('User Administration'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('user-administration'),
    (0, common_1.UseFilters)(user_administration_exception_filter_1.UserAdministrationExceptionFilter),
    __metadata("design:paramtypes", [user_administration_service_1.UserAdministrationService])
], UserAdministrationController);
//# sourceMappingURL=user-administration.controller.js.map