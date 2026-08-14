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
exports.ItemsMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const item_response_dto_1 = require("./dto/item-response.dto");
const item_composite_response_dto_1 = require("./dto/item-composite-response.dto");
const save_item_composite_dto_1 = require("./dto/save-item-composite.dto");
const item_exception_filter_1 = require("./item-exception.filter");
const items_master_service_1 = require("./items-master.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsMasterController = class ItemsMasterController {
    itemsMasterService;
    constructor(itemsMasterService) {
        this.itemsMasterService = itemsMasterService;
    }
    async save(saveItemDto) {
        const data = await this.itemsMasterService.saveComposite(saveItemDto);
        return {
            success: true,
            message: saveItemDto.item_id ? 'Item updated successfully' : 'Item created successfully',
            data,
        };
    }
    async getById(itemId) {
        const data = await this.itemsMasterService.getComposite(itemId);
        return {
            success: true,
            message: 'Item fetched successfully',
            data,
        };
    }
    async bulkLoad(itemCompanyId, itemBranchId, godownId, itemGroupId, itemBrandId, itemSectionId, itemCategoryId, limit, uiTableId, uiColumnId) {
        const data = await this.itemsMasterService.listForBulkLoad({
            itemCompanyId,
            itemBranchId,
            godownId,
            itemGroupId,
            itemBrandId,
            itemSectionId,
            itemCategoryId,
            limit,
            uiTableId,
            uiColumnId,
        });
        return { success: true, message: 'Items fetched successfully', data };
    }
    async remove(itemId) {
        const data = await this.itemsMasterService.toggleDeleteComposite(itemId);
        return {
            success: true,
            message: data.item.deleted ? 'Item deleted successfully' : 'Item restored successfully',
            data,
        };
    }
};
exports.ItemsMasterController = ItemsMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update an item, optionally with its unit conversions, prices, EAN codes and reorders',
        description: 'Item fields are sent at the top level (create vs update by item_id presence). Optionally include ' +
            'unit_conversions[], prices[], ean_codes[] and/or reorders[] to save them in the same call. ' +
            'Each provided child collection is DIFF-SYNCED against the item\'s existing rows by natural key ' +
            '(EAN: ean_code; conversions: iuc_unit_id; prices: ipm_uc_unit_id+ipm_godown_id; reorders: ' +
            'ir_unit_id+ir_godown_id): new rows are created, matched rows are updated when a field differs, ' +
            'and existing rows absent from the payload are SOFT-DELETED. Omitting a child array leaves that ' +
            'table untouched; an empty array soft-deletes all of its rows. Saving is NON-ATOMIC: the item is ' +
            'saved first, then each child collection in dependency order (unit-conversions, prices, EAN ' +
            'codes, reorders); the parent item_id is injected into every child row.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_composite_response_dto_1.ItemCompositeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_response_dto_1.ItemErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_response_dto_1.ItemErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_response_dto_1.ItemErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_composite_dto_1.SaveItemCompositeDto]),
    __metadata("design:returntype", Promise)
], ItemsMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get an item by id with its unit conversions, prices, EAN codes and reorders',
    }),
    (0, swagger_1.ApiQuery)({ name: 'item_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_composite_response_dto_1.ItemCompositeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_response_dto_1.ItemErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_response_dto_1.ItemErrorResponseDto }),
    __param(0, (0, common_1.Query)('item_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('bulk-load'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List items with default price for bulk opening-stock load' }),
    (0, swagger_1.ApiQuery)({ name: 'item_company_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'item_branch_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'godown_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'item_group_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'item_brand_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'item_section_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'item_category_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, schema: { type: 'integer' } }),
    (0, swagger_1.ApiQuery)({ name: 'ui_table_id', required: false, description: 'UI table id for column configuration', schema: { type: 'string' } }),
    (0, swagger_1.ApiQuery)({ name: 'ui_column_id', required: false, description: 'UI column id for column configuration', schema: { type: 'string' } }),
    (0, swagger_1.ApiOkResponse)({ description: 'Bulk load items list' }),
    __param(0, (0, common_1.Query)('item_company_id')),
    __param(1, (0, common_1.Query)('item_branch_id')),
    __param(2, (0, common_1.Query)('godown_id')),
    __param(3, (0, common_1.Query)('item_group_id')),
    __param(4, (0, common_1.Query)('item_brand_id')),
    __param(5, (0, common_1.Query)('item_section_id')),
    __param(6, (0, common_1.Query)('item_category_id')),
    __param(7, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __param(8, (0, common_1.Query)('ui_table_id')),
    __param(9, (0, common_1.Query)('ui_column_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, Number, String, String]),
    __metadata("design:returntype", Promise)
], ItemsMasterController.prototype, "bulkLoad", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete or restore an item by id, cascading to its unit conversions, prices, EAN codes and reorders',
        description: 'Toggles the item (delete if active, restore if deleted), then cascades the same target state to ' +
            'all of its child rows: children currently in the item\'s old state are flipped, children already ' +
            'in the target state are left untouched. NON-ATOMIC: the item is toggled first, then each child ' +
            'collection in its own transaction.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'item_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_composite_response_dto_1.ItemCompositeSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_response_dto_1.ItemErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_response_dto_1.ItemErrorResponseDto }),
    __param(0, (0, common_1.Query)('item_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsMasterController.prototype, "remove", null);
exports.ItemsMasterController = ItemsMasterController = __decorate([
    (0, swagger_1.ApiTags)('Items'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('items'),
    (0, common_1.UseFilters)(item_exception_filter_1.ItemExceptionFilter),
    __metadata("design:paramtypes", [items_master_service_1.ItemsMasterService])
], ItemsMasterController);
//# sourceMappingURL=items-master.controller.js.map