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
exports.ItemsPriceMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const item_price_response_dto_1 = require("./dto/item-price-response.dto");
const get_item_price_query_dto_1 = require("./dto/get-item-price-query.dto");
const delete_item_price_dto_1 = require("./dto/delete-item-price.dto");
const save_item_price_dto_1 = require("./dto/save-item-price.dto");
const item_price_exception_filter_1 = require("./item-price-exception.filter");
const items_price_master_service_1 = require("./items-price-master.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_payload_validation_util_1 = require("../../../common/utils/request-payload-validation.util");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsPriceMasterController = class ItemsPriceMasterController {
    itemsPriceMasterService;
    constructor(itemsPriceMasterService) {
        this.itemsPriceMasterService = itemsPriceMasterService;
    }
    async save(body) {
        const saveDto = await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, save_item_price_dto_1.SaveItemPriceDto);
        const data = await this.itemsPriceMasterService.save(saveDto);
        return {
            success: true,
            message: this.buildSaveSuccessMessage(saveDto),
            data,
        };
    }
    async getById(query) {
        const queryDto = await (0, request_payload_validation_util_1.validateDto)(query, get_item_price_query_dto_1.GetItemPriceQueryDto, {
            type: 'query',
        });
        if (queryDto.ipm_id) {
            const data = await this.itemsPriceMasterService.getById(queryDto.ipm_id);
            return { success: true, message: 'Item price fetched successfully', data };
        }
        const result = await this.itemsPriceMasterService.listPrices(queryDto);
        return {
            success: true,
            message: 'Item prices fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async remove(body, query) {
        const deletePayload = await this.resolveDeletePayload(body, query);
        const data = await this.itemsPriceMasterService.toggleDelete(Array.isArray(deletePayload)
            ? deletePayload.map((item) => item.ipm_id)
            : deletePayload.ipm_id);
        return {
            success: true,
            message: this.buildToggleDeleteMessage(data),
            data,
        };
    }
    async resolveDeletePayload(body, query) {
        if ((0, request_payload_validation_util_1.hasRequestPayload)(body)) {
            return await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, delete_item_price_dto_1.DeleteItemPriceDto);
        }
        const ipmId = typeof query.ipm_id === 'string' ? query.ipm_id : undefined;
        if (!ipmId?.trim()) {
            throw new common_1.BadRequestException({
                message: ['ipm_id is required'],
            });
        }
        return await (0, request_payload_validation_util_1.validateDto)({
            ipm_id: ipmId,
        }, delete_item_price_dto_1.DeleteItemPriceDto, {
            type: 'query',
        });
    }
    buildSaveSuccessMessage(saveDto) {
        if (Array.isArray(saveDto)) {
            return 'Item prices saved successfully';
        }
        return saveDto.ipm_id ? 'Item price updated successfully' : 'Item price created successfully';
    }
    buildToggleDeleteMessage(data) {
        if (Array.isArray(data)) {
            if (data.every((item) => item.deleted)) {
                return 'Item prices deleted successfully';
            }
            if (data.every((item) => !item.deleted)) {
                return 'Item prices restored successfully';
            }
            return 'Item prices updated successfully';
        }
        return data.deleted ? 'Item price deleted successfully' : 'Item price restored successfully';
    }
};
exports.ItemsPriceMasterController = ItemsPriceMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item price (by ipm_id presence)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(save_item_price_dto_1.SaveItemPriceDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(save_item_price_dto_1.SaveItemPriceDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_price_response_dto_1.ItemPriceSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_price_response_dto_1.ItemPriceErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_price_response_dto_1.ItemPriceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_price_response_dto_1.ItemPriceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsPriceMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get item price by ipm_id, or list with optional filters/pagination ' +
            '(ipm_item_id, ipm_company_id, ipm_branch_id, ipm_is_active).',
    }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(item_price_response_dto_1.ItemPriceSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(item_price_response_dto_1.ItemPriceSuccessListDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_price_response_dto_1.ItemPriceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_price_response_dto_1.ItemPriceErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsPriceMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore item price by id' }),
    (0, swagger_1.ApiQuery)({
        name: 'ipm_id',
        required: false,
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiBody)({
        required: false,
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(delete_item_price_dto_1.DeleteItemPriceDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(delete_item_price_dto_1.DeleteItemPriceDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_price_response_dto_1.ItemPriceSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_price_response_dto_1.ItemPriceErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_price_response_dto_1.ItemPriceErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ItemsPriceMasterController.prototype, "remove", null);
exports.ItemsPriceMasterController = ItemsPriceMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item Prices'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiExtraModels)(save_item_price_dto_1.SaveItemPriceDto, delete_item_price_dto_1.DeleteItemPriceDto, item_price_response_dto_1.ItemPricePayloadDto, item_price_response_dto_1.ItemPriceDeleteResultDto, item_price_response_dto_1.ItemPriceSuccessSingleDto, item_price_response_dto_1.ItemPriceSuccessListDto),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-prices'),
    (0, common_1.UseFilters)(item_price_exception_filter_1.ItemPriceExceptionFilter),
    __metadata("design:paramtypes", [items_price_master_service_1.ItemsPriceMasterService])
], ItemsPriceMasterController);
//# sourceMappingURL=items-price-master.controller.js.map