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
exports.ItemsCategoryMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const item_category_response_dto_1 = require("./dto/item-category-response.dto");
const save_item_category_dto_1 = require("./dto/save-item-category.dto");
const item_category_exception_filter_1 = require("./item-category-exception.filter");
const items_category_master_service_1 = require("./items-category-master.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsCategoryMasterController = class ItemsCategoryMasterController {
    itemsCategoryMasterService;
    constructor(itemsCategoryMasterService) {
        this.itemsCategoryMasterService = itemsCategoryMasterService;
    }
    async save(saveItemCategoryDto, categoryPhotoFile) {
        const payload = this.withUploadedPhoto(saveItemCategoryDto, categoryPhotoFile);
        const data = await this.itemsCategoryMasterService.save(payload);
        return {
            success: true,
            message: payload.category_id
                ? 'Item category updated successfully'
                : 'Item category created successfully',
            data,
        };
    }
    async getById(categoryId) {
        const data = await this.itemsCategoryMasterService.getById(categoryId);
        return {
            success: true,
            message: 'Item category fetched successfully',
            data,
        };
    }
    async remove(categoryId) {
        const { category_id, deleted } = await this.itemsCategoryMasterService.toggleDelete(categoryId);
        return {
            success: true,
            message: deleted
                ? 'Item category deleted successfully'
                : 'Item category restored successfully',
            data: { category_id, deleted },
        };
    }
    withUploadedPhoto(saveItemCategoryDto, categoryPhotoFile) {
        if (!categoryPhotoFile) {
            return saveItemCategoryDto;
        }
        return {
            ...saveItemCategoryDto,
            category_photo: categoryPhotoFile.buffer.toString('base64'),
        };
    }
};
exports.ItemsCategoryMasterController = ItemsCategoryMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('category_photo')),
    (0, swagger_1.ApiConsumes)('application/json', 'multipart/form-data'),
    (0, swagger_1.ApiBody)({ type: save_item_category_dto_1.SaveItemCategoryDto }),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item category (by category_id presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_category_response_dto_1.ItemCategorySuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_category_response_dto_1.ItemCategoryErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_category_response_dto_1.ItemCategoryErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_category_response_dto_1.ItemCategoryErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_item_category_dto_1.SaveItemCategoryDto, Object]),
    __metadata("design:returntype", Promise)
], ItemsCategoryMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get item category by id' }),
    (0, swagger_1.ApiQuery)({ name: 'category_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_category_response_dto_1.ItemCategorySuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_category_response_dto_1.ItemCategoryErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_category_response_dto_1.ItemCategoryErrorResponseDto }),
    __param(0, (0, common_1.Query)('category_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsCategoryMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore item category by id' }),
    (0, swagger_1.ApiQuery)({ name: 'category_id', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: item_category_response_dto_1.ItemCategorySuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_category_response_dto_1.ItemCategoryErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_category_response_dto_1.ItemCategoryErrorResponseDto }),
    __param(0, (0, common_1.Query)('category_id', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ItemsCategoryMasterController.prototype, "remove", null);
exports.ItemsCategoryMasterController = ItemsCategoryMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Categories'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('item-categories'),
    (0, common_1.UseFilters)(item_category_exception_filter_1.ItemCategoryExceptionFilter),
    __metadata("design:paramtypes", [items_category_master_service_1.ItemsCategoryMasterService])
], ItemsCategoryMasterController);
//# sourceMappingURL=items-category-master.controller.js.map