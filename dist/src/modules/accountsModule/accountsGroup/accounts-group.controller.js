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
exports.AccountsGroupController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const account_group_exception_filter_1 = require("./account-group-exception.filter");
const account_group_response_dto_1 = require("./dto/account-group-response.dto");
const save_account_group_dto_1 = require("./dto/save-account-group.dto");
const accounts_group_service_1 = require("./accounts-group.service");
const api_version_1 = require("../../../common/constants/api-version");
let AccountsGroupController = class AccountsGroupController {
    accountsGroupService;
    constructor(accountsGroupService) {
        this.accountsGroupService = accountsGroupService;
    }
    async save(saveAccountGroupDto) {
        const data = await this.accountsGroupService.save(saveAccountGroupDto);
        return {
            success: true,
            message: saveAccountGroupDto.accGroupId
                ? 'Account group updated successfully'
                : 'Account group created successfully',
            data,
        };
    }
    async getById(accGroupId) {
        const data = await this.accountsGroupService.getById(accGroupId);
        return {
            success: true,
            message: 'Account group fetched successfully',
            data,
        };
    }
    async remove(accGroupId) {
        const data = await this.accountsGroupService.softDelete(accGroupId);
        return {
            success: true,
            message: 'Account group deleted successfully',
            data,
        };
    }
};
exports.AccountsGroupController = AccountsGroupController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update account group (by accGroupId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: account_group_response_dto_1.AccountGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_group_response_dto_1.AccountGroupErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: account_group_response_dto_1.AccountGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_group_response_dto_1.AccountGroupErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_account_group_dto_1.SaveAccountGroupDto]),
    __metadata("design:returntype", Promise)
], AccountsGroupController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get account group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'accGroupId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: account_group_response_dto_1.AccountGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_group_response_dto_1.AccountGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_group_response_dto_1.AccountGroupErrorResponseDto }),
    __param(0, (0, common_1.Query)('accGroupId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccountsGroupController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete account group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'accGroupId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: account_group_response_dto_1.AccountGroupSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: account_group_response_dto_1.AccountGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: account_group_response_dto_1.AccountGroupErrorResponseDto }),
    __param(0, (0, common_1.Query)('accGroupId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccountsGroupController.prototype, "remove", null);
exports.AccountsGroupController = AccountsGroupController = __decorate([
    (0, swagger_1.ApiTags)('Account Groups'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('account-groups'),
    (0, common_1.UseFilters)(account_group_exception_filter_1.AccountGroupExceptionFilter),
    __metadata("design:paramtypes", [accounts_group_service_1.AccountsGroupService])
], AccountsGroupController);
//# sourceMappingURL=accounts-group.controller.js.map