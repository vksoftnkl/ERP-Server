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
exports.ItemsCustRatesMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const item_cust_rate_response_dto_1 = require("./dto/item-cust-rate-response.dto");
const list_item_cust_rate_query_dto_1 = require("./dto/list-item-cust-rate-query.dto");
const save_item_cust_rate_dto_1 = require("./dto/save-item-cust-rate.dto");
const item_cust_rate_exception_filter_1 = require("./item-cust-rate-exception.filter");
const items_cust_rates_master_service_1 = require("./items-cust-rates-master.service");
const api_version_1 = require("../../common/constants/api-version");
let ItemsCustRatesMasterController = class ItemsCustRatesMasterController {
    itemsCustRatesMasterService;
    constructor(itemsCustRatesMasterService) {
        this.itemsCustRatesMasterService = itemsCustRatesMasterService;
    }
    async save(saveItemCustRateDto) {
        const data = await this.itemsCustRatesMasterService.save(saveItemCustRateDto);
        return {
            success: true,
            message: saveItemCustRateDto.csr_id
                ? 'Item customer rate updated successfully'
                : 'Item customer rate created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.itemsCustRatesMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item customer rates fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(csrId) {
        const data = await this.itemsCustRatesMasterService.getById(csrId);
        return {
            success: true,
            message: 'Item customer rate fetched successfully',
            data,
        };
    }
    async remove(csrId) {
        const data = await this.itemsCustRatesMasterService.softDelete(csrId);
        return {
            success: true,
            message: 'Item customer rate deleted successfully',
            data,
        };
    }
};
exports.ItemsCustRatesMasterController = ItemsCustRatesMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update customer item rate (by csr_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_cust_rate_dto_1.SaveItemCustRateDto]),
    __metadata("design:returntype", Promise)
], ItemsCustRatesMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List item customer rates with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_item_cust_rate_query_dto_1.ListItemCustRateQueryDto]),
    __metadata("design:returntype", Promise)
], ItemsCustRatesMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get item customer rate by id' }),
    (0, swagger_1.ApiQuery)({ name: 'csr_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    __param(0, (0, common_1.Query)('csr_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsCustRatesMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete item customer rate by id' }),
    (0, swagger_1.ApiQuery)({ name: 'csr_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_cust_rate_response_dto_1.ItemCustRateErrorResponseDto }),
    __param(0, (0, common_1.Query)('csr_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsCustRatesMasterController.prototype, "remove", null);
exports.ItemsCustRatesMasterController = ItemsCustRatesMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Customer Rates'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-cust-rates'),
    (0, common_1.UseFilters)(item_cust_rate_exception_filter_1.ItemCustRateExceptionFilter),
    __metadata("design:paramtypes", [items_cust_rates_master_service_1.ItemsCustRatesMasterService])
], ItemsCustRatesMasterController);
//# sourceMappingURL=items-cust-rates-master.controller.js.map