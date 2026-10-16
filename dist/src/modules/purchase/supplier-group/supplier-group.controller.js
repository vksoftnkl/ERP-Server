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
exports.SupplierGroupController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const save_supplier_group_dto_1 = require("./dto/save-supplier-group.dto");
const supplier_group_response_dto_1 = require("./dto/supplier-group-response.dto");
const supplier_group_exception_filter_1 = require("./supplier-group-exception.filter");
const supplier_group_service_1 = require("./supplier-group.service");
const api_version_1 = require("../../../common/constants/api-version");
let SupplierGroupController = class SupplierGroupController {
    supplierGroupService;
    constructor(supplierGroupService) {
        this.supplierGroupService = supplierGroupService;
    }
    async save(saveSupplierGroupDto) {
        const data = await this.supplierGroupService.save(saveSupplierGroupDto);
        return {
            success: true,
            message: saveSupplierGroupDto.spgId
                ? 'Supplier group updated successfully'
                : 'Supplier group created successfully',
            data,
        };
    }
    async getById(spgId) {
        const data = await this.supplierGroupService.getById(spgId);
        return {
            success: true,
            message: 'Supplier group fetched successfully',
            data,
        };
    }
    async remove(spgId) {
        const data = await this.supplierGroupService.softDelete(spgId);
        return {
            success: true,
            message: 'Supplier group deleted successfully',
            data,
        };
    }
};
exports.SupplierGroupController = SupplierGroupController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update supplier group (by spgId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: supplier_group_response_dto_1.SupplierGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: supplier_group_response_dto_1.SupplierGroupErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: supplier_group_response_dto_1.SupplierGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: supplier_group_response_dto_1.SupplierGroupErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_supplier_group_dto_1.SaveSupplierGroupDto]),
    __metadata("design:returntype", Promise)
], SupplierGroupController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get supplier group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'spgId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: supplier_group_response_dto_1.SupplierGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: supplier_group_response_dto_1.SupplierGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: supplier_group_response_dto_1.SupplierGroupErrorResponseDto }),
    __param(0, (0, common_1.Query)('spgId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SupplierGroupController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete supplier group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'spgId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: supplier_group_response_dto_1.SupplierGroupSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: supplier_group_response_dto_1.SupplierGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: supplier_group_response_dto_1.SupplierGroupErrorResponseDto }),
    __param(0, (0, common_1.Query)('spgId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SupplierGroupController.prototype, "remove", null);
exports.SupplierGroupController = SupplierGroupController = __decorate([
    (0, swagger_1.ApiTags)('Supplier Groups'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('supplier-groups'),
    (0, common_1.UseFilters)(supplier_group_exception_filter_1.SupplierGroupExceptionFilter),
    __metadata("design:paramtypes", [supplier_group_service_1.SupplierGroupService])
], SupplierGroupController);
//# sourceMappingURL=supplier-group.controller.js.map