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
exports.AccGroupMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const acc_group_master_exception_filter_1 = require("./acc-group-master-exception.filter");
const acc_group_master_response_dto_1 = require("./dto/acc-group-master-response.dto");
const save_acc_group_master_dto_1 = require("./dto/save-acc-group-master.dto");
const acc_group_master_service_1 = require("./acc-group-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let AccGroupMasterController = class AccGroupMasterController {
    accGroupMasterService;
    constructor(accGroupMasterService) {
        this.accGroupMasterService = accGroupMasterService;
    }
    async save(saveAccGroupMasterDto) {
        const data = await this.accGroupMasterService.save(saveAccGroupMasterDto);
        return {
            success: true,
            message: saveAccGroupMasterDto.accGroupId
                ? 'Account group updated successfully'
                : 'Account group created successfully',
            data,
        };
    }
    async getById(accGroupId) {
        const data = await this.accGroupMasterService.getById(accGroupId);
        return {
            success: true,
            message: 'Account group fetched successfully',
            data,
        };
    }
    async remove(accGroupId) {
        const data = await this.accGroupMasterService.softDelete(accGroupId);
        return {
            success: true,
            message: 'Account group deleted successfully',
            data,
        };
    }
};
exports.AccGroupMasterController = AccGroupMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update account group (by accGroupId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_acc_group_master_dto_1.SaveAccGroupMasterDto]),
    __metadata("design:returntype", Promise)
], AccGroupMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get account group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'accGroupId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('accGroupId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccGroupMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete account group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'accGroupId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: acc_group_master_response_dto_1.AccGroupMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('accGroupId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccGroupMasterController.prototype, "remove", null);
exports.AccGroupMasterController = AccGroupMasterController = __decorate([
    (0, swagger_1.ApiTags)('Account Groups'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('account-groups'),
    (0, common_1.UseFilters)(acc_group_master_exception_filter_1.AccGroupMasterExceptionFilter),
    __metadata("design:paramtypes", [acc_group_master_service_1.AccGroupMasterService])
], AccGroupMasterController);
//# sourceMappingURL=acc-group-master.controller.js.map