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
exports.ItemBatchStockController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const get_item_batch_stock_query_dto_1 = require("./dto/get-item-batch-stock-query.dto");
const item_batch_stock_response_dto_1 = require("./dto/item-batch-stock-response.dto");
const itemBatchStockExceptionFilter_1 = require("./itemBatchStockExceptionFilter");
const itemBatchStockService_1 = require("./itemBatchStockService");
const api_version_1 = require("../../../common/constants/api-version");
let ItemBatchStockController = class ItemBatchStockController {
    itemBatchStockService;
    constructor(itemBatchStockService) {
        this.itemBatchStockService = itemBatchStockService;
    }
    async getByScope(queryDto) {
        const data = await this.itemBatchStockService.getByScope(queryDto);
        return {
            success: true,
            message: 'Item batch stock fetched successfully',
            data,
        };
    }
};
exports.ItemBatchStockController = ItemBatchStockController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get item batch stock by exact acc year, company, branch, godown, item, and unit scope',
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_batch_stock_response_dto_1.ItemBatchStockSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_batch_stock_response_dto_1.ItemBatchStockErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_batch_stock_response_dto_1.ItemBatchStockErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_item_batch_stock_query_dto_1.GetItemBatchStockQueryDto]),
    __metadata("design:returntype", Promise)
], ItemBatchStockController.prototype, "getByScope", null);
exports.ItemBatchStockController = ItemBatchStockController = __decorate([
    (0, swagger_1.ApiTags)('Item Batch Stock'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-batch-stock'),
    (0, common_1.UseFilters)(itemBatchStockExceptionFilter_1.ItemBatchStockExceptionFilter),
    __metadata("design:paramtypes", [itemBatchStockService_1.ItemBatchStockService])
], ItemBatchStockController);
//# sourceMappingURL=itemBatchStockController.js.map