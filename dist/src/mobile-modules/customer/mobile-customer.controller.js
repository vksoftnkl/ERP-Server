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
exports.MobileCustomerController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const data_change_service_1 = require("../../common/data-changes/data-change.service");
const party_response_dto_1 = require("../../common/party/party-response.dto");
const customer_exception_filter_1 = require("../../modules/sales/customer/customer-exception.filter");
const customer_service_1 = require("../../modules/sales/customer/customer.service");
const customer_response_dto_1 = require("../../modules/sales/customer/dto/customer-response.dto");
const mobile_customer_dto_1 = require("./dto/mobile-customer.dto");
const mobile_customer_response_dto_1 = require("./dto/mobile-customer-response.dto");
const mobile_customer_service_1 = require("./mobile-customer.service");
let MobileCustomerController = class MobileCustomerController {
    mobileCustomerService;
    customerService;
    dataChangeService;
    constructor(mobileCustomerService, customerService, dataChangeService) {
        this.mobileCustomerService = mobileCustomerService;
        this.customerService = customerService;
        this.dataChangeService = dataChangeService;
    }
    async list(query) {
        const data = await this.mobileCustomerService.list(query);
        return { success: true, message: 'Customers fetched successfully', data };
    }
    async options() {
        const data = await this.mobileCustomerService.formOptions();
        return { success: true, message: 'Customer form options fetched successfully', data };
    }
    async getById(cusId) {
        const data = await this.mobileCustomerService.getById(cusId);
        return { success: true, message: 'Customer fetched successfully', data };
    }
    async create(dto, request) {
        const data = await this.customerService.save(dto);
        this.announceOtherRole(data, request);
        return { success: true, message: 'Customer created successfully', data };
    }
    async update(dto, request) {
        const data = await this.customerService.save(dto);
        this.announceOtherRole(data, request);
        return { success: true, message: 'Customer updated successfully', data };
    }
    async deleteCheck(cusId) {
        const data = await this.customerService.deleteCheck(cusId);
        return { success: true, message: 'Customer delete check', data };
    }
    async remove(cusId) {
        const data = await this.customerService.softDelete(cusId);
        return { success: true, message: 'Customer deleted successfully', data };
    }
    announceOtherRole(data, request) {
        if (data.partySync?.otherRoleUpdated) {
            this.dataChangeService.publish({
                resource: 'suppliers',
                method: 'POST',
                at: Date.now(),
                originSessionId: request.user?.sid ?? null,
            });
        }
    }
};
exports.MobileCustomerController = MobileCustomerController;
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Paged customer list with search, filter chips and balances',
        description: 'Sorted by name. Balance = closing today in the login company (this year opening set + ' +
            'posted legs, all branches), the Ledger Statement figure; null without a token. counts apply the search, not the filter.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_customer_response_dto_1.MobileCustomerListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_customer_dto_1.ListMobileCustomersQueryDto]),
    __metadata("design:returntype", Promise)
], MobileCustomerController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Pick lists for the entry form: areas, groups, price levels, states, GST types',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_customer_response_dto_1.MobileCustomerFormOptionsSuccessDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MobileCustomerController.prototype, "options", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One customer, with related names and its balance' }),
    (0, swagger_1.ApiQuery)({ name: 'cusId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_customer_response_dto_1.MobileCustomerDetailSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Query)('cusId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MobileCustomerController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a customer (and its linked ledger)',
        description: 'The desktop /customers/create payload without cusId (sending one is a 400 ' +
            'VALIDATION_WHITELIST). cusLinkLedId makes an existing party ledger a customer.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: customer_response_dto_1.CustomerSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_customer_dto_1.CreateMobileCustomerDto, Object]),
    __metadata("design:returntype", Promise)
], MobileCustomerController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('update'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Update a customer (and its linked ledger)',
        description: 'The full desktop save payload with cusId required; cusLinkLedId is create-only.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: customer_response_dto_1.CustomerSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_customer_dto_1.UpdateMobileCustomerDto, Object]),
    __metadata("design:returntype", Promise)
], MobileCustomerController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('delete-check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Would DELETE /mobile/customers/delete go through?',
        description: 'Party rules D1-4. 200 even when refused: canDelete / refusalCode / refusals[] say why. Needs a token whose user holds the menu-10 delete right (no token = 403).',
    }),
    (0, swagger_1.ApiQuery)({ name: 'cusId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: party_response_dto_1.PartyDeleteCheckSuccessDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Query)('cusId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MobileCustomerController.prototype, "deleteCheck", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete a customer',
        description: 'Needs a token whose user holds the menu-10 delete right (no token = 403). 409 CUSTOMER_HAS_BALANCE / CUSTOMER_HAS_CHEQUE_IN_HAND when the ledger goes with the customer and is not settled.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'cusId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: customer_response_dto_1.CustomerSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: customer_response_dto_1.CustomerErrorResponseDto }),
    __param(0, (0, common_1.Query)('cusId', new common_1.ParseUUIDPipe({ version: '7' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MobileCustomerController.prototype, "remove", null);
exports.MobileCustomerController = MobileCustomerController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Customers'),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiSecurity)({}),
    (0, swagger_1.ApiUnauthorizedResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Only when a token is sent and it is malformed, expired or revoked',
    }),
    (0, common_1.Controller)('mobile/customers'),
    (0, common_1.UseFilters)(customer_exception_filter_1.CustomerExceptionFilter),
    __metadata("design:paramtypes", [mobile_customer_service_1.MobileCustomerService,
        customer_service_1.CustomerService,
        data_change_service_1.DataChangeService])
], MobileCustomerController);
//# sourceMappingURL=mobile-customer.controller.js.map