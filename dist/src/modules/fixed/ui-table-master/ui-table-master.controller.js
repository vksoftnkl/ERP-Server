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
exports.UiTableMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const list_ui_table_master_query_dto_1 = require("./dto/list-ui-table-master-query.dto");
const save_ui_table_master_dto_1 = require("./dto/save-ui-table-master.dto");
const save_ui_table_column_width_dto_1 = require("./dto/save-ui-table-column-width.dto");
const save_ui_table_visibility_settings_dto_1 = require("./dto/save-ui-table-visibility-settings.dto");
const ui_table_master_response_dto_1 = require("./dto/ui-table-master-response.dto");
const ui_table_master_exception_filter_1 = require("./ui-table-master-exception.filter");
const ui_table_master_service_1 = require("./ui-table-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let UiTableMasterController = class UiTableMasterController {
    uiTableMasterService;
    constructor(uiTableMasterService) {
        this.uiTableMasterService = uiTableMasterService;
    }
    async save(saveUiTableMasterDto) {
        const data = await this.uiTableMasterService.save(saveUiTableMasterDto);
        return {
            success: true,
            message: saveUiTableMasterDto.uiTblId
                ? 'UI table updated successfully'
                : 'UI table created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.uiTableMasterService.list(queryDto);
        return {
            success: true,
            message: 'UI tables fetched successfully',
            data: result.items,
        };
    }
    async updateColumnWidths(dto) {
        const data = await this.uiTableMasterService.updateColumnWidths(dto);
        return { success: true, message: 'Column widths updated successfully', data };
    }
    async updateVisibilitySettings(dto) {
        const data = await this.uiTableMasterService.updateVisibilitySettings(dto);
        return { success: true, message: 'Visibility settings updated successfully', data };
    }
    async removeColumn(uiTblClmId) {
        const data = await this.uiTableMasterService.softDeleteColumn(uiTblClmId ?? '');
        return { success: true, message: 'UI table column deleted successfully', data };
    }
    async remove(uiTblId) {
        const data = await this.uiTableMasterService.softDelete(uiTblId ?? '');
        return { success: true, message: 'UI table deleted successfully', data };
    }
};
exports.UiTableMasterController = UiTableMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update UI table (by uiTblId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: ui_table_master_response_dto_1.UiTableMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_ui_table_master_dto_1.SaveUiTableMasterDto]),
    __metadata("design:returntype", Promise)
], UiTableMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'List UI tables with filters' }),
    (0, swagger_1.ApiOkResponse)({ type: ui_table_master_response_dto_1.UiTableMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_ui_table_master_query_dto_1.ListUiTableMasterQueryDto]),
    __metadata("design:returntype", Promise)
], UiTableMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('column-width'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update column width for one or more UI table columns' }),
    (0, swagger_1.ApiOkResponse)({ type: ui_table_master_response_dto_1.UiTableMasterSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_ui_table_column_width_dto_1.SaveUiTableColumnWidthDto]),
    __metadata("design:returntype", Promise)
], UiTableMasterController.prototype, "updateColumnWidths", null);
__decorate([
    (0, common_1.Put)('layout-settings'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Update visibility setting for one or more UI table columns' }),
    (0, swagger_1.ApiOkResponse)({ type: ui_table_master_response_dto_1.UiTableMasterSuccessColumnUpdateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_ui_table_visibility_settings_dto_1.SaveUiTableVisibilitySettingsDto]),
    __metadata("design:returntype", Promise)
], UiTableMasterController.prototype, "updateVisibilitySettings", null);
__decorate([
    (0, common_1.Delete)('column-delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a UI table column by id' }),
    (0, swagger_1.ApiQuery)({ name: 'uiTblClmId', description: 'Numeric UI table column id' }),
    (0, swagger_1.ApiOkResponse)({ type: ui_table_master_response_dto_1.UiTableMasterSuccessColumnDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('uiTblClmId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UiTableMasterController.prototype, "removeColumn", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete UI table by id' }),
    (0, swagger_1.ApiQuery)({ name: 'uiTblId', description: 'Numeric UI table id' }),
    (0, swagger_1.ApiOkResponse)({ type: ui_table_master_response_dto_1.UiTableMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ui_table_master_response_dto_1.UiTableMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('uiTblId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UiTableMasterController.prototype, "remove", null);
exports.UiTableMasterController = UiTableMasterController = __decorate([
    (0, swagger_1.ApiTags)('UI Table Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('ui-table-masters'),
    (0, common_1.UseFilters)(ui_table_master_exception_filter_1.UiTableMasterExceptionFilter),
    __metadata("design:paramtypes", [ui_table_master_service_1.UiTableMasterService])
], UiTableMasterController);
//# sourceMappingURL=ui-table-master.controller.js.map