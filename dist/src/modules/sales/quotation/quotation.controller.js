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
exports.QuotationController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const quotation_exception_filter_1 = require("./quotation-exception.filter");
const quotation_service_1 = require("./quotation.service");
const save_quotation_dto_1 = require("./dto/save-quotation.dto");
const quotation_response_dto_1 = require("./dto/quotation-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let QuotationController = class QuotationController {
    quotationService;
    constructor(quotationService) {
        this.quotationService = quotationService;
    }
    async save(saveQuotationDto) {
        const data = await this.quotationService.save(saveQuotationDto);
        return {
            success: true,
            message: saveQuotationDto.sqId
                ? 'Quotation updated successfully'
                : 'Quotation created successfully',
            data,
        };
    }
    async getById(sqId, sqCompanyId, sqBranchId, sqAccYear) {
        const data = await this.quotationService.getById(sqId, sqCompanyId, sqBranchId, sqAccYear);
        return {
            success: true,
            message: 'Quotation fetched successfully',
            data,
        };
    }
    async remove(sqId, sqCompanyId, sqBranchId, sqAccYear) {
        const data = await this.quotationService.softDelete(sqId, sqCompanyId, sqBranchId, sqAccYear);
        return {
            success: true,
            message: 'Quotation deleted successfully',
            data,
        };
    }
};
exports.QuotationController = QuotationController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update quotation (by sqId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: quotation_response_dto_1.QuotationSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: quotation_response_dto_1.QuotationErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: quotation_response_dto_1.QuotationErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: quotation_response_dto_1.QuotationErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_quotation_dto_1.SaveQuotationDto]),
    __metadata("design:returntype", Promise)
], QuotationController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get quotation by id' }),
    (0, swagger_1.ApiQuery)({ name: 'sqId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sqCompanyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sqBranchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sqAccYear', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ type: quotation_response_dto_1.QuotationSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: quotation_response_dto_1.QuotationErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: quotation_response_dto_1.QuotationErrorResponseDto }),
    __param(0, (0, common_1.Query)('sqId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sqCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('sqBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('sqAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], QuotationController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete quotation by id' }),
    (0, swagger_1.ApiQuery)({ name: 'sqId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sqCompanyId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sqBranchId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'sqAccYear', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ type: quotation_response_dto_1.QuotationSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: quotation_response_dto_1.QuotationErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: quotation_response_dto_1.QuotationErrorResponseDto }),
    __param(0, (0, common_1.Query)('sqId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(1, (0, common_1.Query)('sqCompanyId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(2, (0, common_1.Query)('sqBranchId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __param(3, (0, common_1.Query)('sqAccYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], QuotationController.prototype, "remove", null);
exports.QuotationController = QuotationController = __decorate([
    (0, swagger_1.ApiTags)('Quotations'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('quotations'),
    (0, common_1.UseFilters)(quotation_exception_filter_1.QuotationExceptionFilter),
    __metadata("design:paramtypes", [quotation_service_1.QuotationService])
], QuotationController);
//# sourceMappingURL=quotation.controller.js.map