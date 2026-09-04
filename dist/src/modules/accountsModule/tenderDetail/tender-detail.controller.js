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
exports.TenderDetailController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const tender_detail_exception_filter_1 = require("./tender-detail-exception.filter");
const tender_detail_response_dto_1 = require("./dto/tender-detail-response.dto");
const get_tender_detail_query_dto_1 = require("./dto/get-tender-detail-query.dto");
const save_tender_detail_dto_1 = require("./dto/save-tender-detail.dto");
const tender_detail_service_1 = require("./tender-detail.service");
const api_version_1 = require("../../../common/constants/api-version");
let TenderDetailController = class TenderDetailController {
    tenderDetailService;
    constructor(tenderDetailService) {
        this.tenderDetailService = tenderDetailService;
    }
    async save(saveTenderDetailDto) {
        const data = await this.tenderDetailService.save(saveTenderDetailDto);
        return {
            success: true,
            message: saveTenderDetailDto.tdId
                ? 'Tender line updated successfully'
                : 'Tender line created successfully',
            data,
        };
    }
    async get(getTenderDetailQueryDto) {
        const data = await this.tenderDetailService.get(getTenderDetailQueryDto);
        return {
            success: true,
            message: Array.isArray(data)
                ? 'Tender lines fetched successfully'
                : 'Tender line fetched successfully',
            data,
        };
    }
    async remove(tdId) {
        const data = await this.tenderDetailService.softDelete(tdId);
        return {
            success: true,
            message: 'Tender line deleted successfully',
            data,
        };
    }
};
exports.TenderDetailController = TenderDetailController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update one tender line (by tdId presence)',
        description: 'A create needs tdSrcModule, tdSrcDocType, tdSrcDocId, tdCompanyId, tdBranchId, tdAccYear, ' +
            'tdDocDate, tdPartyLedgerId, tdUserId, tdDrCr and tdTenderId. An update needs tdId plus the ' +
            'fields that change; the document triple is immutable. tdTenderTypeId / tdTenderLedgerId ' +
            'default to the tender master, and tdTotalAmt is derived from tdAmount + tdSurchargeAmt.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: tender_detail_response_dto_1.TenderDetailSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_detail_response_dto_1.TenderDetailErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: tender_detail_response_dto_1.TenderDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_detail_response_dto_1.TenderDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_tender_detail_dto_1.SaveTenderDetailDto]),
    __metadata("design:returntype", Promise)
], TenderDetailController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Get one tender line by id, or a document's tender lines",
        description: 'Send either `tdId` (returns a single tender line) or all of `tdSrcModule`, `tdSrcDocType` ' +
            'and `tdSrcDocId` (returns an array ordered by tdRowNo). Soft-deleted lines are never returned.',
    }),
    (0, swagger_1.ApiExtraModels)(tender_detail_response_dto_1.TenderDetailSuccessSingleDto, tender_detail_response_dto_1.TenderDetailSuccessManyDto),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(tender_detail_response_dto_1.TenderDetailSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(tender_detail_response_dto_1.TenderDetailSuccessManyDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_detail_response_dto_1.TenderDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_detail_response_dto_1.TenderDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_tender_detail_query_dto_1.GetTenderDetailQueryDto]),
    __metadata("design:returntype", Promise)
], TenderDetailController.prototype, "get", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete one tender line by id' }),
    (0, swagger_1.ApiQuery)({ name: 'tdId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: tender_detail_response_dto_1.TenderDetailSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tender_detail_response_dto_1.TenderDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tender_detail_response_dto_1.TenderDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)('tdId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TenderDetailController.prototype, "remove", null);
exports.TenderDetailController = TenderDetailController = __decorate([
    (0, swagger_1.ApiTags)('Tender Detail'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('tender-details'),
    (0, common_1.UseFilters)(tender_detail_exception_filter_1.TenderDetailExceptionFilter),
    __metadata("design:paramtypes", [tender_detail_service_1.TenderDetailService])
], TenderDetailController);
//# sourceMappingURL=tender-detail.controller.js.map