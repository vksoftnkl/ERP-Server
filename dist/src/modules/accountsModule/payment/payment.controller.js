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
exports.PaymentController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const payment_exception_filter_1 = require("./payment-exception.filter");
const payment_service_1 = require("./payment.service");
const payment_posting_service_1 = require("./payment-posting.service");
const payment_cancel_service_1 = require("./payment-cancel.service");
const payment_amend_service_1 = require("./payment-amend.service");
const payment_open_items_service_1 = require("./payment-open-items.service");
const open_item_dto_1 = require("./dto/open-item.dto");
const amend_payment_dto_1 = require("./dto/amend-payment.dto");
const save_payment_dto_1 = require("./dto/save-payment.dto");
const post_payment_dto_1 = require("./dto/post-payment.dto");
const payment_response_dto_1 = require("./dto/payment-response.dto");
const payment_enum_1 = require("./types/payment-enum");
let PaymentController = class PaymentController {
    prisma;
    requestContext;
    paymentService;
    postingService;
    cancelService;
    amendService;
    openItemsService;
    constructor(prisma, requestContext, paymentService, postingService, cancelService, amendService, openItemsService) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.paymentService = paymentService;
        this.postingService = postingService;
        this.cancelService = cancelService;
        this.amendService = amendService;
        this.openItemsService = openItemsService;
    }
    async openItems(query) {
        await this.requireRight('view', 'view payments');
        const data = await this.openItemsService.listOpenItems(query);
        return {
            success: true,
            message: `${data.bills.length} open bill(s) and ${data.credits.length} debit(s) held for ${data.party.ledName}`,
            data,
        };
    }
    async partyContext(query) {
        await this.requireRight('view', 'view payments');
        const data = await this.openItemsService.partyContext(query);
        return { success: true, message: 'Party context fetched successfully', data };
    }
    async get(query) {
        await this.requireRight('view', 'view payments');
        const data = await this.paymentService.get(query);
        return { success: true, message: 'Payment fetched successfully', data };
    }
    async adjacent(query) {
        await this.requireRight('view', 'view payments');
        const data = await this.openItemsService.adjacent(query);
        return {
            success: true,
            message: data.voucher
                ? `${data.voucher.voucherRefno ?? data.voucher.voucherId} is the ${query.direction} payment`
                : `No ${query.direction} payment — this is the end of the register`,
            data,
        };
    }
    async duplicateCheck(query) {
        await this.requireRight('view', 'view payments');
        const data = await this.openItemsService.duplicateCheck(query);
        return {
            success: true,
            message: data.isDuplicate
                ? `${data.matches.length} payment(s) already made to this party for this amount on this date`
                : 'No matching payment — this does not look like a duplicate',
            data,
        };
    }
    async create(dto) {
        await this.requireRight(dto.avhVoucherId ? 'edit' : 'create', 'save payment drafts');
        const data = await this.paymentService.save(dto);
        return { success: true, message: 'Payment draft saved successfully', data };
    }
    async postPayment(dto) {
        await this.requireRight('post', 'post payments');
        const data = await this.postingService.post(dto);
        const pdcCount = data.numberedVouchers.filter((voucher) => voucher.isPdcVoucher).length;
        return {
            success: true,
            message: `Payment ${data.header.avhVoucherRefno} posted` +
                (data.cheques.length > 0
                    ? ` — cheque ${data.cheques.map((c) => c.leaf).join(', ')} issued`
                    : '') +
                (pdcCount > 0 ? ` with ${pdcCount} post-dated cheque voucher(s)` : ''),
            data,
        };
    }
    async updateHeader(dto, body) {
        await this.requireRight('edit', 'edit payments');
        const data = await this.paymentService.updateHeader(dto, body);
        return { success: true, message: 'Payment header updated successfully', data };
    }
    async cancel(dto) {
        await this.requireRight('cancel', 'cancel payments');
        const data = await this.cancelService.cancel(dto);
        return {
            success: true,
            message: `Payment ${data.avhVoucherRefno} cancelled — ${data.reversals.length} voucher(s) reversed`,
            data,
        };
    }
    async delete(dto) {
        await this.requireRight('delete', 'delete payment drafts');
        const data = await this.paymentService.deleteDraft(dto);
        return {
            success: true,
            message: 'Draft payment deleted' +
                (data.tendersDeleted > 0 ? ` — ${data.tendersDeleted} tender row(s) removed` : ''),
            data,
        };
    }
    async amend(dto) {
        await this.requireRight('amend', 'amend posted payments');
        const data = await this.amendService.amend(dto);
        return {
            success: true,
            message: `Payment ${data.header.avhVoucherRefno ?? data.header.avhVoucherId} amended — now revision ${data.toRevision}`,
            data,
        };
    }
    async requireRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: payment_enum_1.PAYMENT_MENU_ID,
            right,
            codePrefix: 'PMT',
            action,
        });
    }
};
exports.PaymentController = PaymentController;
__decorate([
    (0, common_1.Get)('open-items'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Everything we owe a party and everything of ours they hold',
        description: 'bills = the party’s CR bills pending (PURCHASE, OPENING, JOURNAL); credits = the DR items ' +
            'we hold on them (an ADVANCE paid, a PURCHASE_RETURN / debit note, OPENING / JOURNAL ' +
            'debits). party adds the TDS rate in force (accounts.tds_rates), the party’s default ' +
            'bank account for a transfer’s beneficiary, who a cheque is made out to, and ' +
            'isMoneyLedger — a payment to a cash / bank ledger is a Contra and /create refuses it.\n\n' +
            'No accounting year, no branch, no paging — for the reasons /receipts/open-items gives.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_response_dto_1.PaymentOpenItemsSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.ListPaymentOpenItemsQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "openItems", null);
__decorate([
    (0, common_1.Get)('party-context'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The party’s last ten payments and our cheques to them still out',
        description: 'lastPayments[10]; ourChequesOut[] = apd_tra_type P rows still HELD; the summary totals.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_response_dto_1.PaymentPartyContextSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.PartyContextQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "partyContext", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One payment in full',
        description: 'Header, tenders (each bank row with its beneficiary), other-ledger lines, legs, ' +
            'allocations, debits applied, chequesIssued[] (leaf, book, printed, status), the ' +
            'post-dated vouchers and the ADVANCE (DR) bills. On a DRAFT, allocations[] and ' +
            'creditsApplied[] are what /payments/create REMEMBERED (abjId null) — a suggestion, ' +
            'never validated: re-read /payments/open-items and clamp.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_response_dto_1.PaymentSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_payment_dto_1.GetPaymentQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('adjacent'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The payment entered just before or just after this one',
        description: 'R-B4, as /receipts/adjacent — the register’s order, the register’s filters, a KEY back.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_response_dto_1.AdjacentVoucherSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.AdjacentVoucherQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "adjacent", null);
__decorate([
    (0, common_1.Get)('duplicate-check'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Has this party already been paid this amount on this date?',
        description: 'R-B6 — Σ tender amount paid to this party today, matched EXACTLY. A WARNING, never a refusal.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_response_dto_1.DuplicateCheckSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [open_item_dto_1.DuplicateCheckQueryDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "duplicateCheck", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save a draft payment',
        description: 'Upsert on avhVoucherId. Writes the header (DRAFT, no number), the tender rows (td_dr_cr ' +
            'CR, td_voucher_id NULL) and the other-ledger lines into avh_draft_lines. Nothing touches a ' +
            'bill (R10).\n\n' +
            'A CHEQUE row names its BOOK (cheque.chequeBookId) and never a number: the leaf is taken at ' +
            'post. A bank row may carry a beneficiary. BANK_CHARGES is seeded from tdMdrAmt and, for a ' +
            'TDS-applicable party, TDS_PAYABLE is seeded from accounts.tds_rates — a client figure that ' +
            'disagrees is a 409.\n\n' +
            'allocations[] and creditsApplied[] are REMEMBERED, not applied (notes 30).',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: payment_response_dto_1.PaymentDraftSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_payment_dto_1.SaveDraftPaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post the payment — the one-way door',
        description: 'ONE transaction, the receipt’s steps with the money going OUT. Everything in the body is a ' +
            'PREVIEW: the server re-reads every bill under a row lock, re-runs the allocation engine ' +
            '(direction OUT) and refuses a mismatch. Each cheque row takes its book’s next leaf under ' +
            'the book’s row lock and gets an acc_pdc_register row (apd_tra_type P); a post-dated cheque ' +
            'gets a voucher of its own dated the cheque; a remainder becomes an ADVANCE (DR) bill; TDS ' +
            'goes on the register.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: payment_response_dto_1.PaymentPostSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_payment_dto_1.PostPaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "postPayment", null);
__decorate([
    (0, common_1.Put)('update-header'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Change the narration and references on a posted payment',
        description: 'The ONLY edit a posted payment accepts. A body carrying anything else is a 400.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: payment_response_dto_1.PaymentHeaderSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_payment_dto_1.UpdatePaymentHeaderDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "updateHeader", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Reverse a posted payment',
        description: 'A reversal voucher for the payment AND for every post-dated cheque voucher; a negative ' +
            'adjustment row per row the post wrote; the advance bills soft-deleted; the register rows ' +
            'CANCELLED; the TDS register reversed. Refused when a cheque has gone past HELD (unwind it ' +
            'on Issued Cheques, menu 52), when a transfer is SETTLED by the bank, or when the advance ' +
            'has already been spent.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: payment_response_dto_1.PaymentCancelSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_payment_dto_1.CancelPaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Throw a draft away',
        description: 'DRAFT only, the four keys only. A POSTED payment is a 409 naming /cancel.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: payment_response_dto_1.PaymentDeleteSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [post_payment_dto_1.DeletePaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('amend'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Restate a posted payment in place — behind a company setting, default OFF',
        description: 'R20, as /receipts/amend: the whole payload plus baseRevision and editRemark; the same ' +
            'setting (accounts.allow_posted_amend), the same refusals as /cancel, the same audit rows. ' +
            'The old cheques’ leaves stay used; the re-apply takes fresh ones.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: payment_response_dto_1.PaymentAmendSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [amend_payment_dto_1.AmendPaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "amend", null);
exports.PaymentController = PaymentController = __decorate([
    (0, swagger_1.ApiTags)('Payments'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: payment_response_dto_1.PaymentErrorResponseDto }),
    (0, common_1.Controller)('payments'),
    (0, common_1.UseFilters)(payment_exception_filter_1.PaymentExceptionFilter),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        payment_service_1.PaymentService,
        payment_posting_service_1.PaymentPostingService,
        payment_cancel_service_1.PaymentCancelService,
        payment_amend_service_1.PaymentAmendService,
        payment_open_items_service_1.PaymentOpenItemsService])
], PaymentController);
//# sourceMappingURL=payment.controller.js.map