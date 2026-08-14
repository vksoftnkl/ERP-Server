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
exports.GridDetailsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const list_grid_detail_query_dto_1 = require("./dto/list-grid-detail-query.dto");
const grid_detail_response_dto_1 = require("./dto/grid-detail-response.dto");
const save_grid_detail_dto_1 = require("./dto/save-grid-detail.dto");
const save_column_width_dto_1 = require("./dto/save-column-width.dto");
const save_filter_settings_dto_1 = require("./dto/save-filter-settings.dto");
const save_visibility_settings_dto_1 = require("./dto/save-visibility-settings.dto");
const grid_detail_exception_filter_1 = require("./grid-detail-exception.filter");
const grid_details_service_1 = require("./grid-details.service");
const api_version_1 = require("../../common/constants/api-version");
const gridDetailsCreateExample = {
    grid_id: '17',
    grid_name: 'Item Master Grid',
    grid_description: 'Item master grid configuration',
    grid_sort_column: 'item_name',
    grid_sort_order: 'asc',
    grid_sql: 'SELECT item_id, item_name FROM inventory.item_master',
    grid_status: true,
    grid_device_type: 'desktop',
    grid_columns: [
        {
            grid_column_id: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001',
            grid_column_number: 1,
            grid_column_name: 'Item Name',
            grid_column_width: 180,
            grid_column_position: 1,
            grid_column_alignment: 'left',
            grid_column_visibility: true,
            grid_column_filter: false,
            grid_column_condition: null,
            grid_column_condition_color: null,
            grid_column_group: false,
            grid_column_total: false,
            grid_column_data_type: 'string',
            grid_column_color: null,
            grid_column_notes: null,
            grid_column_sql_field_name: 'item_name',
        },
    ],
};
let GridDetailsController = class GridDetailsController {
    gridDetailsService;
    constructor(gridDetailsService) {
        this.gridDetailsService = gridDetailsService;
    }
    async save(saveGridDetailDto) {
        const data = await this.gridDetailsService.save(saveGridDetailDto);
        return {
            success: true,
            message: saveGridDetailDto.grid_id
                ? 'Grid details updated successfully'
                : 'Grid details created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.gridDetailsService.list(queryDto);
        return {
            success: true,
            message: 'Grid details fetched successfully',
            data: result.items,
        };
    }
    async updateColumnWidths(dto) {
        const data = await this.gridDetailsService.updateColumnWidths(dto);
        return { success: true, message: 'Column widths updated successfully', data };
    }
    async updateFilterSettings(dto) {
        const data = await this.gridDetailsService.updateFilterSettings(dto);
        return { success: true, message: 'Filter settings updated successfully', data };
    }
    async updateVisibilitySettings(dto) {
        const data = await this.gridDetailsService.updateVisibilitySettings(dto);
        return { success: true, message: 'Visibility settings updated successfully', data };
    }
    async removeColumn(gridColumnId) {
        const data = await this.gridDetailsService.softDeleteColumn(gridColumnId ?? '');
        return { success: true, message: 'Grid column deleted successfully', data };
    }
    async remove(gridId) {
        const data = await this.gridDetailsService.softDelete(gridId ?? '');
        return { success: true, message: 'Grid details deleted successfully', data };
    }
};
exports.GridDetailsController = GridDetailsController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update grid details with nested columns',
        description: 'Use this endpoint instead of POST /api/v1/grid-columns/create. Send column rows inside grid_columns.',
    }),
    (0, swagger_1.ApiBody)({
        type: save_grid_detail_dto_1.SaveGridDetailDto,
        examples: {
            gridDetailsWithColumns: {
                summary: 'Grid details create/update payload',
                value: gridDetailsCreateExample,
            },
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: grid_detail_response_dto_1.GridDetailSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_grid_detail_dto_1.SaveGridDetailDto]),
    __metadata("design:returntype", Promise)
], GridDetailsController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List grid details with filters' }),
    (0, swagger_1.ApiOkResponse)({ type: grid_detail_response_dto_1.GridDetailSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_grid_detail_query_dto_1.ListGridDetailQueryDto]),
    __metadata("design:returntype", Promise)
], GridDetailsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('column-width'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update column width for one or more grid columns' }),
    (0, swagger_1.ApiOkResponse)({ type: grid_detail_response_dto_1.GridDetailSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_column_width_dto_1.SaveColumnWidthDto]),
    __metadata("design:returntype", Promise)
], GridDetailsController.prototype, "updateColumnWidths", null);
__decorate([
    (0, common_1.Put)('filter-settings'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update filter setting for one or more grid columns' }),
    (0, swagger_1.ApiOkResponse)({ type: grid_detail_response_dto_1.GridDetailSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_filter_settings_dto_1.SaveFilterSettingsDto]),
    __metadata("design:returntype", Promise)
], GridDetailsController.prototype, "updateFilterSettings", null);
__decorate([
    (0, common_1.Put)('visibility-settings'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update visibility setting for one or more grid columns' }),
    (0, swagger_1.ApiOkResponse)({ type: grid_detail_response_dto_1.GridDetailSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_visibility_settings_dto_1.SaveVisibilitySettingsDto]),
    __metadata("design:returntype", Promise)
], GridDetailsController.prototype, "updateVisibilitySettings", null);
__decorate([
    (0, common_1.Delete)('column-delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a grid column by id' }),
    (0, swagger_1.ApiQuery)({ name: 'grid_column_id', description: 'UUID grid column id' }),
    (0, swagger_1.ApiOkResponse)({ type: grid_detail_response_dto_1.GridDetailSuccessColumnDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)('grid_column_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GridDetailsController.prototype, "removeColumn", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete grid details by id' }),
    (0, swagger_1.ApiQuery)({ name: 'grid_id', description: 'Numeric grid id' }),
    (0, swagger_1.ApiOkResponse)({ type: grid_detail_response_dto_1.GridDetailSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: grid_detail_response_dto_1.GridDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)('grid_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GridDetailsController.prototype, "remove", null);
exports.GridDetailsController = GridDetailsController = __decorate([
    (0, swagger_1.ApiTags)('Grid Details'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('grid-details'),
    (0, common_1.UseFilters)(grid_detail_exception_filter_1.GridDetailExceptionFilter),
    __metadata("design:paramtypes", [grid_details_service_1.GridDetailsService])
], GridDetailsController);
//# sourceMappingURL=grid-details.controller.js.map