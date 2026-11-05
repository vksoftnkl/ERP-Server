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
exports.ItemsTaxHistoryMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const item_tax_history_response_dto_1 = require("./dto/item-tax-history-response.dto");
const save_item_tax_history_dto_1 = require("./dto/save-item-tax-history.dto");
const item_tax_history_exception_filter_1 = require("./item-tax-history-exception.filter");
const items_tax_history_master_service_1 = require("./items-tax-history-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsTaxHistoryMasterController = class ItemsTaxHistoryMasterController {
    itemsTaxHistoryMasterService;
    constructor(itemsTaxHistoryMasterService) {
        this.itemsTaxHistoryMasterService = itemsTaxHistoryMasterService;
    }
    async save(saveItemTaxHistoryDto) {
        const data = await this.itemsTaxHistoryMasterService.save(saveItemTaxHistoryDto);
        return {
            success: true,
            message: saveItemTaxHistoryDto.ith_id
                ? 'Item tax history updated successfully'
                : 'Item tax history created successfully',
            data,
        };
    }
    async getById(ithId) {
        const data = await this.itemsTaxHistoryMasterService.getById(ithId);
        return {
            success: true,
            message: 'Item tax history fetched successfully',
            data,
        };
    }
    async remove(ithId) {
        const data = await this.itemsTaxHistoryMasterService.delete(ithId);
        return {
            success: true,
            message: 'Item tax history deleted successfully',
            data,
        };
    }
};
exports.ItemsTaxHistoryMasterController = ItemsTaxHistoryMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item tax history (by ith_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistorySuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistoryErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistoryErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistoryErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_tax_history_dto_1.SaveItemTaxHistoryDto]),
    __metadata("design:returntype", Promise)
], ItemsTaxHistoryMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get item tax history by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ith_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistorySuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistoryErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistoryErrorResponseDto }),
    __param(0, (0, common_1.Query)('ith_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsTaxHistoryMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Delete item tax history by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ith_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistorySuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistoryErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_tax_history_response_dto_1.ItemTaxHistoryErrorResponseDto }),
    __param(0, (0, common_1.Query)('ith_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsTaxHistoryMasterController.prototype, "remove", null);
exports.ItemsTaxHistoryMasterController = ItemsTaxHistoryMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Tax History'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('item-tax-histories'),
    (0, common_1.UseFilters)(item_tax_history_exception_filter_1.ItemTaxHistoryExceptionFilter),
    __metadata("design:paramtypes", [items_tax_history_master_service_1.ItemsTaxHistoryMasterService])
], ItemsTaxHistoryMasterController);
//# sourceMappingURL=items-tax-history-master.controller.js.map