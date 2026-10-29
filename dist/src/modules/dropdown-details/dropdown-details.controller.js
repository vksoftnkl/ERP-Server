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
exports.DropdownDetailsController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const list_dropdown_detail_query_dto_1 = require("./dto/list-dropdown-detail-query.dto");
const run_dropdown_query_dto_1 = require("./dto/run-dropdown-query.dto");
const dropdown_run_response_dto_1 = require("./dto/dropdown-run-response.dto");
const dropdown_detail_response_dto_1 = require("./dto/dropdown-detail-response.dto");
const save_dropdown_detail_dto_1 = require("./dto/save-dropdown-detail.dto");
const save_column_width_dto_1 = require("./dto/save-column-width.dto");
const save_filter_settings_dto_1 = require("./dto/save-filter-settings.dto");
const save_visibility_settings_dto_1 = require("./dto/save-visibility-settings.dto");
const dropdown_detail_exception_filter_1 = require("./dropdown-detail-exception.filter");
const dropdown_details_service_1 = require("./dropdown-details.service");
const api_version_1 = require("../../common/constants/api-version");
const dropdownDetailsCreateExample = {
    dropdown_id: '1',
    dropdown_name: 'Item Master Dropdown',
    dropdown_description: 'Item master dropdown configuration',
    dropdown_sql: 'SELECT item_id, item_name FROM inventory.item_master',
    dropdown_sort_order: 'asc',
    dropdown_sort_column: 'item_name',
    dropdown_completion: 'item_name',
    dropdown_max_visible_items: 10,
    dropdown_show_header: true,
    dropdown_width: 300,
    dropdown_device_type: 'desktop',
    dropdown_columns: [
        {
            dropdown_columns_id: '018f2c9a-6cf2-7b6a-8f1c-4c9478c60001',
            dropdown_columns_no: 1,
            dropdown_columns_data_type: 'string',
            dropdown_columns_name: 'item_name',
            dropdown_columns_alias: 'Item Name',
            dropdown_columns_width: 180,
            dropdown_columns_visiblity: true,
            dropdown_columns_allignment: 'left',
            dropdown_columns_filter: false,
            dropdown_columns_sql_name: 'item_name',
        },
    ],
};
let DropdownDetailsController = class DropdownDetailsController {
    dropdownDetailsService;
    constructor(dropdownDetailsService) {
        this.dropdownDetailsService = dropdownDetailsService;
    }
    async save(saveDropdownDetailDto) {
        const data = await this.dropdownDetailsService.save(saveDropdownDetailDto);
        return {
            success: true,
            message: saveDropdownDetailDto.dropdown_id
                ? 'Dropdown details updated successfully'
                : 'Dropdown details created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.dropdownDetailsService.list(queryDto);
        return {
            success: true,
            message: 'Dropdown details fetched successfully',
            data: result.items,
        };
    }
    async run(queryDto) {
        const data = await this.dropdownDetailsService.run(queryDto);
        return {
            success: true,
            message: 'Dropdown data fetched successfully',
            data,
        };
    }
    async updateColumnWidths(dto) {
        const data = await this.dropdownDetailsService.updateColumnWidths(dto);
        return { success: true, message: 'Column widths updated successfully', data };
    }
    async updateFilterSettings(dto) {
        const data = await this.dropdownDetailsService.updateFilterSettings(dto);
        return { success: true, message: 'Filter settings updated successfully', data };
    }
    async updateVisibilitySettings(dto) {
        const data = await this.dropdownDetailsService.updateVisibilitySettings(dto);
        return { success: true, message: 'Visibility settings updated successfully', data };
    }
    async removeColumn(dropdownColumnsId) {
        const data = await this.dropdownDetailsService.deleteColumn(dropdownColumnsId ?? '');
        return { success: true, message: 'Dropdown column deleted successfully', data };
    }
    async remove(dropdownId) {
        const data = await this.dropdownDetailsService.delete(dropdownId ?? '');
        return { success: true, message: 'Dropdown details deleted successfully', data };
    }
};
exports.DropdownDetailsController = DropdownDetailsController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update dropdown details with nested columns',
        description: 'Use this endpoint instead of POST /api/v1/dropdown-columns/create. Send column rows inside dropdown_columns.',
    }),
    (0, swagger_1.ApiBody)({
        type: save_dropdown_detail_dto_1.SaveDropdownDetailDto,
        examples: {
            dropdownDetailsWithColumns: {
                summary: 'Dropdown details create/update payload',
                value: dropdownDetailsCreateExample,
            },
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_dropdown_detail_dto_1.SaveDropdownDetailDto]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List dropdown details with filters' }),
    (0, swagger_1.ApiOkResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_dropdown_detail_query_dto_1.ListDropdownDetailQueryDto]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('run'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Run the configured SQL for a dropdown and return paginated rows' }),
    (0, swagger_1.ApiOkResponse)({ type: dropdown_run_response_dto_1.DropdownRunResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [run_dropdown_query_dto_1.RunDropdownQueryDto]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "run", null);
__decorate([
    (0, common_1.Put)('column-width'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update column width for one or more dropdown columns' }),
    (0, swagger_1.ApiOkResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_column_width_dto_1.SaveColumnWidthDto]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "updateColumnWidths", null);
__decorate([
    (0, common_1.Put)('filter-settings'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update filter setting for one or more dropdown columns' }),
    (0, swagger_1.ApiOkResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_filter_settings_dto_1.SaveFilterSettingsDto]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "updateFilterSettings", null);
__decorate([
    (0, common_1.Put)('visibility-settings'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update visibility setting for one or more dropdown columns' }),
    (0, swagger_1.ApiOkResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_visibility_settings_dto_1.SaveVisibilitySettingsDto]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "updateVisibilitySettings", null);
__decorate([
    (0, common_1.Delete)('column-delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a dropdown column by id' }),
    (0, swagger_1.ApiQuery)({ name: 'dropdown_columns_id', description: 'UUID dropdown column id' }),
    (0, swagger_1.ApiOkResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailSuccessColumnDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)('dropdown_columns_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "removeColumn", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Delete dropdown details by id' }),
    (0, swagger_1.ApiQuery)({ name: 'dropdown_id', description: 'Numeric dropdown id' }),
    (0, swagger_1.ApiOkResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: dropdown_detail_response_dto_1.DropdownDetailErrorResponseDto }),
    __param(0, (0, common_1.Query)('dropdown_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DropdownDetailsController.prototype, "remove", null);
exports.DropdownDetailsController = DropdownDetailsController = __decorate([
    (0, swagger_1.ApiTags)('Dropdown Details'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('dropdown-details'),
    (0, common_1.UseFilters)(dropdown_detail_exception_filter_1.DropdownDetailExceptionFilter),
    __metadata("design:paramtypes", [dropdown_details_service_1.DropdownDetailsService])
], DropdownDetailsController);
//# sourceMappingURL=dropdown-details.controller.js.map