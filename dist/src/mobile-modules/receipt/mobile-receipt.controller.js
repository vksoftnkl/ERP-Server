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
const mobile_receipt_status_service_1 = require("./mobile-receipt-status.service");
let MobileReceiptController = class MobileReceiptController {
    mobileReceiptService;
    mobileReceiptStatusService;
    constructor(mobileReceiptService, mobileReceiptStatusService) {
        this.mobileReceiptService = mobileReceiptService;
        this.mobileReceiptStatusService = mobileReceiptStatusService;
    }
    async options(query) {
        const data = await this.mobileReceiptService.options(query);
        return { success: true, message: 'Receipt options fetched successfully', data };
    }
    async openBills(query) {
        const data = await this.mobileReceiptService.openBills(query);
        return { success: true, message: 'Open bills fetched successfully', data };
    }
    async status(query) {
        const data = await this.mobileReceiptStatusService.status(query);
        return { success: true, message: 'Receipt status fetched successfully', data };
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
        summary: "The branch the phone's receipts land in, the tenders it may collect with, and the receipt rules",
        description: 'The branch: branchId (the Switch company pick; 422 MOBILE_BRANCH_NOT_OF_COMPANY) or, ' +
            'without it, resolved as the upload resolves it (422 MOBILE_BRANCH_NOT_RESOLVED). ' +
            "Tenders: the company's live, active acc_tender_master rows for that branch or every " +
            'branch, in force today (tnd_effective_from / _to), with a ledger, of every type the desktop ' +
            'Receipt screen offers (never CREDIT, LOYALTY, TEMP_CR or an adjust tender, RRN / ADJUST), ' +
            'in display order; requiresBank = a cheque. settings: receiptBillSort and ppdEnabled (the ' +
            "company's, as open-items reads them), salesmanMandatory and pdcPostingMode (the branch's, " +
            'as the post reads them).',
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
        description: 'MOBILE_BRANCH_NOT_RESOLVED, MOBILE_BRANCH_NOT_OF_COMPANY',
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
            'within the party (the order a phone receipt fills them in), then by id. Each bill: kind ' +
            'BILL, paidAmount (billAmount - pendingAmount), pdcHeld (post-dated money not yet matured) ' +
            'and ppdSchedule (the prompt-payment steps still ahead: the first step whose tillDate is on ' +
            "or after the receipt date is the one). withCredits=true adds each customer's held credits " +
            'after its bills (kind ADVANCE, SALES_RETURN, OPENING_CR, JOURNAL_CR; pendingAmount = what is ' +
            'held), and total / the pages count them too. daysOverdue is measured on onDate, as ' +
            'open-items measures it. Customers only. Needs a token. 404 MOBILE_COMPANY_NOT_FOUND.',
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
    (0, common_1.Get)('status'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(mobile_exception_filter_1.MobileExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: "What became of this phone's receipts: posted, cancelled, cheques cleared or bounced",
        description: 'The receipts uploaded from this phone (deviceUid; POST /mobile/receipts/create) in ' +
            'companyId, changed at or after `since` (omitted: all), oldest change first, paged. Each: ' +
            'its client uuid, id, number and status, cancelledOn / cancelReason once cancelled, its ' +
            'cheques (pdc[]: the voucher carrying each, the cheque date, amount, status HELD / CLEARED ' +
            "/ BOUNCED / CANCELLED and the register's own houseStatus) and updatedOn. asOf is this " +
            "read's time less a five-minute overlap: send it back as `since`. Needs a token. 403 " +
            'MOBILE_DEVICE_*, 404 MOBILE_COMPANY_NOT_FOUND.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: mobile_receipt_response_dto_1.MobileReceiptStatusSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'No token, or a bad one' }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: http_error_response_dto_1.HttpErrorResponseDto,
        description: 'Phone not registered, blocked or inactive (MOBILE_DEVICE_*)',
    }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto, description: 'MOBILE_COMPANY_NOT_FOUND' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [mobile_receipt_dto_1.MobileReceiptStatusQueryDto]),
    __metadata("design:returntype", Promise)
], MobileReceiptController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.UseFilters)(receipt_exception_filter_1.ReceiptExceptionFilter),
    (0, swagger_1.ApiOperation)({
        summary: 'Upload one receipt: saved and posted in one call, as the phone settled it or oldest bills first (safe to resend)',
        description: 'avhClientUuid, deviceUid, avhCompanyId, avhPartyId (the customer id = its ledger id), ' +
            'avhBranchId (optional: the Switch company branch), avhVoucherDate (optional, today by ' +
            "default), avhUsrRefno (the phone's own number), avhDocRefno / avhDocDate (the shop's own " +
            'receipt no. and date; 409 VCH_DUP_DOC_REFNO when a live receipt of this customer this year ' +
            'has it), avhRemarks, tenders[] (from GET /mobile/receipts/options), and optionally the ' +
            "phone's settlement: allocations[] {billId, billAccYear, amount, discount, roundoff}, " +
            'creditsApplied[] {billId, billAccYear, amount} and onAccount (informational). Anything ' +
            'else (writeoff included) is a 400 VALIDATION_WHITELIST. The server fills the device (403 ' +
            'MOBILE_DEVICE_*), the branch (422 MOBILE_BRANCH_NOT_OF_COMPANY / _NOT_RESOLVED), the acc ' +
            "year (422 MOBILE_NO_FISCAL_YEAR), the login as the user, and the login's employee as the " +
            'collector (422 MOBILE_RECEIPT_NO_EMPLOYEE when accounts.receipt_salesman_mandatory is on ' +
            'and the login has none). Without allocations and creditsApplied the money fills the open ' +
            'bills oldest first (open-items order) and the rest is held on account, as before. With ' +
            "them the phone's settlement is posted, never refused because a bill moved since its Sync " +
            '(D1): each line is capped at what its bill can take now, a bill no longer open frees its ' +
            'line and drops its discount, credits are capped at what they hold, freed money goes to the ' +
            'open bills oldest first, then on account; every change is in adjusted[]. A discount above ' +
            'the prompt-payment suggestion for the receipt date is 422 MOBILE_RECEIPT_DISCOUNT_ABOVE_PPD, ' +
            'a round-off above 0.99 is 422 MOBILE_RECEIPT_ROUNDOFF_TOO_BIG. Saved AND posted in one ' +
            "transaction (notes 106) through the desktop's engine on the menu-99 Post right (403 " +
            "RCT_RIGHT_POST): a refusal saves nothing and is /receipts/post's (VCH_*, ACC_*, TENDER_*). " +
            'The same avhClientUuid again answers the receipt already saved, read back from the ' +
            'database (duplicate: true) and writes nothing; on another customer it is a 409 ' +
            'MOBILE_CLIENT_UUID_REUSED.',
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
    __metadata("design:paramtypes", [mobile_receipt_service_1.MobileReceiptService,
        mobile_receipt_status_service_1.MobileReceiptStatusService])
], MobileReceiptController);
//# sourceMappingURL=mobile-receipt.controller.js.map