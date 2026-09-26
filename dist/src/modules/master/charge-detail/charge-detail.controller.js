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
exports.ChargeDetailController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const charge_detail_exception_filter_1 = require("./charge-detail-exception.filter");
const charge_detail_response_dto_1 = require("./dto/charge-detail-response.dto");
const get_charge_detail_query_dto_1 = require("./dto/get-charge-detail-query.dto");
const save_charge_detail_dto_1 = require("./dto/save-charge-detail.dto");
const charge_detail_service_1 = require("./charge-detail.service");
const api_version_1 = require("../../../common/constants/api-version");
let ChargeDetailController = class ChargeDetailController {
    chargeDetailService;
    constructor(chargeDetailService) {
        this.chargeDetailService = chargeDetailService;
    }
    async save(saveChargeDetailDto) {
        const data = await this.chargeDetailService.save(saveChargeDetailDto);
        return {
            success: true,
            message: saveChargeDetailDto.cdId
                ? 'Charge line updated successfully'
                : 'Charge line created successfully',
            data,
        };
    }
    async get(getChargeDetailQueryDto) {
        const data = await this.chargeDetailService.get(getChargeDetailQueryDto);
        return {
            success: true,
            message: Array.isArray(data)
                ? 'Charge lines fetched successfully'
                : 'Charge line fetched successfully',
            data,
        };
    }
    async remove(cdId) {
        const data = await this.chargeDetailService.softDelete(cdId);
        return {
            success: true,
            message: 'Charge line deleted successfully',
            data,
        };
    }
};
exports.ChargeDetailController = ChargeDetailController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update one applied charge line (by cdId presence)',
        description: 'A create needs cdDocType, cdDocId, cdCompId, cdBranchId, cdAccYear, cdChgId and cdLedgerCode. ' +
            'An update needs cdId plus the fields that change; cdDocType / cdDocId are immutable.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: charge_detail_response_dto_1.ChargeDetailSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: charge_detail_response_dto_1.ChargeDetailErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: charge_detail_response_dto_1.ChargeDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: charge_detail_response_dto_1.ChargeDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_charge_detail_dto_1.SaveChargeDetailDto]),
    __metadata("design:returntype", Promise)
], ChargeDetailController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Get one charge line by id, or a document's charge lines",
        description: 'Send either `cdId` (returns a single charge line) or both `cdDocType` and `cdDocId` ' +
            '(returns an array, ordered by cdSlno with unnumbered lines last). Soft-deleted lines are ' +
            'never returned; pass `isActive` on a document lookup to filter on cd_is_active.',
    }),
    (0, swagger_1.ApiExtraModels)(charge_detail_response_dto_1.ChargeDetailSuccessSingleDto, charge_detail_response_dto_1.ChargeDetailSuccessManyDto),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(charge_detail_response_dto_1.ChargeDetailSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(charge_detail_response_dto_1.ChargeDetailSuccessManyDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: charge_detail_response_dto_1.ChargeDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: charge_detail_response_dto_1.ChargeDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_charge_detail_query_dto_1.GetChargeDetailQueryDto]),
    __metadata("design:returntype", Promise)
], ChargeDetailController.prototype, "get", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete one charge line by id' }),
    (0, swagger_1.ApiQuery)({ name: 'cdId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: charge_detail_response_dto_1.ChargeDetailSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: charge_detail_response_dto_1.ChargeDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: charge_detail_response_dto_1.ChargeDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)('cdId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChargeDetailController.prototype, "remove", null);
exports.ChargeDetailController = ChargeDetailController = __decorate([
    (0, swagger_1.ApiTags)('Charge Detail'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('charge-details'),
    (0, common_1.UseFilters)(charge_detail_exception_filter_1.ChargeDetailExceptionFilter),
    __metadata("design:paramtypes", [charge_detail_service_1.ChargeDetailService])
], ChargeDetailController);
//# sourceMappingURL=charge-detail.controller.js.map