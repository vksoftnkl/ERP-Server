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
exports.SuppliersController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const save_supplier_dto_1 = require("./dto/save-supplier.dto");
const supplier_response_dto_1 = require("./dto/supplier-response.dto");
const supplier_exception_filter_1 = require("./supplier-exception.filter");
const suppliers_service_1 = require("./suppliers.service");
const api_version_1 = require("../../../common/constants/api-version");
let SuppliersController = class SuppliersController {
    suppliersService;
    constructor(suppliersService) {
        this.suppliersService = suppliersService;
    }
    async save(saveSupplierDto) {
        const data = await this.suppliersService.save(saveSupplierDto);
        return {
            success: true,
            message: saveSupplierDto.supId
                ? 'Supplier updated successfully'
                : 'Supplier created successfully',
            data,
        };
    }
    async getById(supId) {
        const data = await this.suppliersService.getById(supId);
        return {
            success: true,
            message: 'Supplier fetched successfully',
            data,
        };
    }
    async remove(supId) {
        const data = await this.suppliersService.softDelete(supId);
        return {
            success: true,
            message: 'Supplier deleted successfully',
            data,
        };
    }
};
exports.SuppliersController = SuppliersController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update supplier (by supId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: supplier_response_dto_1.SupplierSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: supplier_response_dto_1.SupplierErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: supplier_response_dto_1.SupplierErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: supplier_response_dto_1.SupplierErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_supplier_dto_1.SaveSupplierDto]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get supplier by id' }),
    (0, swagger_1.ApiQuery)({ name: 'supId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: supplier_response_dto_1.SupplierSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: supplier_response_dto_1.SupplierErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: supplier_response_dto_1.SupplierErrorResponseDto }),
    __param(0, (0, common_1.Query)('supId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete supplier by id' }),
    (0, swagger_1.ApiQuery)({ name: 'supId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: supplier_response_dto_1.SupplierSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: supplier_response_dto_1.SupplierErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: supplier_response_dto_1.SupplierErrorResponseDto }),
    __param(0, (0, common_1.Query)('supId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SuppliersController.prototype, "remove", null);
exports.SuppliersController = SuppliersController = __decorate([
    (0, swagger_1.ApiTags)('Suppliers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('suppliers'),
    (0, common_1.UseFilters)(supplier_exception_filter_1.SupplierExceptionFilter),
    __metadata("design:paramtypes", [suppliers_service_1.SuppliersService])
], SuppliersController);
//# sourceMappingURL=suppliers.controller.js.map