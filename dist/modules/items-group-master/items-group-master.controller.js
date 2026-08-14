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
exports.ItemsGroupMasterController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const list_item_group_query_dto_1 = require("./dto/list-item-group-query.dto");
const item_group_response_dto_1 = require("./dto/item-group-response.dto");
const save_item_group_dto_1 = require("./dto/save-item-group.dto");
const item_group_exception_filter_1 = require("./item-group-exception.filter");
const items_group_master_service_1 = require("./items-group-master.service");
let ItemsGroupMasterController = class ItemsGroupMasterController {
    itemsGroupMasterService;
    constructor(itemsGroupMasterService) {
        this.itemsGroupMasterService = itemsGroupMasterService;
    }
    async save(saveItemGroupDto, itgPhotoFile) {
        const payload = this.withUploadedPhoto(saveItemGroupDto, itgPhotoFile);
        const data = await this.itemsGroupMasterService.save(payload);
        return {
            success: true,
            message: payload.itg_id
                ? 'Item group updated successfully'
                : 'Item group created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.itemsGroupMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item groups fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(itgId) {
        const data = await this.itemsGroupMasterService.getById(itgId);
        return {
            success: true,
            message: 'Item group fetched successfully',
            data,
        };
    }
    async remove(itgId) {
        const data = await this.itemsGroupMasterService.softDelete(itgId);
        return {
            success: true,
            message: 'Item group deleted successfully',
            data,
        };
    }
    withUploadedPhoto(saveItemGroupDto, itgPhotoFile) {
        if (!itgPhotoFile) {
            return saveItemGroupDto;
        }
        return {
            ...saveItemGroupDto,
            itg_photo: itgPhotoFile.buffer.toString('base64'),
        };
    }
};
exports.ItemsGroupMasterController = ItemsGroupMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)('1'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('itg_photo')),
    (0, swagger_1.ApiConsumes)('application/json', 'multipart/form-data'),
    (0, swagger_1.ApiBody)({ type: save_item_group_dto_1.SaveItemGroupDto }),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item group (by itg_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_group_response_dto_1.ItemGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_group_dto_1.SaveItemGroupDto, Object]),
    __metadata("design:returntype", Promise)
], ItemsGroupMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'List item groups with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: item_group_response_dto_1.ItemGroupSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_item_group_query_dto_1.ListItemGroupQueryDto]),
    __metadata("design:returntype", Promise)
], ItemsGroupMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get/:itg_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Get item group by id' }),
    (0, swagger_1.ApiParam)({ name: 'itg_id', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: item_group_response_dto_1.ItemGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    __param(0, (0, common_1.Param)('itg_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsGroupMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete/:itg_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete item group by id' }),
    (0, swagger_1.ApiParam)({ name: 'itg_id', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: item_group_response_dto_1.ItemGroupSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_group_response_dto_1.ItemGroupErrorResponseDto }),
    __param(0, (0, common_1.Param)('itg_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsGroupMasterController.prototype, "remove", null);
exports.ItemsGroupMasterController = ItemsGroupMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Groups'),
    (0, common_1.Controller)('item-groups'),
    (0, common_1.UseFilters)(item_group_exception_filter_1.ItemGroupExceptionFilter),
    __metadata("design:paramtypes", [items_group_master_service_1.ItemsGroupMasterService])
], ItemsGroupMasterController);
//# sourceMappingURL=items-group-master.controller.js.map