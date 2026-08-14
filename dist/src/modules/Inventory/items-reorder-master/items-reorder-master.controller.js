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
exports.ItemsReorderMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const item_reorder_response_dto_1 = require("./dto/item-reorder-response.dto");
const get_item_reorder_query_dto_1 = require("./dto/get-item-reorder-query.dto");
const delete_item_reorder_dto_1 = require("./dto/delete-item-reorder.dto");
const save_item_reorder_dto_1 = require("./dto/save-item-reorder.dto");
const item_reorder_exception_filter_1 = require("./item-reorder-exception.filter");
const items_reorder_master_service_1 = require("./items-reorder-master.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_payload_validation_util_1 = require("../../../common/utils/request-payload-validation.util");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsReorderMasterController = class ItemsReorderMasterController {
    itemsReorderMasterService;
    constructor(itemsReorderMasterService) {
        this.itemsReorderMasterService = itemsReorderMasterService;
    }
    async save(body) {
        const saveItemReorderDto = await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, save_item_reorder_dto_1.SaveItemReorderDto);
        const data = await this.itemsReorderMasterService.save(saveItemReorderDto);
        const isArray = Array.isArray(saveItemReorderDto);
        return {
            success: true,
            message: isArray
                ? 'Item reorders saved successfully'
                : saveItemReorderDto.ir_id
                    ? 'Item reorder updated successfully'
                    : 'Item reorder created successfully',
            data,
        };
    }
    async getById(query) {
        const queryDto = (await (0, request_payload_validation_util_1.validateDto)(query, get_item_reorder_query_dto_1.GetItemReorderQueryDto, {
            type: 'query',
        }));
        if (queryDto.ir_id) {
            const data = await this.itemsReorderMasterService.getById(queryDto.ir_id);
            return { success: true, message: 'Item reorder fetched successfully', data };
        }
        const result = await this.itemsReorderMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item reorders fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async remove(body, irId) {
        const deleteItemReorderDto = await this.resolveDeletePayload(body, irId);
        const isArray = Array.isArray(deleteItemReorderDto);
        const data = await this.itemsReorderMasterService.toggleDelete(isArray ? deleteItemReorderDto.map((item) => item.ir_id) : deleteItemReorderDto.ir_id);
        return {
            success: true,
            message: this.buildToggleDeleteMessage(data),
            data,
        };
    }
    buildToggleDeleteMessage(data) {
        if (Array.isArray(data)) {
            if (data.every((item) => item.deleted)) {
                return 'Item reorders deleted successfully';
            }
            if (data.every((item) => !item.deleted)) {
                return 'Item reorders restored successfully';
            }
            return 'Item reorders updated successfully';
        }
        return data.deleted
            ? 'Item reorder deleted successfully'
            : 'Item reorder restored successfully';
    }
    async resolveDeletePayload(body, irId) {
        if ((0, request_payload_validation_util_1.hasRequestPayload)(body)) {
            return (await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, delete_item_reorder_dto_1.DeleteItemReorderDto));
        }
        if (!irId?.trim()) {
            throw new common_1.BadRequestException({
                message: ['ir_id is required'],
            });
        }
        return (await (0, request_payload_validation_util_1.validateDto)({
            ir_id: irId,
        }, delete_item_reorder_dto_1.DeleteItemReorderDto, {
            type: 'query',
        }));
    }
};
exports.ItemsReorderMasterController = ItemsReorderMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item reorder (by ir_id presence)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(save_item_reorder_dto_1.SaveItemReorderDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(save_item_reorder_dto_1.SaveItemReorderDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_reorder_response_dto_1.ItemReorderSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_reorder_response_dto_1.ItemReorderErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_reorder_response_dto_1.ItemReorderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_reorder_response_dto_1.ItemReorderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsReorderMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get item reorder by ir_id, or list with optional filters/pagination',
    }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(item_reorder_response_dto_1.ItemReorderSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(item_reorder_response_dto_1.ItemReorderSuccessListDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_reorder_response_dto_1.ItemReorderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_reorder_response_dto_1.ItemReorderErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsReorderMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore item reorder by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ir_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiBody)({
        required: false,
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(delete_item_reorder_dto_1.DeleteItemReorderDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(delete_item_reorder_dto_1.DeleteItemReorderDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_reorder_response_dto_1.ItemReorderSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_reorder_response_dto_1.ItemReorderErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_reorder_response_dto_1.ItemReorderErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('ir_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ItemsReorderMasterController.prototype, "remove", null);
exports.ItemsReorderMasterController = ItemsReorderMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Reorders'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiExtraModels)(save_item_reorder_dto_1.SaveItemReorderDto, delete_item_reorder_dto_1.DeleteItemReorderDto, item_reorder_response_dto_1.ItemReorderPayloadDto, item_reorder_response_dto_1.ItemReorderDeleteResultDto, item_reorder_response_dto_1.ItemReorderSuccessSingleDto, item_reorder_response_dto_1.ItemReorderSuccessListDto),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-reorders'),
    (0, common_1.UseFilters)(item_reorder_exception_filter_1.ItemReorderExceptionFilter),
    __metadata("design:paramtypes", [items_reorder_master_service_1.ItemsReorderMasterService])
], ItemsReorderMasterController);
//# sourceMappingURL=items-reorder-master.controller.js.map