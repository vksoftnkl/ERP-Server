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
exports.MobileBillController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const bill_exception_filter_1 = require("../../modules/sales/bill/bill-exception.filter");
const bill_response_dto_1 = require("../../modules/sales/bill/dto/bill-response.dto");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_bill_dto_1 = require("./dto/mobile-bill.dto");
const mobile_bill_response_dto_1 = require("./dto/mobile-bill-response.dto");
const mobile_bill_service_1 = require("./mobile-bill.service");
let MobileBillController = class MobileBillController {
    mobileBillService;
    constructor(mobileBillService) {
        this.mobileBillService = mobileBillService;
    }
    async options(query) {
        const data = await this.mobileBillService.options(query);
        return { success: true, message: 'Bill options fetched successfully', data };
    }
    async create(dto) {
        const data = await this.mobileBillService.create(dto);
        return {
            success: true,
            message: data.duplicate ? 'Bill already saved' : 'Bill created and posted successfully',
            data,
        };
    }
};
exports.MobileBillController = MobileBillController;
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiSecurity)({}),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: "The branch the phone's bills land in, and the godowns a bill line may draw on",
        description: "The branch is resolved as the upload resolves it (the phone's own branch when it belongs " +
            "to companyId, else the company's default branch, else its only branch; 422 " +
            'MOBILE_BRANCH_NOT_RESOLVED). Godowns: inventory.godown_locations of that branch, live and ' +
            'active, the branch default (br_default_godown_id) first. Send one as sbiGodownId.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_bill_response_dto_1.MobileBillOptionsSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Phone not registered, blocked or inactive (MOBILE_DEVICE_*)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'MOBILE_BRANCH_NOT_RESOLVED',
    }),
    (0, swagger_1.ApiUnauthorizedResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Only when a token is sent and it is malformed, expired or revoked',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_bill_dto_1.MobileBillOptionsQueryDto]),
    __metadata("design:returntype", Promise)
], MobileBillController.prototype, "options", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(bill_exception_filter_1.BillExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload one sales bill: saved and posted in one call (safe to resend)',
        description: 'The desktop /bills/create payload (sb* / sbi*) without sbId, sbBranchId, sbTenantId, ' +
            'sbAccYear, sbSessionId, sbCounterId, sbDeviceType, sbDeviceId, sbBillSlno / sbBillRefno, ' +
            'sbBillMode, sbStatus, post, the posted / server-owned columns, the source-document keys, ' +
            'tenders, charges, adjustments, sbUserId and the audit names (400 VALIDATION_WHITELIST), plus ' +
            'sbClientUuid and deviceUid. Every line names sbiGodownId (GET /mobile/bills/options); a ' +
            'godown that is not a live, active one of the branch is 422 MOBILE_GODOWN_INVALID. The ' +
            'server fills: the device (the registered phone, 403 MOBILE_DEVICE_*; sbDeviceType MOBILE), ' +
            'the branch (422 MOBILE_BRANCH_NOT_RESOLVED), the acc year (the financial year holding ' +
            'sbBillDate, today when omitted; 422 MOBILE_NO_FISCAL_YEAR), sbBillType CREDIT, the login as ' +
            "sbUserId, and VK Nex's number (the branch's Sales Bill series; the phone's own number " +
            'rides in sbUsrRefno). Saved AND posted in one transaction (notes 106): a refusal saves ' +
            'nothing, burns no number and is exactly what /bills/post answers (SALES_RIGHT_POST without ' +
            'the menu-12 Post right, the stock / credit-limit / rate codes, the WARN list; overrides[] ' +
            'as on the desktop). The same sbClientUuid again answers the bill already saved ' +
            '(duplicate: true) and writes nothing; on another customer it is a 409 ' +
            'MOBILE_CLIENT_UUID_REUSED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: mobile_bill_response_dto_1.MobileBillCreateSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiForbiddenResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: bill_response_dto_1.BillErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_bill_dto_1.CreateMobileBillDto]),
    __metadata("design:returntype", Promise)
], MobileBillController.prototype, "create", null);
exports.MobileBillController = MobileBillController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Bills'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('mobile/bills'),
    __metadata("design:paramtypes", [mobile_bill_service_1.MobileBillService])
], MobileBillController);
//# sourceMappingURL=mobile-bill.controller.js.map