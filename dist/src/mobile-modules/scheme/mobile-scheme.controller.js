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
exports.MobileSchemeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_scheme_dto_1 = require("./dto/mobile-scheme.dto");
const mobile_scheme_response_dto_1 = require("./dto/mobile-scheme-response.dto");
const mobile_scheme_service_1 = require("./mobile-scheme.service");
let MobileSchemeController = class MobileSchemeController {
    mobileSchemeService;
    constructor(mobileSchemeService) {
        this.mobileSchemeService = mobileSchemeService;
    }
    async active(query) {
        const data = await this.mobileSchemeService.active(query);
        return { success: true, message: 'Active schemes fetched', data };
    }
};
exports.MobileSchemeController = MobileSchemeController;
__decorate([
    (0, common_1.Get)('active'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "The company's promotion schemes a phone can apply by itself, with every child row",
        description: 'Headers: prm_comp_id = companyId, not deleted, active, APPROVED, auto-apply, no coupon ' +
            "batch, prm_end_date >= the database's today (IST; asOf). A future start is sent. No " +
            'branch filter. Children (branches, parties, items, slabs): active, not deleted, by slno ' +
            'then id. Schemes by prm_priority, prm_code, prm_id. Keys are the VK Nex column names; ' +
            'integers are numbers, numerics exact text at column scale. *_name fields are joined as ' +
            '/promotion-scheme/list joins them; prs_free_unit_factor is the iuc_to_base_factor of ' +
            'the free unit.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_scheme_response_dto_1.MobileSchemesSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'deviceUid sent but not registered, blocked or inactive (MOBILE_DEVICE_*)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_scheme_dto_1.ActiveMobileSchemesQueryDto]),
    __metadata("design:returntype", Promise)
], MobileSchemeController.prototype, "active", null);
exports.MobileSchemeController = MobileSchemeController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Schemes'),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiSecurity)({}),
    (0, swagger_1.ApiUnauthorizedResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Only when a token is sent and it is malformed, expired or revoked',
    }),
    (0, common_1.Controller)('mobile/schemes'),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    __metadata("design:paramtypes", [mobile_scheme_service_1.MobileSchemeService])
], MobileSchemeController);
//# sourceMappingURL=mobile-scheme.controller.js.map