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
exports.TenderMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const tender_master_response_dto_1 = require("./dto/tender-master-response.dto");
const save_tender_master_dto_1 = require("./dto/save-tender-master.dto");
const tender_master_exception_filter_1 = require("./tender-master-exception.filter");
const tender_master_service_1 = require("./tender-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let TenderMasterController = class TenderMasterController {
    tenderMasterService;
    constructor(tenderMasterService) {
        this.tenderMasterService = tenderMasterService;
    }
    async save(saveTenderMasterDto) {
        const data = await this.tenderMasterService.save(saveTenderMasterDto);
        return {
            success: true,
            message: saveTenderMasterDto.tndId
                ? 'Tender updated successfully'
                : 'Tender created successfully',
            data,
        };
    }
    async list() {
        const data = await this.tenderMasterService.list();
        return {
            success: true,
            message: 'Tenders fetched successfully',
            data,
        };
    }
    async getById(tndId) {
        const data = await this.tenderMasterService.getById(tndId);
        return {
            success: true,
            message: 'Tender fetched successfully',
            data,
        };
    }
    async remove(tndId) {
        const data = await this.tenderMasterService.softDelete(tndId);
        return {
            success: true,
            message: 'Tender deleted successfully',
            data,
        };
    }
};
exports.TenderMasterController = TenderMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update tender (by tndId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: tender_master_response_dto_1.TenderMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_tender_master_dto_1.SaveTenderMasterDto]),
    __metadata("design:returntype", Promise)
], TenderMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List all active tenders' }),
    (0, swagger_1.ApiQuery)({
        name: 'moduleName',
        required: false,
        schema: { type: 'string' },
        description: 'Calling screen. Accepted for the client; the list is the same with or without it.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: tender_master_response_dto_1.TenderMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TenderMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get tender by id' }),
    (0, swagger_1.ApiQuery)({ name: 'tndId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: tender_master_response_dto_1.TenderMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('tndId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenderMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete tender by id' }),
    (0, swagger_1.ApiQuery)({ name: 'tndId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: tender_master_response_dto_1.TenderMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_master_response_dto_1.TenderMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('tndId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenderMasterController.prototype, "remove", null);
exports.TenderMasterController = TenderMasterController = __decorate([
    (0, swagger_1.ApiTags)('Tender Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('tender-masters'),
    (0, common_1.UseFilters)(tender_master_exception_filter_1.TenderMasterExceptionFilter),
    __metadata("design:paramtypes", [tender_master_service_1.TenderMasterService])
], TenderMasterController);
//# sourceMappingURL=tender-master.controller.js.map