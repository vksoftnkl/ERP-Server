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
exports.TenderTypeMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const tender_type_master_response_dto_1 = require("./dto/tender-type-master-response.dto");
const save_tender_type_master_dto_1 = require("./dto/save-tender-type-master.dto");
const tender_type_master_exception_filter_1 = require("./tender-type-master-exception.filter");
const tender_type_master_service_1 = require("./tender-type-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let TenderTypeMasterController = class TenderTypeMasterController {
    tenderTypeMasterService;
    constructor(tenderTypeMasterService) {
        this.tenderTypeMasterService = tenderTypeMasterService;
    }
    async save(saveTenderTypeMasterDto) {
        const data = await this.tenderTypeMasterService.save(saveTenderTypeMasterDto);
        return {
            success: true,
            message: saveTenderTypeMasterDto.ttmTypeId
                ? 'Tender type updated successfully'
                : 'Tender type created successfully',
            data,
        };
    }
    async getById(ttmTypeId) {
        const data = await this.tenderTypeMasterService.getById(ttmTypeId);
        return {
            success: true,
            message: 'Tender type fetched successfully',
            data,
        };
    }
    async remove(ttmTypeId) {
        const data = await this.tenderTypeMasterService.softDelete(ttmTypeId);
        return {
            success: true,
            message: 'Tender type deleted successfully',
            data,
        };
    }
};
exports.TenderTypeMasterController = TenderTypeMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update tender type (by ttmTypeId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_tender_type_master_dto_1.SaveTenderTypeMasterDto]),
    __metadata("design:returntype", Promise)
], TenderTypeMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get tender type by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ttmTypeId', schema: { type: 'string', example: '1' } }),
    (0, swagger_1.ApiOkResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('ttmTypeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenderTypeMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete tender type by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ttmTypeId', schema: { type: 'string', example: '1' } }),
    (0, swagger_1.ApiOkResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_type_master_response_dto_1.TenderTypeMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('ttmTypeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenderTypeMasterController.prototype, "remove", null);
exports.TenderTypeMasterController = TenderTypeMasterController = __decorate([
    (0, swagger_1.ApiTags)('Tender Type Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('tender-type-masters'),
    (0, common_1.UseFilters)(tender_type_master_exception_filter_1.TenderTypeMasterExceptionFilter),
    __metadata("design:paramtypes", [tender_type_master_service_1.TenderTypeMasterService])
], TenderTypeMasterController);
//# sourceMappingURL=tender-type-master.controller.js.map