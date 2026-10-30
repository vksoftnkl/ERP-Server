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
const data_change_service_1 = require("../../../common/data-changes/data-change.service");
const party_response_dto_1 = require("../../../common/party/party-response.dto");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const customer_exception_filter_1 = require("./customer-exception.filter");
const customer_service_1 = require("./customer.service");
const save_customer_dto_1 = require("./dto/save-customer.dto");
const customer_response_dto_1 = require("./dto/customer-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
let CustomerController = class CustomerController {
    customerService;
    dataChangeService;
    constructor(customerService, dataChangeService) {
        this.customerService = customerService;
        this.dataChangeService = dataChangeService;
    }
    async save(saveCustomerDto, request) {
        const data = await this.customerService.save(saveCustomerDto);
        if (data.partySync?.otherRoleUpdated) {
            this.dataChangeService.publish({
                resource: 'suppliers',
                method: 'POST',
                at: Date.now(),
                originSessionId: request.user?.sid ?? null,
            });
        }
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
    async deleteCheck(cusId) {
        const data = await this.customerService.deleteCheck(cusId);
        return { success: true, message: 'Customer delete check', data };
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
    (0, swagger_1.ApiCreatedResponse)({ type: customer_response_dto_1.CustomerSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_customer_dto_1.SaveCustomerDto, Object]),
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
    (0, common_1.Get)('delete-check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Would DELETE /customers/delete go through? (balance per company, cheques, drafts)',
        description: 'Party rules D1-4. 200 even when the delete would be refused: canDelete / refusalCode / refusals[] say why. Needs the menu-10 delete right.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'cusId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: party_response_dto_1.PartyDeleteCheckSuccessDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Query)('cusId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerController.prototype, "deleteCheck", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete customer by id',
        description: 'Menu-10 delete right. 409 CUSTOMER_HAS_BALANCE / CUSTOMER_HAS_CHEQUE_IN_HAND when the ledger goes with the customer and is not settled.',
    }),
    (0, swagger_1.ApiConflictResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
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
    __metadata("design:paramtypes", [customer_service_1.CustomerService,
        data_change_service_1.DataChangeService])
], CustomerController);
//# sourceMappingURL=customer.controller.js.map