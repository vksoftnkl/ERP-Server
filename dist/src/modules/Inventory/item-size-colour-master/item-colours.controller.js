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
exports.ItemColoursController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
const save_item_colour_dto_1 = require("./dto/save-item-colour.dto");
const item_attribute_exception_filter_1 = require("./item-attribute-exception.filter");
const item_colour_master_service_1 = require("./item-colour-master.service");
let ItemColoursController = class ItemColoursController {
    service;
    constructor(service) {
        this.service = service;
    }
    async save(dto) {
        const data = await this.service.save(dto);
        return {
            success: true,
            message: dto.icl_id ? 'Colour updated successfully' : 'Colour created successfully',
            data,
        };
    }
    async getById(id) {
        return {
            success: true,
            message: 'Colour fetched successfully',
            data: await this.service.getById(id),
        };
    }
    async remove(id) {
        return {
            success: true,
            message: 'Colour deleted successfully',
            data: await this.service.softDelete(id),
        };
    }
    async restore(id) {
        return {
            success: true,
            message: 'Colour restored successfully',
            data: await this.service.restore(id),
        };
    }
};
exports.ItemColoursController = ItemColoursController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update a colour (by icl_id presence)',
        description: 'A body with only icl_name (and icl_company_id) is the quick-add. A name already live in ' +
            'the company or shared is a 409 ITEM_COLOUR_NAME_TAKEN whose errors[0].existingId is that row: ' +
            'the client uses it.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'data: the row, in column names (icl_*)' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'VALIDATION_*, ITEM_COLOUR_COMPANY_NOT_FOUND' }),
    (0, swagger_1.ApiConflictResponse)({ description: 'ITEM_COLOUR_NAME_TAKEN (with existingId)' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'ITEM_COLOUR_NOT_FOUND' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_colour_dto_1.SaveItemColourDto]),
    __metadata("design:returntype", Promise)
], ItemColoursController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get a live colour by id' }),
    (0, swagger_1.ApiQuery)({ name: 'icl_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ description: 'data: the row, in column names (icl_*)' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'ITEM_COLOUR_NOT_FOUND' }),
    __param(0, (0, common_1.Query)('icl_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemColoursController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a colour',
        description: 'Deletes only (POST /item-colours/restore brings it back). Refused with 409 ITEM_COLOUR_IN_USE ' +
            'while a batch names it — set icl_is_active false instead.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'icl_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ description: 'data: { icl_id, deleted: true }' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'ITEM_COLOUR_NOT_FOUND' }),
    (0, swagger_1.ApiConflictResponse)({ description: 'ITEM_COLOUR_IN_USE, ITEM_COLOUR_ALREADY_DELETED' }),
    __param(0, (0, common_1.Query)('icl_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemColoursController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('restore'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Restore a soft-deleted colour' }),
    (0, swagger_1.ApiQuery)({ name: 'icl_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'data: { icl_id, deleted: false }' }),
    (0, swagger_1.ApiNotFoundResponse)({ description: 'ITEM_COLOUR_NOT_FOUND' }),
    (0, swagger_1.ApiConflictResponse)({ description: 'ITEM_COLOUR_NOT_DELETED, ITEM_COLOUR_NAME_TAKEN' }),
    __param(0, (0, common_1.Query)('icl_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemColoursController.prototype, "restore", null);
exports.ItemColoursController = ItemColoursController = __decorate([
    (0, swagger_1.ApiTags)('Item Colours'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('item-colours'),
    (0, common_1.UseFilters)(item_attribute_exception_filter_1.ItemAttributeExceptionFilter),
    __metadata("design:paramtypes", [item_colour_master_service_1.ItemColourMasterService])
], ItemColoursController);
//# sourceMappingURL=item-colours.controller.js.map