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
exports.ItemsQtyPriceMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const item_qty_price_response_dto_1 = require("./dto/item-qty-price-response.dto");
const get_item_qty_price_query_dto_1 = require("./dto/get-item-qty-price-query.dto");
const delete_item_qty_price_dto_1 = require("./dto/delete-item-qty-price.dto");
const save_item_qty_price_dto_1 = require("./dto/save-item-qty-price.dto");
const item_qty_price_exception_filter_1 = require("./item-qty-price-exception.filter");
const items_qty_price_master_service_1 = require("./items-qty-price-master.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_payload_validation_util_1 = require("../../../common/utils/request-payload-validation.util");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsQtyPriceMasterController = class ItemsQtyPriceMasterController {
    itemsQtyPriceMasterService;
    constructor(itemsQtyPriceMasterService) {
        this.itemsQtyPriceMasterService = itemsQtyPriceMasterService;
    }
    async save(body) {
        const saveItemQtyPriceDtos = await this.resolveSavePayload(body);
        const data = await this.itemsQtyPriceMasterService.save(saveItemQtyPriceDtos);
        return {
            success: true,
            message: 'Item qty prices saved successfully',
            data,
        };
    }
    async getById(query) {
        const queryDto = await (0, request_payload_validation_util_1.validateDto)(query, get_item_qty_price_query_dto_1.GetItemQtyPriceQueryDto, {
            type: 'query',
        });
        if (queryDto.iqp_id) {
            const data = await this.itemsQtyPriceMasterService.getById(queryDto.iqp_id);
            return { success: true, message: 'Item qty price fetched successfully', data };
        }
        const result = await this.itemsQtyPriceMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item qty prices fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async remove(body, iqpId) {
        const deleteItemQtyPriceDto = await this.resolveDeletePayload(body, iqpId);
        const isArray = Array.isArray(deleteItemQtyPriceDto);
        const data = await this.itemsQtyPriceMasterService.toggleDelete(isArray ? deleteItemQtyPriceDto.map((item) => item.iqp_id) : deleteItemQtyPriceDto.iqp_id);
        return {
            success: true,
            message: this.buildToggleDeleteMessage(data),
            data,
        };
    }
    async resolveSavePayload(body) {
        if (!Array.isArray(body)) {
            throw new common_1.BadRequestException({
                message: ['Request payload must be an array of item qty prices'],
            });
        }
        return (await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, save_item_qty_price_dto_1.SaveItemQtyPriceDto));
    }
    buildToggleDeleteMessage(data) {
        if (Array.isArray(data)) {
            if (data.every((item) => item.deleted)) {
                return 'Item qty prices deleted successfully';
            }
            if (data.every((item) => !item.deleted)) {
                return 'Item qty prices restored successfully';
            }
            return 'Item qty prices updated successfully';
        }
        return data.deleted
            ? 'Item qty price deleted successfully'
            : 'Item qty price restored successfully';
    }
    async resolveDeletePayload(body, iqpId) {
        if ((0, request_payload_validation_util_1.hasRequestPayload)(body)) {
            return await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, delete_item_qty_price_dto_1.DeleteItemQtyPriceDto);
        }
        if (!iqpId?.trim()) {
            throw new common_1.BadRequestException({
                message: ['iqp_id is required'],
            });
        }
        return await (0, request_payload_validation_util_1.validateDto)({
            iqp_id: iqpId,
        }, delete_item_qty_price_dto_1.DeleteItemQtyPriceDto, {
            type: 'query',
        });
    }
};
exports.ItemsQtyPriceMasterController = ItemsQtyPriceMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update item qty prices (array; each row updates when iqp_id is present)',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'array',
            items: { $ref: (0, swagger_1.getSchemaPath)(save_item_qty_price_dto_1.SaveItemQtyPriceDto) },
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsQtyPriceMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get item qty price by iqp_id, or list with optional filters/pagination',
    }),
    (0, swagger_1.ApiQuery)({ name: 'iqp_item_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(item_qty_price_response_dto_1.ItemQtyPriceSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(item_qty_price_response_dto_1.ItemQtyPriceSuccessListDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsQtyPriceMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore item qty price by id' }),
    (0, swagger_1.ApiQuery)({ name: 'iqp_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiBody)({
        required: false,
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(delete_item_qty_price_dto_1.DeleteItemQtyPriceDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(delete_item_qty_price_dto_1.DeleteItemQtyPriceDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_qty_price_response_dto_1.ItemQtyPriceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('iqp_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ItemsQtyPriceMasterController.prototype, "remove", null);
exports.ItemsQtyPriceMasterController = ItemsQtyPriceMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Qty Prices'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiExtraModels)(save_item_qty_price_dto_1.SaveItemQtyPriceDto, delete_item_qty_price_dto_1.DeleteItemQtyPriceDto, item_qty_price_response_dto_1.ItemQtyPricePayloadDto, item_qty_price_response_dto_1.ItemQtyPriceDeleteResultDto, item_qty_price_response_dto_1.ItemQtyPriceSuccessSingleDto, item_qty_price_response_dto_1.ItemQtyPriceSuccessListDto),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-qty-prices'),
    (0, common_1.UseFilters)(item_qty_price_exception_filter_1.ItemQtyPriceExceptionFilter),
    __metadata("design:paramtypes", [items_qty_price_master_service_1.ItemsQtyPriceMasterService])
], ItemsQtyPriceMasterController);
//# sourceMappingURL=items-qty-price-master.controller.js.map