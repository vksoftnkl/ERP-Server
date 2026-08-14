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
exports.ItemsSectionMasterController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const list_item_section_query_dto_1 = require("./dto/list-item-section-query.dto");
const item_section_response_dto_1 = require("./dto/item-section-response.dto");
const save_item_section_dto_1 = require("./dto/save-item-section.dto");
const item_section_exception_filter_1 = require("./item-section-exception.filter");
const items_section_master_service_1 = require("./items-section-master.service");
let ItemsSectionMasterController = class ItemsSectionMasterController {
    itemsSectionMasterService;
    constructor(itemsSectionMasterService) {
        this.itemsSectionMasterService = itemsSectionMasterService;
    }
    async save(saveItemSectionDto, secPhotoFile) {
        const payload = this.withUploadedPhoto(saveItemSectionDto, secPhotoFile);
        const data = await this.itemsSectionMasterService.save(payload);
        return {
            success: true,
            message: payload.sec_id
                ? 'Item section updated successfully'
                : 'Item section created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.itemsSectionMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item sections fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(secId) {
        const data = await this.itemsSectionMasterService.getById(secId);
        return {
            success: true,
            message: 'Item section fetched successfully',
            data,
        };
    }
    async remove(secId) {
        const data = await this.itemsSectionMasterService.softDelete(secId);
        return {
            success: true,
            message: 'Item section deleted successfully',
            data,
        };
    }
    withUploadedPhoto(saveItemSectionDto, secPhotoFile) {
        if (!secPhotoFile) {
            return saveItemSectionDto;
        }
        return {
            ...saveItemSectionDto,
            sec_photo: secPhotoFile.buffer.toString('base64'),
        };
    }
};
exports.ItemsSectionMasterController = ItemsSectionMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)('1'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('sec_photo')),
    (0, swagger_1.ApiConsumes)('application/json', 'multipart/form-data'),
    (0, swagger_1.ApiBody)({ type: save_item_section_dto_1.SaveItemSectionDto }),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item section (by sec_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_section_response_dto_1.ItemSectionSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_section_dto_1.SaveItemSectionDto, Object]),
    __metadata("design:returntype", Promise)
], ItemsSectionMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'List item sections with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: item_section_response_dto_1.ItemSectionSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_item_section_query_dto_1.ListItemSectionQueryDto]),
    __metadata("design:returntype", Promise)
], ItemsSectionMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get/:sec_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Get item section by id' }),
    (0, swagger_1.ApiParam)({ name: 'sec_id', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: item_section_response_dto_1.ItemSectionSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    __param(0, (0, common_1.Param)('sec_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsSectionMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete/:sec_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete item section by id' }),
    (0, swagger_1.ApiParam)({ name: 'sec_id', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: item_section_response_dto_1.ItemSectionSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_section_response_dto_1.ItemSectionErrorResponseDto }),
    __param(0, (0, common_1.Param)('sec_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsSectionMasterController.prototype, "remove", null);
exports.ItemsSectionMasterController = ItemsSectionMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Sections'),
    (0, common_1.Controller)('item-sections'),
    (0, common_1.UseFilters)(item_section_exception_filter_1.ItemSectionExceptionFilter),
    __metadata("design:paramtypes", [items_section_master_service_1.ItemsSectionMasterService])
], ItemsSectionMasterController);
//# sourceMappingURL=items-section-master.controller.js.map