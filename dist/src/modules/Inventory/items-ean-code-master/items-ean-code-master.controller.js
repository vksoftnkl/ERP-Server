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
exports.ItemsEanCodeMasterController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const item_ean_code_response_dto_1 = require("./dto/item-ean-code-response.dto");
const get_item_ean_code_query_dto_1 = require("./dto/get-item-ean-code-query.dto");
const delete_item_ean_code_dto_1 = require("./dto/delete-item-ean-code.dto");
const save_item_ean_code_dto_1 = require("./dto/save-item-ean-code.dto");
const item_ean_code_exception_filter_1 = require("./item-ean-code-exception.filter");
const items_ean_code_master_service_1 = require("./items-ean-code-master.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_payload_validation_util_1 = require("../../../common/utils/request-payload-validation.util");
const api_version_1 = require("../../../common/constants/api-version");
let ItemsEanCodeMasterController = class ItemsEanCodeMasterController {
    itemsEanCodeMasterService;
    constructor(itemsEanCodeMasterService) {
        this.itemsEanCodeMasterService = itemsEanCodeMasterService;
    }
    async save(body) {
        const saveItemEanCodeDto = await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, save_item_ean_code_dto_1.SaveItemEanCodeDto);
        const data = await this.itemsEanCodeMasterService.save(saveItemEanCodeDto);
        const isArray = Array.isArray(saveItemEanCodeDto);
        return {
            success: true,
            message: isArray
                ? 'Item EAN codes saved successfully'
                : saveItemEanCodeDto.ean_id
                    ? 'Item EAN code updated successfully'
                    : 'Item EAN code created successfully',
            data,
        };
    }
    async getById(query) {
        const queryDto = (await (0, request_payload_validation_util_1.validateDto)(query, get_item_ean_code_query_dto_1.GetItemEanCodeQueryDto, {
            type: 'query',
        }));
        if (queryDto.ean_id) {
            const data = await this.itemsEanCodeMasterService.getById(queryDto.ean_id);
            return { success: true, message: 'Item EAN code fetched successfully', data };
        }
        const result = await this.itemsEanCodeMasterService.list(queryDto);
        return {
            success: true,
            message: 'Item EAN codes fetched successfully',
            data: result.items,
            meta: result.meta,
        };
    }
    async remove(body, eanId) {
        const deleteItemEanCodeDto = await this.resolveDeletePayload(body, eanId);
        const isArray = Array.isArray(deleteItemEanCodeDto);
        const data = await this.itemsEanCodeMasterService.toggleDelete(isArray ? deleteItemEanCodeDto.map((item) => item.ean_id) : deleteItemEanCodeDto.ean_id);
        return {
            success: true,
            message: this.buildToggleDeleteMessage(data),
            data,
        };
    }
    buildToggleDeleteMessage(data) {
        if (Array.isArray(data)) {
            if (data.every((item) => item.deleted)) {
                return 'Item EAN codes deleted successfully';
            }
            if (data.every((item) => !item.deleted)) {
                return 'Item EAN codes restored successfully';
            }
            return 'Item EAN codes updated successfully';
        }
        return data.deleted
            ? 'Item EAN code deleted successfully'
            : 'Item EAN code restored successfully';
    }
    async resolveDeletePayload(body, eanId) {
        if ((0, request_payload_validation_util_1.hasRequestPayload)(body)) {
            return (await (0, request_payload_validation_util_1.validateSingleOrArrayDto)(body, delete_item_ean_code_dto_1.DeleteItemEanCodeDto));
        }
        if (!eanId?.trim()) {
            throw new common_1.BadRequestException({
                message: ['ean_id is required'],
            });
        }
        return (await (0, request_payload_validation_util_1.validateDto)({
            ean_id: eanId,
        }, delete_item_ean_code_dto_1.DeleteItemEanCodeDto, {
            type: 'query',
        }));
    }
};
exports.ItemsEanCodeMasterController = ItemsEanCodeMasterController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update item EAN code (by ean_id presence)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(save_item_ean_code_dto_1.SaveItemEanCodeDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(save_item_ean_code_dto_1.SaveItemEanCodeDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsEanCodeMasterController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get item EAN code by ean_id, or list with optional filters/pagination',
    }),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(item_ean_code_response_dto_1.ItemEanCodeSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(item_ean_code_response_dto_1.ItemEanCodeSuccessListDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ItemsEanCodeMasterController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete or restore item EAN code by id' }),
    (0, swagger_1.ApiQuery)({ name: 'ean_id', required: false, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiBody)({
        required: false,
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(delete_item_ean_code_dto_1.DeleteItemEanCodeDto) },
                {
                    type: 'array',
                    items: { $ref: (0, swagger_1.getSchemaPath)(delete_item_ean_code_dto_1.DeleteItemEanCodeDto) },
                },
            ],
        },
    }),
    (0, swagger_1.ApiOkResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: item_ean_code_response_dto_1.ItemEanCodeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('ean_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ItemsEanCodeMasterController.prototype, "remove", null);
exports.ItemsEanCodeMasterController = ItemsEanCodeMasterController = __decorate([
    (0, swagger_1.ApiTags)('Item EAN Codes'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiExtraModels)(save_item_ean_code_dto_1.SaveItemEanCodeDto, delete_item_ean_code_dto_1.DeleteItemEanCodeDto, item_ean_code_response_dto_1.ItemEanCodePayloadDto, item_ean_code_response_dto_1.ItemEanCodeDeleteResultDto, item_ean_code_response_dto_1.ItemEanCodeSuccessSingleDto, item_ean_code_response_dto_1.ItemEanCodeSuccessListDto),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('item-ean-codes'),
    (0, common_1.UseFilters)(item_ean_code_exception_filter_1.ItemEanCodeExceptionFilter),
    __metadata("design:paramtypes", [items_ean_code_master_service_1.ItemsEanCodeMasterService])
], ItemsEanCodeMasterController);
//# sourceMappingURL=items-ean-code-master.controller.js.map