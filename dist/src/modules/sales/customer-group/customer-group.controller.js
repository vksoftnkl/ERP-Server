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
exports.CustomerGroupController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const save_customer_group_dto_1 = require("./dto/save-customer-group.dto");
const customer_group_response_dto_1 = require("./dto/customer-group-response.dto");
const customer_group_exception_filter_1 = require("./customer-group-exception.filter");
const customer_group_service_1 = require("./customer-group.service");
const api_version_1 = require("../../../common/constants/api-version");
let CustomerGroupController = class CustomerGroupController {
    customerGroupService;
    constructor(customerGroupService) {
        this.customerGroupService = customerGroupService;
    }
    async save(saveCustomerGroupDto) {
        const data = await this.customerGroupService.save(saveCustomerGroupDto);
        return {
            success: true,
            message: saveCustomerGroupDto.cgrId
                ? 'Customer group updated successfully'
                : 'Customer group created successfully',
            data,
        };
    }
    async getById(cgrId) {
        const data = await this.customerGroupService.getById(cgrId);
        return {
            success: true,
            message: 'Customer group fetched successfully',
            data,
        };
    }
    async remove(cgrId) {
        const data = await this.customerGroupService.softDelete(cgrId);
        return {
            success: true,
            message: 'Customer group deleted successfully',
            data,
        };
    }
};
exports.CustomerGroupController = CustomerGroupController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update customer group (by cgrId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: customer_group_response_dto_1.CustomerGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_group_response_dto_1.CustomerGroupErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: customer_group_response_dto_1.CustomerGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_group_response_dto_1.CustomerGroupErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_customer_group_dto_1.SaveCustomerGroupDto]),
    __metadata("design:returntype", Promise)
], CustomerGroupController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get customer group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'cgrId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: customer_group_response_dto_1.CustomerGroupSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_group_response_dto_1.CustomerGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_group_response_dto_1.CustomerGroupErrorResponseDto }),
    __param(0, (0, common_1.Query)('cgrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerGroupController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete customer group by id' }),
    (0, swagger_1.ApiQuery)({ name: 'cgrId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: customer_group_response_dto_1.CustomerGroupSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_group_response_dto_1.CustomerGroupErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_group_response_dto_1.CustomerGroupErrorResponseDto }),
    __param(0, (0, common_1.Query)('cgrId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerGroupController.prototype, "remove", null);
exports.CustomerGroupController = CustomerGroupController = __decorate([
    (0, swagger_1.ApiTags)('Customer Groups'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('customer-groups'),
    (0, common_1.UseFilters)(customer_group_exception_filter_1.CustomerGroupExceptionFilter),
    __metadata("design:paramtypes", [customer_group_service_1.CustomerGroupService])
], CustomerGroupController);
//# sourceMappingURL=customer-group.controller.js.map