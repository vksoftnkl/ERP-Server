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
exports.CustomerController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const customer_exception_filter_1 = require("./customer-exception.filter");
const customer_service_1 = require("./customer.service");
const save_customer_dto_1 = require("./dto/save-customer.dto");
const customer_response_dto_1 = require("./dto/customer-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let CustomerController = class CustomerController {
    customerService;
    constructor(customerService) {
        this.customerService = customerService;
    }
    async save(saveCustomerDto) {
        const data = await this.customerService.save(saveCustomerDto);
        return {
            success: true,
            message: saveCustomerDto.cusId
                ? 'Customer updated successfully'
                : 'Customer created successfully',
            data,
        };
    }
    async getById(cusId) {
        const data = await this.customerService.getById(cusId);
        return {
            success: true,
            message: 'Customer fetched successfully',
            data,
        };
    }
    async remove(cusId) {
        const data = await this.customerService.softDelete(cusId);
        return {
            success: true,
            message: 'Customer deleted successfully',
            data,
        };
    }
};
exports.CustomerController = CustomerController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update customer (by cusId presence)' }),
    (0, swagger_1.ApiCreatedResponse)({ type: customer_response_dto_1.CustomerSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_customer_dto_1.SaveCustomerDto]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get customer by id' }),
    (0, swagger_1.ApiQuery)({ name: 'cusId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: customer_response_dto_1.CustomerSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Query)('cusId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "getById", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete customer by id' }),
    (0, swagger_1.ApiQuery)({ name: 'cusId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: customer_response_dto_1.CustomerSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Query)('cusId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "remove", null);
exports.CustomerController = CustomerController = __decorate([
    (0, swagger_1.ApiTags)('Customers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('customers'),
    (0, common_1.UseFilters)(customer_exception_filter_1.CustomerExceptionFilter),
    __metadata("design:paramtypes", [customer_service_1.CustomerService])
], CustomerController);
//# sourceMappingURL=customer.controller.js.map