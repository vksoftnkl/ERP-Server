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
exports.StockAdjReasonsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_stock_adj_reasons_query_dto_1 = require("./dto/get-stock-adj-reasons-query.dto");
const stock_adj_reasons_response_dto_1 = require("./dto/stock-adj-reasons-response.dto");
const stock_adj_reasons_service_1 = require("./stock-adj-reasons.service");
let StockAdjReasonsController = class StockAdjReasonsController {
    stockAdjReasonsService;
    constructor(stockAdjReasonsService) {
        this.stockAdjReasonsService = stockAdjReasonsService;
    }
    async get(queryDto) {
        const result = await this.stockAdjReasonsService.get(queryDto);
        return {
            success: true,
            message: queryDto.sarId !== undefined
                ? 'Stock adjustment reason fetched successfully'
                : 'Stock adjustment reasons fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
};
exports.StockAdjReasonsController = StockAdjReasonsController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get stock adjustment reasons from fixed.stock_adj_reasons by sarId, sarCode, sarReasonKind or filters. Defaults to active and non-deleted.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: stock_adj_reasons_response_dto_1.StockAdjReasonsSuccessGetDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: stock_adj_reasons_response_dto_1.StockAdjReasonsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: stock_adj_reasons_response_dto_1.StockAdjReasonsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_stock_adj_reasons_query_dto_1.GetStockAdjReasonsQueryDto]),
    __metadata("design:returntype", Promise)
], StockAdjReasonsController.prototype, "get", null);
exports.StockAdjReasonsController = StockAdjReasonsController = __decorate([
    (0, swagger_1.ApiTags)('Stock Adj Reasons'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('stock-adj-reasons'),
    __metadata("design:paramtypes", [stock_adj_reasons_service_1.StockAdjReasonsService])
], StockAdjReasonsController);
//# sourceMappingURL=stock-adj-reasons.controller.js.map