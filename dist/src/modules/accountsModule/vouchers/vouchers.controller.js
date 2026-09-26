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
exports.VouchersController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const vouchers_exception_filter_1 = require("./vouchers-exception.filter");
const voucher_types_service_1 = require("./voucher-types.service");
const voucher_lookups_service_1 = require("./voucher-lookups.service");
const voucher_register_service_1 = require("./voucher-register.service");
const voucher_cancel_service_1 = require("./voucher-cancel.service");
const voucher_query_dto_1 = require("./dto/voucher-query.dto");
const voucher_payload_dto_1 = require("./dto/voucher-payload.dto");
const voucher_response_dto_1 = require("./dto/voucher-response.dto");
let VouchersController = class VouchersController {
    requestContext;
    types;
    lookups;
    register;
    cancelService;
    constructor(requestContext, types, lookups, register, cancelService) {
        this.requestContext = requestContext;
        this.types = types;
        this.lookups = lookups;
        this.register = register;
        this.cancelService = cancelService;
    }
    async listTypes(q) {
        const menuId = q.menuId ?? null;
        const types = await this.types.typesForCaller(this.requestContext.getUserId(), menuId);
        return {
            success: true,
            message: types.length === 0
                ? 'You have no voucher types on this menu. Ask for Journal, Contra … rights.'
                : `${types.length} voucher type(s)`,
            data: { menuId, types },
        };
    }
    async ledgerPick(q) {
        const data = await this.lookups.ledgerPick(q);
        return { success: true, message: `${data.ledgers.length} ledger(s)`, data };
    }
    async ledgerBalance(q) {
        const data = await this.lookups.ledgerBalance(q);
        return { success: true, message: `${data.amount} ${data.side} as on ${data.asOn}`, data };
    }
    async partyFacts(q) {
        const data = await this.lookups.partyFacts(q);
        return { success: true, message: `Facts for ${data.name}`, data };
    }
    async openBills(q) {
        const data = await this.lookups.openBills(q);
        return { success: true, message: `${data.bills.length} open bill(s)`, data };
    }
    async taxRates(q) {
        const data = await this.lookups.taxRates(q);
        return { success: true, message: `${data.rates.length} rate(s)`, data };
    }
    async get(q) {
        const data = await this.register.get(q);
        return {
            success: true,
            message: `${data.header.typeName} ${data.header.voucherRefno ?? '(draft)'} — ${data.header.status}`,
            data,
        };
    }
    async create(dto, raw) {
        const data = await this.register.create(dto, raw);
        return { success: true, message: data.created ? 'Draft saved' : 'Draft updated', data };
    }
    async validate(dto) {
        const data = await this.register.validate(dto);
        return {
            success: true,
            message: data.ok
                ? `Balanced: ${data.derived.totals.debit} = ${data.derived.totals.credit}`
                : `${data.refusals.length} refusal(s)`,
            data,
        };
    }
    async post(dto) {
        const data = await this.register.post(dto);
        return { success: true, message: `Posted ${data.header.voucherRefno}.`, data };
    }
    async cancel(dto) {
        const data = await this.cancelService.cancel(dto);
        return {
            success: true,
            message: `${data.voucherRefno} cancelled — reversed by ${data.reversalRefno}`,
            data,
        };
    }
    async delete(dto) {
        const data = await this.register.deleteDraft(dto);
        return { success: true, message: 'Draft deleted', data };
    }
};
exports.VouchersController = VouchersController;
__decorate([
    (0, common_1.Get)('types'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The register types the caller may VIEW, each with its rules and the caller’s rights',
        description: 'Decision E: rights live on the voucher TYPE’s menu (acc_voucher_types.vchr_menu_id). ' +
            '`menuId` = a type’s own menu (101 Debit Note, 102 Credit Note, 103 Journal, 104 Contra, ' +
            '163 Purchase (Accounting), 259 Sales (Accounting), 260 Receipt Voucher, 261 Payment ' +
            'Voucher) returns that type only; the Voucher Register menu (262), or none, returns every ' +
            'type the caller may view. A type the user lacks VIEW on never reaches the band.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.VoucherTypesSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_query_dto_1.VoucherTypesQueryDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "listTypes", null);
__decorate([
    (0, common_1.Get)('ledger-pick'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Ledgers legal on one side of one voucher type',
        description: 'The type’s vchr_dr_groups / vchr_cr_groups, a sub-group of a listed group counting, MINUS ' +
            'instrument-controlled ledgers (Cheques in Hand, PDC holding, card / UPI clearing — those ' +
            'belong to Received / Issued Cheques, menus 51 / 52). Empty groups = any ledger.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.LedgerPickSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_query_dto_1.LedgerPickQueryDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "ledgerPick", null);
__decorate([
    (0, common_1.Get)('ledger-balance'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'A ledger’s book balance as on a date',
        description: 'Opening (acc_opening_balance, this year) + Σ av_signed_amount of POSTED and CANCELLED ' +
            'vouchers dated ≤ asOn. Never led_total_*. The same figure the Ledger Statement closes at.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.LedgerBalanceSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_query_dto_1.LedgerBalanceQueryDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "ledgerBalance", null);
__decorate([
    (0, common_1.Get)('party-facts'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'GSTIN, state, credit days, bill-by-bill, TDS section and rate, outstanding',
        description: 'The facts line under the party box. The TDS rate is the one in force on asOn.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.PartyFactsSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_query_dto_1.PartyFactsQueryDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "partyFacts", null);
__decorate([
    (0, common_1.Get)('open-bills'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'A party’s open bills on one side, oldest first',
        description: 'acc_bill_balance rows with pending > 0, every year. side DR = what the party owes ' +
            '(a CR party leg settles these); CR = what they hold (a DR party leg settles these).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.OpenBillsSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_query_dto_1.OpenBillsQueryDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "openBills", null);
__decorate([
    (0, common_1.Get)('tax-rates'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The active GST rates',
        description: 'For the client’s preview of the generated legs. The server recomputes regardless.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.TaxRatesSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_query_dto_1.TaxRatesQueryDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "taxRates", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One voucher in full',
        description: 'Header, legs (each flagged generated, with its role), allocations, the bills it raised, ' +
            'the GST document, the TDS rows, the caller’s rights on the type’s menu, and the locks ' +
            '{editable, dayClosed, periodLocked, allocatedElsewhere}. A DRAFT also hands back the ' +
            'typed payload exactly as /create stored it (`draft`).',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.VoucherSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_payload_dto_1.GetVoucherQueryDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Save or update a DRAFT',
        description: 'The header row with NO number, and the payload verbatim in avh_draft_lines. No legs, no ' +
            'allocations, no bills, no GST or TDS rows exist for a DRAFT — it touches no balance. ' +
            'Needs CREATE (new) or EDIT (an existing draft) on the type’s menu. A POSTED voucher here ' +
            'is a 409: it is corrected by cancel and re-enter.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: voucher_response_dto_1.DraftSavedSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_payload_dto_1.VoucherPayloadDto, Object]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Derive the voucher — writes nothing',
        description: 'The screen’s calculator. Returns the DERIVED voucher (every leg, generated legs flagged, ' +
            'the GST summary, the TDS, the party amount, the bills to be raised) plus refusals[] and ' +
            'warnings[] together, so five problems are fixed in one visit. Always a 200: a refusal is ' +
            'the ANSWER, not an error. An overridable WARN stays a WARN here and becomes a refusal on ' +
            '/post unless it is in overrides[] and the user holds um_can_override.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: voucher_response_dto_1.ValidateSuccessDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_payload_dto_1.ValidateVoucherDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Post — the one posting routine, in one transaction',
        description: 'Rights → calendar → the typed lines → the GST legs → the TDS leg → the party leg → ' +
            'Σ DR = Σ CR → number → header and legs → bills and allocations → the GST document → the ' +
            'TDS register → POSTED → the trial-mode books check. Any failure rolls everything back, ' +
            'the number included. A new voucher posts without a prior /create; a draft posts into its ' +
            'own header. Returns what /get returns.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: voucher_response_dto_1.VoucherSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_payload_dto_1.PostVoucherDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "post", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel = a reversal under the Rev type',
        description: 'A Rev voucher in its own series (rev000NN), dated the ORIGINAL’s date, narration ' +
            '"Reversal of <refno>", linked both ways; every leg mirrored; own allocations reversed by ' +
            'counter-rows (never deleted); the raised bill closed; the GST document CANCELLED; a TDS ' +
            'reversal row. The original’s series never loses a number. Refused when another voucher ' +
            'has settled against a bill this one raised, when an IRN is live, or when the TDS was ' +
            'deposited by challan.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: voucher_response_dto_1.CancelSuccessDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_payload_dto_1.CancelVoucherDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Throw a DRAFT away',
        description: 'DRAFT only. A POSTED voucher is a 409 naming /cancel — money in the books is reversed, never removed.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: voucher_response_dto_1.DeleteSuccessDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: voucher_response_dto_1.VoucherErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [voucher_payload_dto_1.DeleteVoucherDto]),
    __metadata("design:returntype", Promise)
], VouchersController.prototype, "delete", null);
exports.VouchersController = VouchersController = __decorate([
    (0, swagger_1.ApiTags)('Vouchers'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('vouchers'),
    (0, common_1.UseFilters)(vouchers_exception_filter_1.VouchersExceptionFilter),
    __metadata("design:paramtypes", [request_context_service_1.RequestContextService,
        voucher_types_service_1.VoucherTypesService,
        voucher_lookups_service_1.VoucherLookupsService,
        voucher_register_service_1.VoucherRegisterService,
        voucher_cancel_service_1.VoucherCancelService])
], VouchersController);
//# sourceMappingURL=vouchers.controller.js.map