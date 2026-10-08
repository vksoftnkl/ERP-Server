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
exports.ItemStockBalanceController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_item_batch_stock_options_query_dto_1 = require("./dto/get-item-batch-stock-options-query.dto");
const get_item_stock_balance_query_dto_1 = require("./dto/get-item-stock-balance-query.dto");
const get_bulk_item_stock_list_query_dto_1 = require("./dto/get-bulk-item-stock-list-query.dto");
const item_stock_balance_response_dto_1 = require("./dto/item-stock-balance-response.dto");
const itemStockBalanceExceptionFilter_1 = require("./itemStockBalanceExceptionFilter");
const itemstockBalanceService_1 = require("./itemstockBalanceService");
const api_version_1 = require("../../../common/constants/api-version");
let ItemStockBalanceController = class ItemStockBalanceController {
    itemStockBalanceService;
    constructor(itemStockBalanceService) {
        this.itemStockBalanceService = itemStockBalanceService;
    }
    async getByScope(queryDto) {
        const data = await this.itemStockBalanceService.getByScope(queryDto);
        return {
            success: true,
            message: 'Item stock balance fetched successfully',
            data,
        };
    }
    async getBulkList(queryDto) {
        const data = await this.itemStockBalanceService.getBulkList(queryDto);
        return {
            success: true,
            message: 'Bulk item stock list fetched successfully',
            data,
        };
    }
    async getBatchOptionsByScope(queryDto) {
        const data = await this.itemStockBalanceService.getBatchOptionsByScope(queryDto);
        return {
            success: true,
            message: 'Item batch stock options fetched successfully',
            data,
        };
    }
};
exports.ItemStockBalanceController = ItemStockBalanceController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get item stock balance by exact acc year, company, branch, godown, item, and unit scope',
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_stock_balance_response_dto_1.ItemStockBalanceSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_stock_balance_response_dto_1.ItemStockBalanceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_stock_balance_response_dto_1.ItemStockBalanceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_item_stock_balance_query_dto_1.GetItemStockBalanceQueryDto]),
    __metadata("design:returntype", Promise)
], ItemStockBalanceController.prototype, "getByScope", null);
__decorate([
    (0, common_1.Get)('bulk-list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Bulk list item stock balances with optional filters for group, brand, section, category, godown, and stock type',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Bulk item stock list fetched successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_stock_balance_response_dto_1.ItemStockBalanceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_bulk_item_stock_list_query_dto_1.GetBulkItemStockListQueryDto]),
    __metadata("design:returntype", Promise)
], ItemStockBalanceController.prototype, "getBulkList", null);
__decorate([
    (0, common_1.Get)('batch-options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Search item batch stock options by exact acc year, company, branch, godown, item, and unit scope',
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_stock_balance_response_dto_1.ItemBatchStockOptionSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_stock_balance_response_dto_1.ItemStockBalanceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_item_batch_stock_options_query_dto_1.GetItemBatchStockOptionsQueryDto]),
    __metadata("design:returntype", Promise)
], ItemStockBalanceController.prototype, "getBatchOptionsByScope", null);
exports.ItemStockBalanceController = ItemStockBalanceController = __decorate([
    (0, swagger_1.ApiTags)('Item Stock Balance'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-stock-balance'),
    (0, common_1.UseFilters)(itemStockBalanceExceptionFilter_1.ItemStockBalanceExceptionFilter),
    __metadata("design:paramtypes", [itemstockBalanceService_1.ItemStockBalanceService])
], ItemStockBalanceController);
//# sourceMappingURL=itemStockBalanceController.js.map