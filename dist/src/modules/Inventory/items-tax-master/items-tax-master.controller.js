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
exports.ItemsTaxMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const item_tax_response_dto_1 = require("./dto/item-tax-response.dto");
const save_item_tax_dto_1 = require("./dto/save-item-tax.dto");
const item_tax_exception_filter_1 = require("./item-tax-exception.filter");
const items_tax_master_service_1 = require("./items-tax-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsTaxMasterController = class ItemsTaxMasterController {
    itemsTaxMasterService;
    constructor(itemsTaxMasterService) {
        this.itemsTaxMasterService = itemsTaxMasterService;
    }
    async save(saveItemTaxDto) {
        const data = await this.itemsTaxMasterService.save(saveItemTaxDto);
        return {
            success: true,
            message: saveItemTaxDto.tax_id
                ? 'Item tax updated successfully'
                : 'Item tax created successfully',
            data,
        };
    }
    async getById(taxId) {
        const data = await this.itemsTaxMasterService.getById(taxId);
        return {
            success: true,
            message: 'Item tax fetched successfully',
            data,
        };
    }
    async remove(taxId) {
        const { tax_id, deleted } = await this.itemsTaxMasterService.toggleDelete(taxId);
        return {
            success: true,
            message: deleted ? 'Item tax deleted successfully' : 'Item tax restored successfully',
            data: { tax_id, deleted },
        };
    }
};
exports.ItemsTaxMasterController = ItemsTaxMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item tax slab (by tax_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_tax_response_dto_1.ItemTaxSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_tax_response_dto_1.ItemTaxErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_tax_response_dto_1.ItemTaxErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_tax_response_dto_1.ItemTaxErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_tax_dto_1.SaveItemTaxDto]),
    __metadata("design:returntype", Promise)
], ItemsTaxMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get item tax by id' }),
    (0, swagger_1.ApiQuery)({ name: 'tax_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_tax_response_dto_1.ItemTaxSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_tax_response_dto_1.ItemTaxErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_tax_response_dto_1.ItemTaxErrorResponseDto }),
    __param(0, (0, common_1.Query)('tax_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsTaxMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore item tax by id' }),
    (0, swagger_1.ApiQuery)({ name: 'tax_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_tax_response_dto_1.ItemTaxSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_tax_response_dto_1.ItemTaxErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_tax_response_dto_1.ItemTaxErrorResponseDto }),
    __param(0, (0, common_1.Query)('tax_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsTaxMasterController.prototype, "remove", null);
exports.ItemsTaxMasterController = ItemsTaxMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Taxes'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('item-taxes'),
    (0, common_1.UseFilters)(item_tax_exception_filter_1.ItemTaxExceptionFilter),
    __metadata("design:paramtypes", [items_tax_master_service_1.ItemsTaxMasterService])
], ItemsTaxMasterController);
//# sourceMappingURL=items-tax-master.controller.js.map