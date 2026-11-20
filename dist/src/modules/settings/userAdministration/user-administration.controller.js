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
    async resetPassword(dto) {
        const data = await this.userAdministrationService.resetPassword(dto);
        return { success: true, message: 'Password reset', data };
    }
    async unlock(usrId) {
        const data = await this.userAdministrationService.unlock(usrId);
        return { success: true, message: data.changed ? 'User unlocked' : 'Nothing to unlock', data };
    }
    async restore(usrId) {
        const data = await this.userAdministrationService.restore(usrId);
        return { success: true, message: 'User restored', data };
    }
};
exports.UserAdministrationController = UserAdministrationController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update user with menu permissions (by usrId presence)',
        description: 'Omit usrId to create a new user (menu 58 Create right). Provide usrId to update (menu 58 Edit ' +
            "right, the caller's own row included: a user changes their own password through " +
            'POST /auth/change-password). ' +
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
    (0, swagger_1.ApiOperation)({
        summary: 'Get user by id including all active menu permissions',
        description: "The caller's own row needs no right; any other user's needs menu 58 View.",
    }),
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
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete user and all their menu assignments by usrId',
        description: 'Needs menu 58 Delete right.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'usrId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_administration_response_dto_1.UserAdminSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    __param(0, (0, common_1.Query)('usrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: "Reset a user's password (typed or generated); the user must change it at next login",
        description: 'Menu 58 Edit right (403 USER_RIGHT_EDIT). Send newPassword (at least 4 characters, ' +
            'spaces at either end not counted: 400 USER_PASSWORD_TOO_SHORT) or generate: true (8 ' +
            'random characters, answered ONCE in generatedPassword); both = 400 ' +
            'USER_RESET_PASSWORD_CHOICE. Sets usrMustChangePassword: the next login answers ' +
            'mustChangePassword: true. 404 USER_NOT_FOUND (no live user), 403 USER_ROLE_RESERVED ' +
            '(a SUPER ADMIN user, caller not one). The lock and the failed-login count are left as ' +
            'they are (POST /unlock). The audit row names the administrator, never the password.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: user_administration_response_dto_1.UserAdminSuccessResetPasswordDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_user_administration_dto_1.ResetUserPasswordDto]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('unlock'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Unlock a user: clear the lock and the failed-login count',
        description: 'Menu 58 Edit right (403 USER_RIGHT_EDIT). Clears usrIsLocked, usrLockedOn, usrLockedBy ' +
            'and usrFailedLoginCount; one audit row. Nothing to clear = changed: false, no row. ' +
            '404 USER_NOT_FOUND (no live user), 403 USER_ROLE_RESERVED (a SUPER ADMIN user).',
    }),
    (0, swagger_1.ApiQuery)({ name: 'usrId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_administration_response_dto_1.UserAdminSuccessUnlockDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    __param(0, (0, common_1.Query)('usrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "unlock", null);
__decorate([
    (0, common_1.Post)('restore'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Restore a deleted user (it comes back inactive, with the rights the delete removed)',
        description: 'Menu 58 Delete right (403 USER_RIGHT_DELETE). The user comes back INACTIVE, with the ' +
            'menu rights its delete removed (menuCount; rights an earlier save removed, and rows of a ' +
            'menu no longer active, stay removed). 404 USER_NOT_FOUND, 409 ' +
            'USER_NOT_DELETED, 409 USER_RESTORE_LOGIN_TAKEN (a live user now has the login name; ' +
            'detail loginName), 403 USER_ROLE_RESERVED (a SUPER ADMIN user). One audit row.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'usrId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: user_administration_response_dto_1.UserAdminSuccessRestoreDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: user_administration_response_dto_1.UserAdminErrorResponseDto }),
    __param(0, (0, common_1.Query)('usrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserAdministrationController.prototype, "restore", null);
exports.UserAdministrationController = UserAdministrationController = __decorate([
    (0, swagger_1.ApiTags)('User Administration'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiForbiddenResponse)({
        type: user_administration_response_dto_1.UserAdminErrorResponseDto,
        description: 'USER_RIGHT_CREATE / USER_RIGHT_EDIT / USER_RIGHT_DELETE / USER_RIGHT_VIEW (field userId) — the ' +
            'caller lacks that right on Users & Rights (menu 58). ' +
            'USER_ROLE_RESERVED — only a SUPER ADMIN makes a user SUPER ADMIN, or changes / deletes one',
    }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('user-administration'),
    (0, common_1.UseFilters)(user_administration_exception_filter_1.UserAdministrationExceptionFilter),
    __metadata("design:paramtypes", [user_administration_service_1.UserAdministrationService])
], UserAdministrationController);
//# sourceMappingURL=user-administration.controller.js.map