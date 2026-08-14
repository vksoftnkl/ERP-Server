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
exports.WidgetMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const list_widget_query_dto_1 = require("./dto/list-widget-query.dto");
const widget_config_query_dto_1 = require("./dto/widget-config-query.dto");
const update_widget_visibility_dto_1 = require("./dto/update-widget-visibility.dto");
const save_widget_dto_1 = require("./dto/save-widget.dto");
const save_bulk_widget_dto_1 = require("./dto/save-bulk-widget.dto");
const widget_master_response_dto_1 = require("./dto/widget-master-response.dto");
const widget_master_api_types_1 = require("./types/widget-master-api.types");
const widget_master_exception_filter_1 = require("./widget-master-exception.filter");
const widget_master_service_1 = require("./widget-master.service");
const api_version_1 = require("../../../common/constants/api-version");
let WidgetMasterController = class WidgetMasterController {
    widgetMasterService;
    constructor(widgetMasterService) {
        this.widgetMasterService = widgetMasterService;
    }
    async save(saveWidgetDto) {
        const data = await this.widgetMasterService.save(saveWidgetDto);
        return {
            success: true,
            message: saveWidgetDto.sectionId
                ? 'Widget section updated successfully'
                : 'Widget section created successfully',
            data,
        };
    }
    async saveBulk(saveBulkWidgetDto) {
        const data = await this.widgetMasterService.saveBulk(saveBulkWidgetDto);
        return {
            success: true,
            message: 'Widget sections saved successfully',
            data,
        };
    }
    async list(queryDto) {
        const data = await this.widgetMasterService.list(queryDto);
        return {
            success: true,
            message: 'Widgets fetched successfully',
            data,
        };
    }
    async getConfig(queryDto) {
        const data = await this.widgetMasterService.getConfig(queryDto);
        return {
            success: true,
            message: 'Widget config fetched successfully',
            data,
        };
    }
    async updateVisibility(updateWidgetVisibilityDto) {
        const data = await this.widgetMasterService.updateVisibility(updateWidgetVisibilityDto);
        return {
            success: true,
            message: 'Widget visibility updated successfully',
            data,
        };
    }
    async remove(sectionId) {
        const data = await this.widgetMasterService.delete(sectionId);
        return {
            success: true,
            message: 'Widget section deleted successfully',
            data,
        };
    }
};
exports.WidgetMasterController = WidgetMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a widget section with its fields',
        description: [
            'Upserts a single form section (heading row) together with its nested fields.',
            '',
            '- Omit `sectionId` to create a new section; include it to update the existing one.',
            '- `fields` is a full-sync of the section\'s children: fields with a `fieldId` are updated, fields without one are created, and any existing field not present in the array is deleted.',
            '- Omit `fields` entirely to leave the existing fields untouched; send `[]` to remove all fields.',
            '- Section names and field names are not enforced unique — duplicate `sectionName` (per menu/platform) and duplicate `fieldName` within a section are allowed.',
        ].join('\n'),
    }),
    (0, swagger_1.ApiBody)({
        type: save_widget_dto_1.SaveWidgetDto,
        examples: {
            createWithFields: {
                summary: 'Create a section with two fields',
                value: {
                    sectionMenuId: 10,
                    sectionName: 'Primary Information',
                    sectionPosition: 0,
                    sectionVisibility: true,
                    sectionPlatform: widget_master_api_types_1.WidgetPlatform.Web,
                    fields: [
                        {
                            fieldName: 'item_name',
                            fieldGuiName: 'English Name',
                            fieldSecondaryText: 'Secondary text',
                            fieldPosition: 0,
                            fieldVisibility: true,
                        },
                        {
                            fieldName: 'item_code',
                            fieldGuiName: 'Code',
                            fieldPosition: 1,
                            fieldVisibility: true,
                        },
                    ],
                },
            },
            createSectionOnly: {
                summary: 'Create a section without any fields',
                value: {
                    sectionMenuId: 10,
                    sectionName: 'Price Details',
                    sectionPlatform: widget_master_api_types_1.WidgetPlatform.Desktop,
                },
            },
            updateWithFieldSync: {
                summary: 'Update a section and sync its fields (update one, add one, drop the rest)',
                value: {
                    sectionId: 1,
                    sectionMenuId: 10,
                    sectionName: 'Primary Information',
                    sectionPosition: 0,
                    sectionVisibility: true,
                    sectionPlatform: widget_master_api_types_1.WidgetPlatform.Web,
                    fields: [
                        { fieldId: 5, fieldName: 'item_name', fieldGuiName: 'English Name', fieldPosition: 0 },
                        { fieldName: 'item_barcode', fieldGuiName: 'Barcode', fieldPosition: 1 },
                    ],
                },
            },
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: widget_master_response_dto_1.WidgetMasterSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_widget_dto_1.SaveWidgetDto]),
    __metadata("design:returntype", Promise)
], WidgetMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('create-bulk'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update multiple widget sections with their fields in one request',
        description: [
            'Upserts a non-empty array of form sections (each with its nested fields) in a single transaction.',
            '',
            '- Each section in `data` follows the same rules as `create`: omit `sectionId` to create, include it to update.',
            '- `fields` per section is a full-sync (update by `fieldId`, create when absent, delete the rest); omit it to leave fields untouched, send `[]` to clear them.',
            '- All-or-nothing: if any section fails (missing id 404, …) the whole batch is rolled back and nothing is persisted.',
        ].join('\n'),
    }),
    (0, swagger_1.ApiBody)({
        type: save_bulk_widget_dto_1.SaveBulkWidgetDto,
        examples: {
            createMultiple: {
                summary: 'Create two sections in one request',
                value: {
                    data: [
                        {
                            sectionMenuId: 10,
                            sectionName: 'Primary Information',
                            sectionGuiName: 'Primary Information',
                            sectionPosition: 0,
                            sectionPlatform: widget_master_api_types_1.WidgetPlatform.Web,
                            fields: [
                                { fieldName: 'item_name', fieldGuiName: 'English Name', fieldPosition: 0 },
                                { fieldName: 'item_code', fieldGuiName: 'Code', fieldPosition: 1 },
                            ],
                        },
                        {
                            sectionMenuId: 10,
                            sectionName: 'Price Details',
                            sectionGuiName: 'Price Details',
                            sectionPosition: 1,
                            sectionPlatform: widget_master_api_types_1.WidgetPlatform.Web,
                        },
                    ],
                },
            },
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: widget_master_response_dto_1.WidgetMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_bulk_widget_dto_1.SaveBulkWidgetDto]),
    __metadata("design:returntype", Promise)
], WidgetMasterController.prototype, "saveBulk", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get widget section by id',
        description: [
            'Returns sections (each with its `fields[]` ordered by position), without pagination.',
            'Optional filters: `sectionId` (screen) and `sectionPlatform`.',
            '`search` matches the section name or any of its field names (name / GUI name / secondary text), case-insensitive.',
        ].join('\n'),
    }),
    (0, swagger_1.ApiOkResponse)({ type: widget_master_response_dto_1.WidgetMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_widget_query_dto_1.ListWidgetQueryDto]),
    __metadata("design:returntype", Promise)
], WidgetMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('config'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Get a menu's widget config, optionally filtered by visibility",
        description: [
            'Returns the sections (each with its `fields[]` ordered by position) for `menu_id`.',
            'The optional `visibility` filter accepts `false` or `all`:',
            '- `visibility=false` returns only hidden sections, each carrying its hidden fields plus any field that has secondary text (even when that field is itself visible).',
            '- `visibility=all` (or omitting it) returns both visible and hidden sections (and their fields).',
            'The optional `platform` filter restricts results to sections scoped to that platform; omit it to return all platforms.',
        ].join('\n'),
    }),
    (0, swagger_1.ApiOkResponse)({ type: widget_master_response_dto_1.WidgetMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [widget_config_query_dto_1.WidgetConfigQueryDto]),
    __metadata("design:returntype", Promise)
], WidgetMasterController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Patch)('visibility'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Update section and field visibility config in bulk',
        description: [
            'Updates the visibility configuration for one or more sections together with their fields.',
            '',
            "- Each section's `sectionVisibility` / `sectionGuiName` is updated by `sectionId`.",
            "- Each field's `fieldVisibility` / `fieldSecondaryText` is updated by `fieldId` (the field must belong to its section).",
            '- All updates run in a single transaction: if any `sectionId`/`fieldId` is missing, nothing is changed (404).',
        ].join('\n'),
    }),
    (0, swagger_1.ApiBody)({
        type: update_widget_visibility_dto_1.UpdateWidgetVisibilityDto,
        examples: {
            updateVisibility: {
                summary: 'Update one section and one of its fields',
                value: {
                    data: [
                        {
                            sectionId: 1,
                            sectionGuiName: 'Primary Information',
                            sectionVisibility: true,
                            fields: [
                                {
                                    fieldId: 1,
                                    fieldSecondaryText: 'Secondary text',
                                    fieldVisibility: true,
                                },
                            ],
                        },
                    ],
                },
            },
        },
    }),
    (0, swagger_1.ApiOkResponse)({ type: widget_master_response_dto_1.WidgetMasterSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_widget_visibility_dto_1.UpdateWidgetVisibilityDto]),
    __metadata("design:returntype", Promise)
], WidgetMasterController.prototype, "updateVisibility", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Delete a widget section by id',
        description: 'Deletes the section identified by `sectionId`. All of its fields are removed automatically via the database cascade.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'sectionId', type: Number, example: 1 }),
    (0, swagger_1.ApiOkResponse)({ type: widget_master_response_dto_1.WidgetMasterSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: widget_master_response_dto_1.WidgetMasterErrorResponseDto }),
    __param(0, (0, common_1.Query)('sectionId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], WidgetMasterController.prototype, "remove", null);
exports.WidgetMasterController = WidgetMasterController = __decorate([
    (0, swagger_1.ApiTags)('Widget Master'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('widget-masters'),
    (0, common_1.UseFilters)(widget_master_exception_filter_1.WidgetMasterExceptionFilter),
    __metadata("design:paramtypes", [widget_master_service_1.WidgetMasterService])
], WidgetMasterController);
//# sourceMappingURL=widget-master.controller.js.map