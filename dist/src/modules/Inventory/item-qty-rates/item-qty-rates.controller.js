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
exports.ItemQtyRatesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_item_qty_rates_query_dto_1 = require("./dto/get-item-qty-rates-query.dto");
const item_qty_rates_response_dto_1 = require("./dto/item-qty-rates-response.dto");
const save_item_qty_rates_dto_1 = require("./dto/save-item-qty-rates.dto");
const item_qty_rates_exception_filter_1 = require("./item-qty-rates-exception.filter");
const item_qty_rates_service_1 = require("./item-qty-rates.service");
let ItemQtyRatesController = class ItemQtyRatesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async getWithRates(query) {
        const data = await this.service.getWithRates(query);
        return {
            success: true,
            message: `${data.units.length} card row${data.units.length === 1 ? '' : 's'}, ${data.slabs.length} slab${data.slabs.length === 1 ? '' : 's'}`,
            data,
        };
    }
    async saveWithRates(dto) {
        const data = await this.service.saveWithRates(dto);
        return { success: true, message: this.service.buildSaveMessage(data), data };
    }
};
exports.ItemQtyRatesController = ItemQtyRatesController;
__decorate([
    (0, common_1.Get)('get-with-rates'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "One item's cost + card rate (this branch, today) and its qty slabs, for menu 244",
        description: "item: eligibility by Cost Price – Bulk Change's rule (plainStock, trackedAs, leftOutReason). " +
            'rights: menu 244 view / createSlab / editSlab / deleteSlab, menu 30 editCard, allBranchSlab ' +
            '(HQ user type). levels: the ACTIVE price levels 1–4 (fixed.price_levels). units: the ' +
            '/stock/price-bulk grid rows of the item (one per active unit × live bucket, the headline ' +
            'when the item tracks none) plus the unit chain (parentUomId, unitsPerParent, factorsAgree), ' +
            "the answering row's own cost (rowCost / rowCostWot) beside the stock average (stockAvg), " +
            'cardCost (what the Cost column shows and slabs are judged by), profitType, costEditable / ' +
            'mrpEditable (Plain-stock headline row with menu 30 EDIT) and scheduledFrom. slabs: every ' +
            'live slab of the item, all scopes, as /item-qty-prices/get answers them. 403 ' +
            'ITEM_QTY_PRICE_RIGHT_VIEW without menu 244 VIEW; 404 LOOKUP_ITEM_NOT_FOUND for an item not ' +
            'there at this company and branch.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_qty_rates_response_dto_1.QtyRatesViewSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_item_qty_rates_query_dto_1.GetItemQtyRatesQueryDto]),
    __metadata("design:returntype", Promise)
], ItemQtyRatesController.prototype, "getWithRates", null);
__decorate([
    (0, common_1.Post)('save-with-rates'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Save the card rows, the slabs and the slab deletes in ONE transaction',
        description: 'Rights first (403): menu 244 VIEW; CREATE for a slab without iqp_id, EDIT with one, DELETE ' +
            'for deleteSlabIds; menu 30 EDIT for any rates.rows (STOCK_PRICE_RIGHT_EDIT). Shape: nothing ' +
            'to save 400 ITEM_QTY_PRICE_NOTHING_TO_SAVE; a slab of another item 400 _ITEM_MISMATCH; an id ' +
            'twice 400 VALIDATION_ARRAY_UNIQUE; a level not blank / active 1–4 422 _LEVEL_NOT_SELLING; a ' +
            'slab for all branches from a non-HQ user type 403 _CHAIN_HQ_ONLY. Then, nothing written: ' +
            'costPrice / maxPrice on an item that is not Plain stock 422 _COST_NOT_PLAIN_STOCK / ' +
            "_MRP_NOT_PLAIN_STOCK; Change Selling Price's checks (422 STOCK_PRICE_*); a headline's prices " +
            'above its MRP after the save 422 ITEM_QTY_PRICE_ABOVE_MRP; every live slab in force today or ' +
            'later at this company / branch judged against the card after the save — zero or less, above ' +
            'MRP, below Min refuse (422), below cost by inventory.below_cost_price (restrict 422, warning ' +
            'asks, allow reports); a By User unit whose cost changed and prices did not asks. A refusal ' +
            'answers 422 with errors[] and problems[]; an ask answers 200 needsConfirm with problems[] ' +
            '(re-post with confirmed: true). Then deletes, the card (this branch, from today, logged ' +
            'CHANGE_SELLING_PRICE "via Qty-wise Prices (menu 244)"), the slabs; a slab overlap (409 ' +
            'ITEM_QTY_PRICE_OVERLAP) rolls everything back.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_qty_rates_response_dto_1.QtyRatesSaveSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_qty_rates_dto_1.SaveItemQtyRatesDto]),
    __metadata("design:returntype", Promise)
], ItemQtyRatesController.prototype, "saveWithRates", null);
exports.ItemQtyRatesController = ItemQtyRatesController = __decorate([
    (0, swagger_1.ApiTags)('Item Qty Prices'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('item-qty-prices'),
    (0, common_1.UseFilters)(item_qty_rates_exception_filter_1.ItemQtyRatesExceptionFilter),
    __metadata("design:paramtypes", [item_qty_rates_service_1.ItemQtyRatesService])
], ItemQtyRatesController);
//# sourceMappingURL=item-qty-rates.controller.js.map