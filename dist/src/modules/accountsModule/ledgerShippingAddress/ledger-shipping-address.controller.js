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
exports.LedgerShippingAddressController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const ledger_shipping_address_response_dto_1 = require("./dto/ledger-shipping-address-response.dto");
const save_ledger_shipping_address_dto_1 = require("./dto/save-ledger-shipping-address.dto");
const ledger_shipping_address_exception_filter_1 = require("./ledger-shipping-address-exception.filter");
const ledger_shipping_address_service_1 = require("./ledger-shipping-address.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const api_version_1 = require("../../../common/constants/api-version");
let LedgerShippingAddressController = class LedgerShippingAddressController {
    ledgerShippingAddressService;
    constructor(ledgerShippingAddressService) {
        this.ledgerShippingAddressService = ledgerShippingAddressService;
    }
    async save(saveLedgerShippingAddressDto) {
        const data = await this.ledgerShippingAddressService.save(saveLedgerShippingAddressDto);
        return {
            success: true,
            message: saveLedgerShippingAddressDto.saaId
                ? 'Ledger shipping address updated successfully'
                : 'Ledger shipping address created successfully',
            data,
        };
    }
    async getById(saaId, ledgerId) {
        if (saaId) {
            const data = await this.ledgerShippingAddressService.getById(saaId);
            return {
                success: true,
                message: 'Ledger shipping address fetched successfully',
                data,
            };
        }
        if (!ledgerId) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Either saaId or ledgerId is required', [
                {
                    field: 'ledgerId',
                    message: "Pass saaId to fetch one address, or ledgerId to list a ledger's addresses",
                },
            ]);
        }
        const data = await this.ledgerShippingAddressService.listByLedger(ledgerId);
        return {
            success: true,
            message: 'Ledger shipping addresses fetched successfully',
            data,
        };
    }
    async remove(saaId) {
        const data = await this.ledgerShippingAddressService.softDelete(saaId);
        return {
            success: true,
            message: 'Ledger shipping address deleted successfully',
            data,
        };
    }
};
exports.LedgerShippingAddressController = LedgerShippingAddressController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update ledger shipping address (by saaId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_ledger_shipping_address_dto_1.SaveLedgerShippingAddressDto]),
    __metadata("design:returntype", Promise)
], LedgerShippingAddressController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get ledger shipping address by id, or list every address on one ledger',
        description: "Pass saaId to fetch a single address, or ledgerId to list that ledger's addresses " +
            '(default first, then oldest first). Exactly one of the two is required.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'saaId', schema: { type: 'string', format: 'uuid' }, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'ledgerId', schema: { type: 'string', format: 'uuid' }, required: false }),
    (0, swagger_1.ApiExtraModels)(ledger_shipping_address_response_dto_1.LedgerShippingAddressSuccessSingleDto, ledger_shipping_address_response_dto_1.LedgerShippingAddressSuccessListDto),
    (0, swagger_1.ApiOkResponse)({
        schema: {
            oneOf: [
                { $ref: (0, swagger_1.getSchemaPath)(ledger_shipping_address_response_dto_1.LedgerShippingAddressSuccessSingleDto) },
                { $ref: (0, swagger_1.getSchemaPath)(ledger_shipping_address_response_dto_1.LedgerShippingAddressSuccessListDto) },
            ],
        },
    }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressErrorResponseDto }),
    __param(0, (0, common_1.Query)('saaId', new common_1.DefaultValuePipe(undefined), new common_1.ParseUUIDPipe({ version: '7', optional: true }))),
    __param(1, (0, common_1.Query)('ledgerId', new common_1.DefaultValuePipe(undefined), new common_1.ParseUUIDPipe({ version: '7', optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LedgerShippingAddressController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete ledger shipping address by id' }),
    (0, swagger_1.ApiQuery)({ name: 'saaId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: ledger_shipping_address_response_dto_1.LedgerShippingAddressErrorResponseDto }),
    __param(0, (0, common_1.Query)('saaId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LedgerShippingAddressController.prototype, "remove", null);
exports.LedgerShippingAddressController = LedgerShippingAddressController = __decorate([
    (0, swagger_1.ApiTags)('Ledger Shipping Address'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('ledger-shipping-addresses'),
    (0, common_1.UseFilters)(ledger_shipping_address_exception_filter_1.LedgerShippingAddressExceptionFilter),
    __metadata("design:paramtypes", [ledger_shipping_address_service_1.LedgerShippingAddressService])
], LedgerShippingAddressController);
//# sourceMappingURL=ledger-shipping-address.controller.js.map