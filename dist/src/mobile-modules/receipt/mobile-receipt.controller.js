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
exports.MobileReceiptController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const optional_auth_decorator_1 = require("../../common/decorators/optional-auth.decorator");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const receipt_exception_filter_1 = require("../../modules/accountsModule/receipt/receipt-exception.filter");
const receipt_response_dto_1 = require("../../modules/accountsModule/receipt/dto/receipt-response.dto");
const mobile_exception_filter_1 = require("../common/mobile-exception.filter");
const mobile_receipt_dto_1 = require("./dto/mobile-receipt.dto");
const mobile_receipt_response_dto_1 = require("./dto/mobile-receipt-response.dto");
const mobile_receipt_service_1 = require("./mobile-receipt.service");
let MobileReceiptController = class MobileReceiptController {
    mobileReceiptService;
    constructor(mobileReceiptService) {
        this.mobileReceiptService = mobileReceiptService;
    }
    async options(query) {
        const data = await this.mobileReceiptService.options(query);
        return { success: true, message: 'Receipt options fetched successfully', data };
    }
    async openBills(query) {
        const data = await this.mobileReceiptService.openBills(query);
        return { success: true, message: 'Open bills fetched successfully', data };
    }
    async create(dto) {
        const data = await this.mobileReceiptService.create(dto);
        return {
            success: true,
            message: data.duplicate ? 'Receipt already saved' : 'Receipt created and posted successfully',
            data,
        };
    }
};
exports.MobileReceiptController = MobileReceiptController;
__decorate([
    (0, common_1.Get)('options'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, optional_auth_decorator_1.OptionalAuth)(),
    (0, swagger_1.ApiSecurity)({}),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: "The branch the phone's receipts land in, and the tenders it may collect with",
        description: 'The branch is resolved as the upload resolves it (422 MOBILE_BRANCH_NOT_RESOLVED). ' +
            "Tenders: the company's live, active acc_tender_master rows for that branch or every " +
            'branch, in force today (tnd_effective_from / _to), with a ledger, of type CASH, CARD, UPI, ' +
            'WALLET, CHEQUE or BANK (never CREDIT, TEMP_CR, LOYALTY, RRN or a gift voucher), in display order.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_receipt_response_dto_1.MobileReceiptOptionsSuccessDto }),
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
    __metadata("design:paramtypes", [mobile_receipt_dto_1.MobileReceiptOptionsQueryDto]),
    __metadata("design:returntype", Promise)
], MobileReceiptController.prototype, "options", null);
__decorate([
    (0, common_1.Get)('open-bills'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: "Every customer's open bills in the company, paged (what a receipt would settle)",
        description: 'The rows and the order of /receipts/open-items, for every party of the company at once: ' +
            'live, active DR bills of a receivable type (SALES, OPENING, INTEREST, JOURNAL, ' +
            'PURCHASE_RETURN) with something pending, by party, then in accounts.receipt_bill_sort order ' +
            'within the party (the order a phone receipt fills them in), then by id. daysOverdue is ' +
            'measured on onDate, as open-items measures it. Needs a token. 404 MOBILE_COMPANY_NOT_FOUND.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_receipt_response_dto_1.MobileOpenBillsSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_receipt_dto_1.MobileOpenBillsQueryDto]),
    __metadata("design:returntype", Promise)
], MobileReceiptController.prototype, "openBills", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(receipt_exception_filter_1.ReceiptExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload one receipt: saved and posted in one call, oldest bills first (safe to resend)',
        description: 'avhClientUuid, deviceUid, avhCompanyId, avhPartyId (the customer id = its ledger id), ' +
            "avhVoucherDate (optional, today by default), avhUsrRefno (the phone's own number), " +
            'avhRemarks and tenders[] (tdTenderId, tdTenderTypeId, tdAmount, tdRefNo, tdBankName, ' +
            'tdInstrumentDate, cheque; from GET /mobile/receipts/options). Anything else is a 400 ' +
            'VALIDATION_WHITELIST. The server fills the device (403 MOBILE_DEVICE_*; avhDeviceType ' +
            'MOBILE), the branch (422 MOBILE_BRANCH_NOT_RESOLVED), the acc year (422 ' +
            'MOBILE_NO_FISCAL_YEAR), the login as the user, and the settlement: the money (less any ' +
            "surcharge the tender master adds) fills the customer's open bills in /receipts/open-items " +
            'order (accounts.receipt_bill_sort, due date first by default), each up to what it owes; ' +
            'the rest is held on account as an ADVANCE. Saved AND posted in one transaction (notes 106) ' +
            "on the menu-99 Post right (403 RCT_RIGHT_POST): a refusal saves nothing and is /receipts/post's " +
            '(VCH_*, ACC_*, TENDER_*). The same avhClientUuid again answers the receipt already saved ' +
            '(duplicate: true) and writes nothing; on another customer it is a 409 MOBILE_CLIENT_UUID_REUSED.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: mobile_receipt_response_dto_1.MobileReceiptCreateSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiForbiddenResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: receipt_response_dto_1.ReceiptErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_receipt_dto_1.CreateMobileReceiptDto]),
    __metadata("design:returntype", Promise)
], MobileReceiptController.prototype, "create", null);
exports.MobileReceiptController = MobileReceiptController = __decorate([
    (0, swagger_1.ApiTags)('Mobile · Receipts'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('mobile/receipts'),
    __metadata("design:paramtypes", [mobile_receipt_service_1.MobileReceiptService])
], MobileReceiptController);
//# sourceMappingURL=mobile-receipt.controller.js.map