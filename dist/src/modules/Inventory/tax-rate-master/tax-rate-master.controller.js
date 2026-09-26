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
exports.TaxRateMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const save_tax_rate_dto_1 = require("./dto/save-tax-rate.dto");
const tax_rate_query_dto_1 = require("./dto/tax-rate-query.dto");
const tax_rate_response_dto_1 = require("./dto/tax-rate-response.dto");
const tax_rate_master_exception_filter_1 = require("./tax-rate-master-exception.filter");
const tax_rate_master_service_1 = require("./tax-rate-master.service");
let TaxRateMasterController = class TaxRateMasterController {
    taxRateMasterService;
    constructor(taxRateMasterService) {
        this.taxRateMasterService = taxRateMasterService;
    }
    async save(dto) {
        const data = await this.taxRateMasterService.save(dto);
        return {
            success: true,
            message: dto.tax_id ? 'Tax rate updated successfully' : 'Tax rate created successfully',
            data,
        };
    }
    async getById(query) {
        const data = await this.taxRateMasterService.getById(query.tax_id);
        return { success: true, message: 'Tax rate fetched successfully', data };
    }
    async list(query) {
        const data = await this.taxRateMasterService.list(query);
        return { success: true, message: 'Tax rates fetched successfully', data };
    }
    async resolve(query) {
        const data = await this.taxRateMasterService.resolveLedgers(query);
        return { success: true, message: 'Tax rate ledgers resolved successfully', data };
    }
    async remove(query) {
        const data = await this.taxRateMasterService.softDelete(query.tax_id, query.tax_modified_by);
        return { success: true, message: 'Tax rate deleted successfully', data };
    }
};
exports.TaxRateMasterController = TaxRateMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a whole GST rate — header and ledger overrides — in one call',
        description: 'Object payload. Omit tax_id to create, send it to update — on update only the keys ' +
            'present in the body are written.\n\n' +
            'The `lines` array is optional and saves with the header in the same transaction. An ' +
            'array that is present REPLACES the grid: lines carrying trl_id are updated, lines ' +
            'without one are inserted, and lines already on the rate but missing from the array are ' +
            'soft deleted. Omit the key to leave the grid untouched — `"lines": []` means "delete ' +
            'every override", which is not the same thing.\n\n' +
            'A rate with NO lines is the normal case and a complete configuration: it posts wherever ' +
            'accounts.acc_ledger_map says. Lines exist only where a rate genuinely differs.\n\n' +
            'tax_cgst_perc / tax_sgst_perc / tax_igst_perc are GENERATED from tax_rate_perc by the ' +
            'database and are not accepted here.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: tax_rate_response_dto_1.TaxRateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_tax_rate_dto_1.SaveTaxRateDto]),
    __metadata("design:returntype", Promise)
], TaxRateMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get one GST rate with its ledger overrides',
        description: 'Returns the same shape POST /create accepts, ready to edit and post back. Deactivated ' +
            'lines are included so the screen can switch them back on; deleted ones are not.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: tax_rate_response_dto_1.TaxRateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tax_rate_query_dto_1.TaxRateIdQueryDto]),
    __metadata("design:returntype", Promise)
], TaxRateMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'List GST rates, each one whole',
        description: 'Every filter is optional and narrows independently, so a bare /list is every live rate ' +
            'there is, ordered by tax_sort_order then tax_name.\n\n' +
            'tax_is_deleted = false is NOT a parameter and cannot be turned off. active_only defaults ' +
            'to true and is the one part of that a maintenance screen may relax; it applies to the ' +
            'lines as well as the header, so an inactive override is absent rather than flagged.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: tax_rate_response_dto_1.TaxRateSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tax_rate_query_dto_1.ListTaxRateQueryDto]),
    __metadata("design:returntype", Promise)
], TaxRateMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('resolve'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Where this rate actually posts — every role it can influence, resolved',
        description: 'GET /get returns the overrides the grid carries and says nothing about the rest. This ' +
            'asks the resolver the question posting will ask, for every role the catalogue marks ' +
            'alr_by_rate.\n\n' +
            'Each row comes back with a `source`: OVERRIDE where this rate carries a row of its own, ' +
            'DEFAULT where it inherits accounts.acc_ledger_map, and UNMAPPED where neither answers — ' +
            'the one state that makes a voucher touching that role unpostable.\n\n' +
            'Round-off, discount, write-off and advances are deliberately absent: they have one ' +
            'answer for the whole business and a rate has no opinion about them.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: tax_rate_response_dto_1.TaxRateSuccessResolveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tax_rate_query_dto_1.ResolveTaxRateQueryDto]),
    __metadata("design:returntype", Promise)
], TaxRateMasterController.prototype, "resolve", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a GST rate and every one of its ledger overrides',
        description: 'Soft delete only — a rate that has priced a bill is never removed. Deleting frees the ' +
            'name and code for reuse, which is what the partial unique indexes are for.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: tax_rate_response_dto_1.TaxRateSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: tax_rate_response_dto_1.TaxRateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tax_rate_query_dto_1.DeleteTaxRateQueryDto]),
    __metadata("design:returntype", Promise)
], TaxRateMasterController.prototype, "remove", null);
exports.TaxRateMasterController = TaxRateMasterController = __decorate([
    (0, swagger_1.ApiTags)('Tax Rate Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('tax-rates'),
    (0, common_1.UseFilters)(tax_rate_master_exception_filter_1.TaxRateMasterExceptionFilter),
    __metadata("design:paramtypes", [tax_rate_master_service_1.TaxRateMasterService])
], TaxRateMasterController);
//# sourceMappingURL=tax-rate-master.controller.js.map