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
exports.ItemPriceDetailsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_payload_validation_util_1 = require("../../../common/utils/request-payload-validation.util");
const item_response_dto_1 = require("../items-master/dto/item-response.dto");
const item_price_response_dto_1 = require("../items-price-master/dto/item-price-response.dto");
const item_tax_response_dto_1 = require("../items-tax-master/dto/item-tax-response.dto");
const get_item_price_detail_query_dto_1 = require("./dto/get-item-price-detail-query.dto");
const item_price_detail_response_dto_1 = require("./dto/item-price-detail-response.dto");
const item_price_detail_exception_filter_1 = require("./item-price-detail-exception.filter");
const item_price_details_service_1 = require("./item-price-details.service");
const api_version_1 = require("../../../common/constants/api-version");
let ItemPriceDetailsController = class ItemPriceDetailsController {
    itemPriceDetailsService;
    constructor(itemPriceDetailsService) {
        this.itemPriceDetailsService = itemPriceDetailsService;
    }
    async getByItemId(query) {
        const dto = (await (0, request_payload_validation_util_1.validateDto)(query, get_item_price_detail_query_dto_1.GetItemPriceDetailQueryDto, {
            type: 'query',
        }));
        const data = await this.itemPriceDetailsService.getByItemId(dto.item_id);
        return {
            success: true,
            message: 'Item price details fetched successfully',
            data,
        };
    }
    async getByBarcode(query) {
        const dto = (await (0, request_payload_validation_util_1.validateDto)(query, get_item_price_detail_query_dto_1.GetItemPriceDetailByBarcodeQueryDto, {
            type: 'query',
        }));
        const data = await this.itemPriceDetailsService.getByBarcode(dto.barcode);
        return {
            success: true,
            message: 'Item price details fetched successfully',
            data,
        };
    }
};
exports.ItemPriceDetailsController = ItemPriceDetailsController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get item with joined item price and item tax details' }),
    (0, swagger_1.ApiQuery)({
        name: 'item_id',
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_price_detail_response_dto_1.ItemPriceDetailSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_price_detail_response_dto_1.ItemPriceDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_price_detail_response_dto_1.ItemPriceDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemPriceDetailsController.prototype, "getByItemId", null);
__decorate([
    (0, common_1.Get)('get-by-barcode'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get item price details by barcode' }),
    (0, swagger_1.ApiQuery)({ name: 'barcode', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_price_detail_response_dto_1.ItemPriceDetailSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_price_detail_response_dto_1.ItemPriceDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_price_detail_response_dto_1.ItemPriceDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemPriceDetailsController.prototype, "getByBarcode", null);
exports.ItemPriceDetailsController = ItemPriceDetailsController = __decorate([
    (0, swagger_1.ApiTags)('Item Price Details'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiExtraModels)(item_response_dto_1.ItemPayloadDto, item_price_response_dto_1.ItemPricePayloadDto, item_tax_response_dto_1.ItemTaxPayloadDto, item_price_detail_response_dto_1.ItemPriceDetailPayloadDto),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-price-details'),
    (0, common_1.UseFilters)(item_price_detail_exception_filter_1.ItemPriceDetailExceptionFilter),
    __metadata("design:paramtypes", [item_price_details_service_1.ItemPriceDetailsService])
], ItemPriceDetailsController);
//# sourceMappingURL=item-price-details.controller.js.map