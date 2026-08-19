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
exports.GspProviderMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const gsp_provider_master_exception_filter_1 = require("./gsp-provider-master-exception.filter");
const gsp_provider_master_response_dto_1 = require("./dto/gsp-provider-master-response.dto");
const save_gsp_provider_master_dto_1 = require("./dto/save-gsp-provider-master.dto");
const gsp_provider_master_service_1 = require("./gsp-provider-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let GspProviderMasterController = class GspProviderMasterController {
    gspProviderMasterService;
    constructor(gspProviderMasterService) {
        this.gspProviderMasterService = gspProviderMasterService;
    }
    async save(saveGspProviderMasterDto) {
        const data = await this.gspProviderMasterService.save(saveGspProviderMasterDto);
        return {
            success: true,
            message: saveGspProviderMasterDto.gspProviderId
                ? 'GSP provider updated successfully'
                : 'GSP provider created successfully',
            data,
        };
    }
    async getById(gspProviderId) {
        const data = await this.gspProviderMasterService.getById(gspProviderId);
        return {
            success: true,
            message: 'GSP provider fetched successfully',
            data,
        };
    }
    async remove(gspProviderId) {
        const data = await this.gspProviderMasterService.softDelete(gspProviderId);
        return {
            success: true,
            message: 'GSP provider deleted successfully',
            data,
        };
    }
};
exports.GspProviderMasterController = GspProviderMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update GSP provider (by gspProviderId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_gsp_provider_master_dto_1.SaveGspProviderMasterDto]),
    __metadata("design:returntype", Promise)
], GspProviderMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get GSP provider by id' }),
    (0, swagger_1.ApiQuery)({ name: 'gspProviderId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('gspProviderId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GspProviderMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete GSP provider by id' }),
    (0, swagger_1.ApiQuery)({ name: 'gspProviderId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: gsp_provider_master_response_dto_1.GspProviderMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('gspProviderId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GspProviderMasterController.prototype, "remove", null);
exports.GspProviderMasterController = GspProviderMasterController = __decorate([
    (0, swagger_1.ApiTags)('GSP Provider Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('gsp-provider-masters'),
    (0, common_1.UseFilters)(gsp_provider_master_exception_filter_1.GspProviderMasterExceptionFilter),
    __metadata("design:paramtypes", [gsp_provider_master_service_1.GspProviderMasterService])
], GspProviderMasterController);
//# sourceMappingURL=gsp-provider-master.controller.js.map