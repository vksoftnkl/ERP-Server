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
exports.ItemUnitConversionController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const item_unit_conversion_response_dto_1 = require("./dto/item-unit-conversion-response.dto");
const get_item_unit_conversion_query_dto_1 = require("./dto/get-item-unit-conversion-query.dto");
const delete_item_unit_conversion_dto_1 = require("./dto/delete-item-unit-conversion.dto");
const save_item_unit_conversion_dto_1 = require("./dto/save-item-unit-conversion.dto");
const item_unit_conversion_exception_filter_1 = require("./item-unit-conversion-exception.filter");
const item_unit_conversion_service_1 = require("./item-unit-conversion.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_payload_validation_util_1 = require("../../../common/utils/request-payload-validation.util");
const api_version_1 = require("../../../common/constants/api-version");
let ItemUnitConversionController = class ItemUnitConversionController {
    itemUnitConversionService;
    constructor(itemUnitConversionService) {
        this.itemUnitConversionService = itemUnitConversionService;
    }
    async save(body) {
        const saveDto = await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, save_item_unit_conversion_dto_1.SaveItemUnitConversionDto);
        const data = await this.itemUnitConversionService.save(saveDto);
        return {
            success: true,
            message: this.buildSaveSuccessMessage(saveDto),
            data,
        };
    }
    async getById(query) {
        const queryDto = await (0, request_payload_validation_util_1.validateDto)(query, get_item_unit_conversion_query_dto_1.GetItemUnitConversionQueryDto, {
            type: 'query',
        });
        if (queryDto.iuc_id) {
            const data = await this.itemUnitConversionService.getById(queryDto.iuc_id);
            return { success: true, message: 'Item unit conversion fetched successfully', data };
        }
        const result = await this.itemUnitConversionService.list(queryDto);
        return {
            success: true,
            message: 'Item unit conversions fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async remove(body, query) {
        const deletePayload = await this.resolveDeletePayload(body, query);
        const data = await this.itemUnitConversionService.toggleDelete(Array.isArray(deletePayload)
            ? deletePayload.map((item) => item.iuc_id)
            : deletePayload.iuc_id);
        return {
            success: true,
            message: this.buildToggleDeleteMessage(data),
            data,
        };
    }
    async resolveDeletePayload(body, query) {
        if ((0, request_payload_validation_util_1.hasRequestPayload)(body)) {
            return await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, delete_item_unit_conversion_dto_1.DeleteItemUnitConversionDto);
        }
        const iucId = typeof query.iuc_id === 'string' ? query.iuc_id : undefined;
        if (!iucId?.trim()) {
            throw new common_1.BadRequestException({
                message: ['iuc_id is required'],
            });
        }
        return await (0, request_payload_validation_util_1.validateDto)({
            iuc_id: iucId,
        }, delete_item_unit_conversion_dto_1.DeleteItemUnitConversionDto, {
            type: 'query',
        });
    }
    buildSaveSuccessMessage(saveDto) {
        if (Array.isArray(saveDto)) {
            return 'Item unit conversions saved successfully';
        }
        return saveDto.iuc_id
            ? 'Item unit conversion updated successfully'
            : 'Item unit conversion created successfully';
    }
    buildToggleDeleteMessage(data) {
        if (Array.isArray(data)) {
            if (data.every((item) => item.deleted)) {
                return 'Item unit conversions deleted successfully';
            }
            if (data.every((item) => !item.deleted)) {
                return 'Item unit conversions restored successfully';
            }
            return 'Item unit conversions updated successfully';
        }
        return data.deleted
            ? 'Item unit conversion deleted successfully'
            : 'Item unit conversion restored successfully';
    }
};
exports.ItemUnitConversionController = ItemUnitConversionController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item unit conversion (by iuc_id presence)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(save_item_unit_conversion_dto_1.SaveItemUnitConversionDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(save_item_unit_conversion_dto_1.SaveItemUnitConversionDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemUnitConversionController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get item unit conversion by iuc_id, or list with optional filters/pagination ' +
            '(iuc_item_id, iuc_is_active).',
    }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(item_unit_conversion_response_dto_1.ItemUnitConversionSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(item_unit_conversion_response_dto_1.ItemUnitConversionSuccessListDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemUnitConversionController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore item unit conversion by id' }),
    (0, swagger_1.ApiQuery)({
        name: 'iuc_id',
        required: false,
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiBody)({
        required: false,
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(delete_item_unit_conversion_dto_1.DeleteItemUnitConversionDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(delete_item_unit_conversion_dto_1.DeleteItemUnitConversionDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_unit_conversion_response_dto_1.ItemUnitConversionErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ItemUnitConversionController.prototype, "remove", null);
exports.ItemUnitConversionController = ItemUnitConversionController = __decorate([
    (0, swagger_1.ApiTags)('Item Unit Conversions'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiExtraModels)(save_item_unit_conversion_dto_1.SaveItemUnitConversionDto, delete_item_unit_conversion_dto_1.DeleteItemUnitConversionDto, item_unit_conversion_response_dto_1.ItemUnitConversionPayloadDto, item_unit_conversion_response_dto_1.ItemUnitConversionDeleteResultDto, item_unit_conversion_response_dto_1.ItemUnitConversionSuccessSingleDto, item_unit_conversion_response_dto_1.ItemUnitConversionSuccessListDto),
    (0, cache_manager_1.CacheTTL)(60),
    (0, common_1.Controller)('item-unit-conversions'),
    (0, common_1.UseFilters)(item_unit_conversion_exception_filter_1.ItemUnitConversionExceptionFilter),
    __metadata("design:paramtypes", [item_unit_conversion_service_1.ItemUnitConversionService])
], ItemUnitConversionController);
//# sourceMappingURL=item-unit-conversion.controller.js.map