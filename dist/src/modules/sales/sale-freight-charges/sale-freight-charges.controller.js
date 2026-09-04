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
exports.SaleFreightChargeController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const sale_freight_charges_exception_filter_1 = require("./sale-freight-charges-exception.filter");
const sale_freight_charges_service_1 = require("./sale-freight-charges.service");
const save_sale_freight_charges_dto_1 = require("./dto/save-sale-freight-charges.dto");
const sale_freight_charges_response_dto_1 = require("./dto/sale-freight-charges-response.dto");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const api_version_1 = require("../../../common/constants/api-version");
let SaleFreightChargeController = class SaleFreightChargeController {
    saleFreightChargeService;
    requestContextService;
    constructor(saleFreightChargeService, requestContextService) {
        this.saleFreightChargeService = saleFreightChargeService;
        this.requestContextService = requestContextService;
    }
    async createSaleFreightCharge(dto) {
        if (dto.frId) {
            const data = await this.saleFreightChargeService.save(dto);
            return {
                success: true,
                message: 'Sale freight charge updated successfully',
                data,
            };
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const data = await this.saleFreightChargeService.createSaleFreightCharge(dto, userId);
        return {
            success: true,
            message: 'Sale freight charge created successfully',
            data,
        };
    }
    async getById(frId) {
        const data = await this.saleFreightChargeService.getById(frId);
        return {
            success: true,
            message: 'Sale freight charge fetched successfully',
            data,
        };
    }
    async remove(frId) {
        const data = await this.saleFreightChargeService.softDelete(frId);
        return {
            success: true,
            message: 'Sale freight charge deleted successfully',
            data,
        };
    }
};
exports.SaleFreightChargeController = SaleFreightChargeController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update a sale freight charge (by frId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeSuccessCreateDto }),
    (0, swagger_1.ApiOkResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_sale_freight_charges_dto_1.SaveSaleFreightChargeDto]),
    __metadata("design:returntype", Promise)
], SaleFreightChargeController.prototype, "createSaleFreightCharge", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get a sale freight charge by id' }),
    (0, swagger_1.ApiQuery)({ name: 'frId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeErrorResponseDto }),
    __param(0, (0, common_1.Query)('frId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SaleFreightChargeController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a sale freight charge by id' }),
    (0, swagger_1.ApiQuery)({ name: 'frId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: sale_freight_charges_response_dto_1.SaleFreightChargeErrorResponseDto }),
    __param(0, (0, common_1.Query)('frId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SaleFreightChargeController.prototype, "remove", null);
exports.SaleFreightChargeController = SaleFreightChargeController = __decorate([
    (0, swagger_1.ApiTags)('Sale Freight Charges'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('sale-freight-charges'),
    (0, common_1.UseFilters)(sale_freight_charges_exception_filter_1.SaleFreightChargeExceptionFilter),
    __metadata("design:paramtypes", [sale_freight_charges_service_1.SaleFreightChargeService,
        request_context_service_1.RequestContextService])
], SaleFreightChargeController);
//# sourceMappingURL=sale-freight-charges.controller.js.map