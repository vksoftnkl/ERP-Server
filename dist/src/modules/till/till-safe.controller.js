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
exports.TillSafeController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const till_context_service_1 = require("./till-context.service");
const till_exception_filter_1 = require("./till-exception.filter");
const till_safe_service_1 = require("./services/till-safe.service");
const till_safe_dto_1 = require("./dto/till-safe.dto");
const till_response_dto_1 = require("./dto/till-response.dto");
const till_enum_1 = require("./types/till-enum");
let TillSafeController = class TillSafeController {
    context;
    safes;
    constructor(context, safes) {
        this.context = context;
        this.safes = safes;
    }
    async balance(query) {
        await this.requireAny([
            [till_enum_1.TILL_MENU.CASH_OFFICE, 'view'],
            [till_enum_1.TILL_MENU.SESSIONS, 'view'],
        ], 'see the safe');
        const data = await this.safes.balance(query);
        return {
            success: true,
            message: `${data.safes.length} safe(s), ${data.inTransit.length} remittance(s) in transit`,
            data,
        };
    }
    async count(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.CASH_OFFICE, 'create', 'count the safe');
        if (dto.treatment) {
            await this.context.requireRight(till_enum_1.TILL_MENU.CASH_OFFICE, 'override', 'decide a safe gap');
        }
        const data = await this.safes.count({
            companyId: dto.companyId,
            branchId: dto.branchId,
            tenantId: dto.tenantId ?? null,
            safeId: dto.safeId,
            lines: dto.lines,
            notes: dto.notes ?? null,
            witnessId: dto.witnessId ?? null,
            witnessPin: dto.witnessPin ?? null,
            treatment: dto.treatment ?? null,
            reasonId: dto.reasonId ?? null,
            approverPin: dto.approverPin ?? null,
        });
        return {
            success: true,
            message: data.outcome === till_enum_1.TillSafeGapOutcome.EXACT
                ? `${data.safeName}: ${data.counted.toFixed(2)} counted, exactly as expected`
                : `${data.safeName}: ${data.counted.toFixed(2)} counted against ${data.expected.toFixed(2)} (${data.outcome})`,
            data,
        };
    }
    async decideVariance(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.CASH_OFFICE, 'override', 'decide a safe gap');
        const data = await this.safes.decideVariance({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            tvrId: dto.tvrId,
            treatment: dto.treatment,
            reasonId: dto.reasonId,
            notes: dto.notes ?? null,
            approverPin: dto.approverPin ?? null,
            secondId: dto.secondId ?? null,
            secondPin: dto.secondPin ?? null,
        });
        return {
            success: true,
            message: `Safe gap ${data.variance.toFixed(2)} decided: ${data.treatment}`,
            data,
        };
    }
    async remit(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.CASH_OFFICE, 'create', 'remit cash from the safe');
        const data = await this.safes.remit({
            companyId: dto.companyId,
            branchId: dto.branchId,
            tenantId: dto.tenantId ?? null,
            safeId: dto.safeId,
            amount: dto.amount,
            bankLedgerId: dto.bankLedgerId,
            mode: dto.mode,
            bagNo: dto.bagNo ?? null,
            sealNo: dto.sealNo ?? null,
            citAgency: dto.citAgency ?? null,
            slipNo: dto.slipNo ?? null,
            slipDate: dto.slipDate ?? null,
            lines: dto.lines ?? null,
            notes: dto.notes ?? null,
            approverId: dto.approverId ?? null,
            approverPin: dto.approverPin ?? null,
        });
        return {
            success: true,
            message: `REMIT ${data.movement.tcmDocNo}: ${data.movement.tcmAmount.toFixed(2)} ${data.movement.tcmRemitStatus}`,
            data,
        };
    }
    async confirmRemit(dto) {
        await this.context.requireRight(till_enum_1.TILL_MENU.CASH_OFFICE, 'create', 'confirm a remittance');
        if (dto.treatment) {
            await this.context.requireRight(till_enum_1.TILL_MENU.CASH_OFFICE, 'override', 'decide a safe gap');
        }
        const data = await this.safes.confirmRemit({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            tcmId: dto.tcmId,
            bankDate: dto.bankDate,
            bankRef: dto.bankRef,
            bankAmount: dto.bankAmount ?? null,
            treatment: dto.treatment ?? null,
            reasonId: dto.reasonId ?? null,
            notes: dto.notes ?? null,
            approverPin: dto.approverPin ?? null,
            witnessId: dto.witnessId ?? null,
            witnessPin: dto.witnessPin ?? null,
        });
        return {
            success: true,
            message: `REMIT ${data.docNo} confirmed: ${data.credited.toFixed(2)} credited of ${data.sent.toFixed(2)}`,
            data,
        };
    }
    async requireAny(options, action) {
        for (const [menuId, right] of options) {
            if ((await this.context.rights(menuId))[right]) {
                return;
            }
        }
        const [menuId, right] = options[0];
        await this.context.requireRight(menuId, right, action);
    }
};
exports.TillSafeController = TillSafeController;
__decorate([
    (0, common_1.Get)('safes/balance'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The safes of a branch: what each should hold, and how it got there (notes 118 §1)',
        description: 'Per safe: opening (the last SAFE count; before any, the safe expects what its ledger holds), in (hand-overs ' +
            'and drops straight in or once received, pickups, transfers in, back-office cash receipts on its ledger), out ' +
            '(float issues, top-ups, remittances, transfers out, back-office cash payments / expenses), exchanges (counted, ' +
            'net zero), expected, the ledger’s own balance and the drift between the two, the insured limit, the last count ' +
            '(when, by whom, the difference), the remittances in transit and the gaps still pending. Under till.blind_close ' +
            'the figures are null (`figuresVisible` false) unless the caller holds Cash Office (287) or Till Sessions (273) ' +
            'OVERRIDE: the count is blind. Plus the branch’s CIT remittances not yet confirmed, oldest first. Cash Office ' +
            '(287) VIEW, or Till Sessions (273) VIEW.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_safe_dto_1.TillSafeBalanceQueryDto]),
    __metadata("design:returntype", Promise)
], TillSafeController.prototype, "balance", null);
__decorate([
    (0, common_1.Post)('safes/count'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Count the safe — blind; the answer shows what it should have held (notes 118 §2)',
        description: 'A SAFE till_count of today’s business day (more than one a day: the last is the day’s), `tct_expected` what ' +
            'the safe should hold, SAFE_COUNT journalled; tbd_safe_counted / _expected kept current, SAFE_NOT_COUNTED ' +
            'cleared. The difference is a till_variance of stage SAFE (no session): EXACT · within till.cash_tolerance ' +
            'posted at once (TVar WITHIN_TOLERANCE, Cash Short & Excess against the safe) · beyond it decided here with ' +
            '`treatment` + `reasonId` + `approverPin` under SAFE_VARIANCE (the caller’s grant must cover it — 403 ' +
            'TILL_APPROVER_NO_GRANT / _LIMIT / _PIN otherwise, nothing written; a two-person rule takes the witness as ' +
            'its second signature, none → 403 TILL_APPROVER_SECOND) · else SENT_FOR_APPROVAL for safes/decide-variance. ' +
            'A day CLOSED → 409 TILL_DAY_CLOSED. Cash Office (287) CREATE; `treatment` needs OVERRIDE too.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_RIGHT_CREATE · TILL_RIGHT_OVERRIDE · TILL_WITNESS_PIN_REQUIRED · TILL_WITNESS_PIN · TILL_APPROVER_NO_GRANT · ' +
            'TILL_APPROVER_LIMIT · TILL_APPROVER_PIN · TILL_APPROVER_SECOND',
    }),
    (0, swagger_1.ApiConflictResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_DAY_CLOSED · TILL_DAY_NOT_OPEN · TILL_SAFE_CHANGED (the safe moved while it was judged)',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_COUNT_INVALID · TILL_SAFE_MISSING (inactive) · TILL_WITNESS_NO_PIN · TILL_REASON_INVALID · TILL_LEDGER_UNMAPPED',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_safe_dto_1.CountTillSafeDto]),
    __metadata("design:returntype", Promise)
], TillSafeController.prototype, "count", null);
__decorate([
    (0, common_1.Post)('safes/decide-variance'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Decide a pending safe gap — a safe count’s or a short bank credit’s (notes 118 §2)',
        description: 'A till_variance of stage SAFE / REMIT still PENDING (else 409 TILL_VARIANCE_NOT_PENDING): SAFE_VARIANCE with ' +
            'the caller the approver (grant + PIN by the rule’s channel), the no-self flag not binding; a two-person rule ' +
            'wants `secondId` + `secondPin` (not the caller, not whoever raised the gap). EXPENSE or SUSPENSE, a VARIANCE ' +
            'reason; the TVar posts dated today’s business day; a till_approval row; VARIANCE_DECIDED. Cash Office (287) ' +
            'OVERRIDE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: till_response_dto_1.TillErrorResponseDto, description: 'TILL_VARIANCE_NOT_PENDING' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_safe_dto_1.DecideTillSafeVarianceDto]),
    __metadata("design:returntype", Promise)
], TillSafeController.prototype, "decideVariance", null);
__decorate([
    (0, common_1.Post)('movements/remit'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Remit cash from the safe to the bank (notes 118 §3)',
        description: 'A REMIT movement with no session, dated today’s business day, numbered by its CRem: BANK_DEPOSIT (staff) Dr ' +
            'Bank / Cr Safe, DEPOSITED · CIT (an agency) Dr Cash in transit / Cr Safe, IN_TRANSIT until remit-confirm. ' +
            'Above what the safe should hold → 422 TILL_REMIT_OVER_BALANCE. `lines` (optional) are the notes sent and must ' +
            'make `amount`. The REMITTANCE rule as set (shipped NEVER: nothing asked); when it asks, `approverId` (left out ' +
            '= the caller) types `approverPin` here. tbd_remitted kept current — and SAFE_OVER_INSURED reads the safe ' +
            'ledger, which the CRem lowers. Cash Office (287) CREATE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_DAY_CLOSED · TILL_DAY_NOT_OPEN',
    }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_REMIT_OVER_BALANCE · TILL_MOVEMENT_INVALID (bankLedgerId, mode, amount) · TILL_COUNT_INVALID · ' +
            'TILL_LEDGER_UNMAPPED (CASH_IN_TRANSIT) · TILL_SAFE_MISSING',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_safe_dto_1.RemitTillCashDto]),
    __metadata("design:returntype", Promise)
], TillSafeController.prototype, "remit", null);
__decorate([
    (0, common_1.Post)('movements/remit-confirm'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({
        summary: 'Confirm a CIT remittance against the bank statement (notes 118 §3)',
        description: 'On a CIT REMIT IN_TRANSIT (else 409 TILL_REMIT_NOT_IN_TRANSIT): the Contra (CRem) Dr Bank / Cr Cash in transit ' +
            'for `bankAmount` (left out = what was sent; none for 0), dated `bankDate`, the row CONFIRMED, REMIT_CONFIRMED ' +
            'journalled. A difference is a REMIT-stage gap against Cash in transit, judged as a safe count’s (within ' +
            'tolerance posted; beyond it decided here with `treatment` — Cash Office (287) OVERRIDE — else PENDING). Cash ' +
            'Office (287) CREATE.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: till_response_dto_1.TillSuccessDto }),
    (0, swagger_1.ApiConflictResponse)({ type: till_response_dto_1.TillErrorResponseDto, description: 'TILL_REMIT_NOT_IN_TRANSIT' }),
    (0, swagger_1.ApiUnprocessableEntityResponse)({
        type: till_response_dto_1.TillErrorResponseDto,
        description: 'TILL_MOVEMENT_INVALID (bankDate, not a REMIT) · TILL_REASON_INVALID · TILL_LEDGER_UNMAPPED',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [till_safe_dto_1.ConfirmTillRemitDto]),
    __metadata("design:returntype", Promise)
], TillSafeController.prototype, "confirmRemit", null);
exports.TillSafeController = TillSafeController = __decorate([
    (0, swagger_1.ApiTags)('Till'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: till_response_dto_1.TillErrorResponseDto }),
    (0, common_1.Controller)('till'),
    (0, common_1.UseFilters)(till_exception_filter_1.TillExceptionFilter),
    __metadata("design:paramtypes", [till_context_service_1.TillContextService,
        till_safe_service_1.TillSafeService])
], TillSafeController);
//# sourceMappingURL=till-safe.controller.js.map