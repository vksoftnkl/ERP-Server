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
exports.ItemsBrandMasterController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const list_item_brand_query_dto_1 = require("./dto/list-item-brand-query.dto");
const item_brand_response_dto_1 = require("./dto/item-brand-response.dto");
const save_item_brand_dto_1 = require("./dto/save-item-brand.dto");
const item_brand_exception_filter_1 = require("./item-brand-exception.filter");
const items_brand_master_service_1 = require("./items-brand-master.service");
let ItemsBrandMasterController = class ItemsBrandMasterController {
    itemsBrandMasterService;
    constructor(itemsBrandMasterService) {
        this.itemsBrandMasterService = itemsBrandMasterService;
    }
    async save(saveItemBrandDto, brandPhotoFile) {
        const payload = this.withUploadedPhoto(saveItemBrandDto, brandPhotoFile);
        const data = await this.itemsBrandMasterService.save(payload);
        return {
            success: true,
            message: payload.brand_id
                ? 'Item brand updated successfully'
                : 'Item brand created successfully',
            data,
        };
    }
    async list(queryDto) {
        const result = await this.itemsBrandMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item brands fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async getById(brandId) {
        const data = await this.itemsBrandMasterService.getById(brandId);
        return {
            success: true,
            message: 'Item brand fetched successfully',
            data,
        };
    }
    async remove(brandId) {
        const data = await this.itemsBrandMasterService.softDelete(brandId);
        return {
            success: true,
            message: 'Item brand deleted successfully',
            data,
        };
    }
    withUploadedPhoto(saveItemBrandDto, brandPhotoFile) {
        if (!brandPhotoFile) {
            return saveItemBrandDto;
        }
        return {
            ...saveItemBrandDto,
            brand_photo: brandPhotoFile.buffer.toString('base64'),
        };
    }
};
exports.ItemsBrandMasterController = ItemsBrandMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)('1'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('brand_photo')),
    (0, swagger_1.ApiConsumes)('application/json', 'multipart/form-data'),
    (0, swagger_1.ApiBody)({ type: save_item_brand_dto_1.SaveItemBrandDto }),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item brand (by brand_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_brand_response_dto_1.ItemBrandSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_brand_dto_1.SaveItemBrandDto, Object]),
    __metadata("design:returntype", Promise)
], ItemsBrandMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'List item brands with filter/search/pagination' }),
    (0, swagger_1.ApiOkResponse)({ type: item_brand_response_dto_1.ItemBrandSuccessListDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_item_brand_query_dto_1.ListItemBrandQueryDto]),
    __metadata("design:returntype", Promise)
], ItemsBrandMasterController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get/:brand_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Get item brand by id' }),
    (0, swagger_1.ApiParam)({ name: 'brand_id', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: item_brand_response_dto_1.ItemBrandSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    __param(0, (0, common_1.Param)('brand_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsBrandMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete/:brand_id'),
    (0, common_1.Version)('1'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete item brand by id' }),
    (0, swagger_1.ApiParam)({ name: 'brand_id', format: 'uuid' }),
    (0, swagger_1.ApiOkResponse)({ type: item_brand_response_dto_1.ItemBrandSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_brand_response_dto_1.ItemBrandErrorResponseDto }),
    __param(0, (0, common_1.Param)('brand_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsBrandMasterController.prototype, "remove", null);
exports.ItemsBrandMasterController = ItemsBrandMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Brands'),
    (0, common_1.Controller)('item-brands'),
    (0, common_1.UseFilters)(item_brand_exception_filter_1.ItemBrandExceptionFilter),
    __metadata("design:paramtypes", [items_brand_master_service_1.ItemsBrandMasterService])
], ItemsBrandMasterController);
//# sourceMappingURL=items-brand-master.controller.js.map