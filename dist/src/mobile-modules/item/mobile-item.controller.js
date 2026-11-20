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
exports.MobileItemController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_item_dto_1 = require("./dto/mobile-item.dto");
const mobile_item_response_dto_1 = require("./dto/mobile-item-response.dto");
const mobile_item_service_1 = require("./mobile-item.service");
let MobileItemController = class MobileItemController {
    mobileItemService;
    constructor(mobileItemService) {
        this.mobileItemService = mobileItemService;
    }
    async options() {
        const data = await this.mobileItemService.options();
        return { success: true, message: 'Item options fetched successfully', data };
    }
    async list(query) {
        const data = await this.mobileItemService.list(query);
        return { success: true, message: 'Items fetched successfully', data };
    }
};
exports.MobileItemController = MobileItemController;
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Pick lists for the order screen: companies, their branches, item groups, brands, price levels',
        description: 'Active, live rows only. branches = the active branches of the listed companies, per ' +
            'company in that order, then by name (for the phone, which reaches only /mobile/* over ' +
            'plain HTTP). Price levels leave out Cost (7): the phone carries no cost price.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_item_response_dto_1.MobileItemOptionsSuccessDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MobileItemController.prototype, "options", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Paged list of the items orderable for a company, with units, prices and stock',
        description: "Items that are live, active, item_allow_so, and shared or the company's own, sorted by " +
            'English name. Per unit: the iucId (soiItemUnitId), factor, default flag, weight, the ' +
            'prices of levels 1-4, MRP, minimum, loading and freight charge, picked as ' +
            '/master-lookups/item-price picks them for a line with no MRP (the headline row, branch ' +
            'before chain; an item priced only per MRP takes its dearest bucket), and the free ' +
            'saleable stock in the company (stock.stock_balance). No cost price.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_item_response_dto_1.MobileItemListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'deviceUid sent but not registered, blocked or inactive (MOBILE_DEVICE_*)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_item_dto_1.ListMobileItemsQueryDto]),
    __metadata("design:returntype", Promise)
], MobileItemController.prototype, "list", null);
exports.MobileItemController = MobileItemController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Items'),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiSecurity)({}),
    (0, swagger_1.ApiUnauthorizedResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Only when a token is sent and it is malformed, expired or revoked',
    }),
    (0, common_1.Controller)('mobile/items'),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    __metadata("design:paramtypes", [mobile_item_service_1.MobileItemService])
], MobileItemController);
//# sourceMappingURL=mobile-item.controller.js.map