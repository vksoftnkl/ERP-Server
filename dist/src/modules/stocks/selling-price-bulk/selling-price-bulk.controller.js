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
exports.SellingPriceBulkController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const dtoDecorators_1 = require("../../../common/dto/dtoDecorators");
const selling_price_bulk_exception_filter_1 = require("./selling-price-bulk-exception.filter");
const selling_price_bulk_service_1 = require("./selling-price-bulk.service");
const list_selling_price_query_dto_1 = require("./dto/list-selling-price-query.dto");
const price_buckets_query_dto_1 = require("./dto/price-buckets-query.dto");
const save_selling_price_bulk_dto_1 = require("./dto/save-selling-price-bulk.dto");
const selling_price_bulk_response_dto_1 = require("./dto/selling-price-bulk-response.dto");
class PriceBucketsParamDto {
    itemId;
}
__decorate([
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], PriceBucketsParamDto.prototype, "itemId", void 0);
let SellingPriceBulkController = class SellingPriceBulkController {
    sellingPriceBulkService;
    constructor(sellingPriceBulkService) {
        this.sellingPriceBulkService = sellingPriceBulkService;
    }
    async listPrices(queryDto) {
        const data = await this.sellingPriceBulkService.listPrices(queryDto);
        return {
            success: true,
            message: `${data.items.length} row${data.items.length === 1 ? '' : 's'} loaded`,
            data,
        };
    }
    async listBuckets(params, queryDto) {
        const data = await this.sellingPriceBulkService.listBuckets(params.itemId, queryDto);
        return {
            success: true,
            message: `${data.length} price row${data.length === 1 ? '' : 's'} found`,
            data,
        };
    }
    async saveBulk(dto) {
        const data = await this.sellingPriceBulkService.saveBulk(dto);
        return {
            success: true,
            message: this.sellingPriceBulkService.buildSaveMessage(data),
            data,
        };
    }
};
exports.SellingPriceBulkController = SellingPriceBulkController;
__decorate([
    (0, common_1.Get)('price-bulk'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The price grid — one row per (item × uom × live bucket) with stock',
        description: 'Buckets are the (MRP, sale price) pairs of the stock on hand at the branch, blanked by ' +
            "the item's stock track policy — an item that tracks neither has one bucket, its " +
            'headline. Items with no live bucket come back once per unit as the headline, both ' +
            'dimensions blank. priceSource / priceScope / bucketId are what the price resolver ' +
            'answers: the exact bucket row before the headline, a branch row before the chain row. ' +
            "stockQty is in the row's own unit. Paged, because a group filter over a 40,000-row item master with four buckets " +
            'each is not a grid; F8 exists so the operator narrows before loading. taxPerc is ' +
            'resolved server-side as of today through item_tax_history, so the client never has to ' +
            'ask which tax row applied. itemId narrows the grid to one item (the Add item search). ' +
            'The filter popup (notes 76): search (contains, on code / name / alias / barcode), ' +
            "itemCategoryId, trackPresetId (the effective preset — own, else the group's), taxId, and " +
            'activeOnly (default true). Every row carries barcode and costWot.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: selling_price_bulk_response_dto_1.SellingPriceListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: selling_price_bulk_response_dto_1.SellingPriceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_selling_price_query_dto_1.ListSellingPriceQueryDto]),
    __metadata("design:returntype", Promise)
], SellingPriceBulkController.prototype, "listPrices", null);
__decorate([
    (0, common_1.Get)('price-buckets/:itemId'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'F12 — every live price row of one item this branch can see, and every unpriced stock bucket',
        description: "The chain rows and this branch's own, never another branch's: the headline first, " +
            'then by MRP and sale price, the chain row before the branch override of the same ' +
            'bucket. The grid shows only the row that wins at this branch; this list shows both, so ' +
            'the operator sees what an edit hides. Also every bucket with stock at this branch that ' +
            'has no row of its own (a received MRP nobody has priced yet), per unit, priced exactly as ' +
            "the grid prices it: priceSource MASTER with the headline's prices and cost, bucketId the " +
            "headline's (null when there is none). stockQty is the stock on hand for each row's own " +
            "bucket at this branch, in the row's unit. Every row carries its own values complete, so " +
            'picking one resets the client row wholesale rather than merging into what was there.',
    }),
    (0, swagger_1.ApiParam)({ name: 'itemId', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: selling_price_bulk_response_dto_1.SellingPriceBucketsSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: selling_price_bulk_response_dto_1.SellingPriceErrorResponseDto }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PriceBucketsParamDto,
        price_buckets_query_dto_1.PriceBucketsQueryDto]),
    __metadata("design:returntype", Promise)
], SellingPriceBulkController.prototype, "listBuckets", null);
__decorate([
    (0, common_1.Post)('price-bulk'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save the changed rows — one transaction, one commit',
        description: 'Send CHANGED rows only. Validation runs before any write; above-MRP and below-min ' +
            'always abort with 422 and the row list, while below-cost consults ' +
            'inventory.below_cost_price (restrict → 422, warning → 200 with needsConfirm, allow → ' +
            'writes and still reports). A confirmed re-post re-runs the validation, because cost ' +
            'moves when a purchase posts and the confirm is the user agreeing to the price rather ' +
            'than to a cost figure. Every row lands in inventory.item_price_master: its MRP / sale ' +
            "price are blanked by the item's stock track policy first, so a row with neither is the " +
            'headline, saved by the same statements. Two rows naming one bucket at one scope are a ' +
            '422. Missing attributes of a new bucket row (godown, cess, loading, freight, loyalty) ' +
            'are copied from the headline.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: selling_price_bulk_response_dto_1.SellingPriceSaveSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: selling_price_bulk_response_dto_1.SellingPriceErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: selling_price_bulk_response_dto_1.SellingPriceErrorResponseDto,
        description: 'scope: CHAIN from a caller whose user type is not HQ. Never downgraded silently.',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: selling_price_bulk_response_dto_1.SellingPriceErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: selling_price_bulk_response_dto_1.SellingPriceErrorResponseDto,
        description: 'ex_ipm_overlap (23P01) — another price already covers this bucket and period.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_selling_price_bulk_dto_1.SaveSellingPriceBulkDto]),
    __metadata("design:returntype", Promise)
], SellingPriceBulkController.prototype, "saveBulk", null);
exports.SellingPriceBulkController = SellingPriceBulkController = __decorate([
    (0, swagger_1.ApiTags)('Change Selling Price'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('stock'),
    (0, common_1.UseFilters)(selling_price_bulk_exception_filter_1.SellingPriceBulkExceptionFilter),
    __metadata("design:paramtypes", [selling_price_bulk_service_1.SellingPriceBulkService])
], SellingPriceBulkController);
//# sourceMappingURL=selling-price-bulk.controller.js.map