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
exports.CostPriceBulkController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const cost_price_bulk_exception_filter_1 = require("./cost-price-bulk-exception.filter");
const cost_price_bulk_service_1 = require("./cost-price-bulk.service");
const cost_price_bulk_response_dto_1 = require("./dto/cost-price-bulk-response.dto");
const list_cost_price_bulk_query_dto_1 = require("./dto/list-cost-price-bulk-query.dto");
const save_cost_price_bulk_dto_1 = require("./dto/save-cost-price-bulk.dto");
let CostPriceBulkController = class CostPriceBulkController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list(query) {
        const data = await this.service.list(query);
        return {
            success: true,
            message: `${data.total} row${data.total === 1 ? '' : 's'} · ${data.leftOutTotal} left out`,
            data,
        };
    }
    async validate(dto) {
        const data = await this.service.validate(dto);
        return {
            success: true,
            message: data.ok
                ? 'Ready to save'
                : `${data.refusals.length} refused · ${data.warnings.length} warning${data.warnings.length === 1 ? '' : 's'}`,
            data,
        };
    }
    async save(dto) {
        const data = await this.service.save(dto);
        return { success: true, message: this.service.buildSaveMessage(data), data };
    }
};
exports.CostPriceBulkController = CostPriceBulkController;
__decorate([
    (0, common_1.Get)('cost-bulk'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "The grid — one row per unit's price row in force today, of active Plain stock items",
        description: "Plain stock: the effective track preset (the item's own, else its group's) tracks no batch, MRP, " +
            'sale price or serial (or there is none), and item_is_batch_based is off. One row per active unit ' +
            'with a headline price row in force today at this branch — the branch row, else the all-branches ' +
            'row (priceScope CHAIN). Ordered by item name, item, iuc_unit_slno; paged by rows (limit ≤ 1000). ' +
            'leftOut (page 1 only, at most 1,000; leftOutTotal / leftOutCounts count all) names the items the ' +
            'filter matched that are not Plain stock (NOT_PLAIN_STOCK, OLD_BATCH_TICK) and the units with no price ' +
            'row (NO_PRICE_ROW); the rule filter (profitType) is not applied to it. itemId = the blank-row add: ' +
            'an item that may not load answers 422 COST_BULK_INACTIVE / COST_BULK_NOT_PLAIN_STOCK / ' +
            'COST_BULK_NO_PRICE_ROW with reasonCode and trackedAs on the error; one not there, 404 ' +
            'LOOKUP_ITEM_NOT_FOUND. Needs VIEW on menu 298 (403 COST_BULK_RIGHT_VIEW).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cost_price_bulk_response_dto_1.CostBulkListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_cost_price_bulk_query_dto_1.ListCostPriceBulkQueryDto]),
    __metadata("design:returntype", Promise)
], CostPriceBulkController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('cost-bulk/validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'The dry run — every refusal and warning of the rows, nothing written',
        description: 'The same checks as the save (plan §3), with no lock and no write: refusals (COST_BULK_ROW_NOT_CURRENT, ' +
            '_INACTIVE, _NOT_PLAIN_STOCK, _ROW_CHANGED, _CHAIN_NEEDS_HQ, _ABOVE_MRP, _BELOW_MIN, and _BELOW_COST ' +
            'under inventory.below_cost_price = restrict) and warnings (_BELOW_COST under warning, ' +
            '_BY_USER_PRICES_KEPT), each {code, level, message, field, line, ipmId, overridable}. ok = a save with ' +
            'these overrides would go through. Needs EDIT on menu 298 (403 COST_BULK_RIGHT_EDIT).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cost_price_bulk_response_dto_1.CostBulkValidateSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto,
        description: 'COST_BULK_TOO_MANY_ROWS',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_cost_price_bulk_dto_1.SaveCostPriceBulkDto]),
    __metadata("design:returntype", Promise)
], CostPriceBulkController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('cost-bulk'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: "Save — today's rows updated in place, one transaction",
        description: 'Locks every row (FOR UPDATE), re-runs every check of /validate, and refuses with 422 while any ' +
            'refusal, or any warning not in overrides[], remains: errors[] then lists them, and refusals[] / ' +
            'warnings[] carry the notes for NexWarningStrip. Otherwise rewrites each changed row IN PLACE through ' +
            'PriceMasterWriter: cost, cost w/o tax, MRP, Min, the rule, and the four levels (w/o tax and markup ' +
            'recomputed from the price and the new cost — price wins); round-off, period, bucket and every other ' +
            'column untouched; no stock or qty-slab table is read or written. One Price Change Log row per written ' +
            'row (source BULK_COST_CHANGE, menu 298, one change set) and one audit row under "Item Price Master", ' +
            'in the same transaction. A row equal to what is stored is not written (unchanged). At most 1,000 rows ' +
            '(422 COST_BULK_TOO_MANY_ROWS). Needs EDIT on menu 298 (403 COST_BULK_RIGHT_EDIT).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cost_price_bulk_response_dto_1.CostBulkSaveSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: cost_price_bulk_response_dto_1.CostBulkErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_cost_price_bulk_dto_1.SaveCostPriceBulkDto]),
    __metadata("design:returntype", Promise)
], CostPriceBulkController.prototype, "save", null);
exports.CostPriceBulkController = CostPriceBulkController = __decorate([
    (0, swagger_1.ApiTags)('Cost Price – Bulk Change'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock'),
    (0, common_1.UseFilters)(cost_price_bulk_exception_filter_1.CostPriceBulkExceptionFilter),
    __metadata("design:paramtypes", [cost_price_bulk_service_1.CostPriceBulkService])
], CostPriceBulkController);
//# sourceMappingURL=cost-price-bulk.controller.js.map