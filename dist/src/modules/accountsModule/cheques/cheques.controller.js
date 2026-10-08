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
exports.ChequesController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const cheques_exception_filter_1 = require("./cheques-exception.filter");
const cheques_service_1 = require("./cheques.service");
const cheque_deposit_service_1 = require("./cheque-deposit.service");
const cheque_clear_service_1 = require("./cheque-clear.service");
const cheque_bounce_service_1 = require("./cheque-bounce.service");
const cheque_reissue_service_1 = require("./cheque-reissue.service");
const cheque_return_service_1 = require("./cheque-return.service");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const cheque_query_dto_1 = require("./dto/cheque-query.dto");
const deposit_cheques_dto_1 = require("./dto/deposit-cheques.dto");
const cheque_actions_dto_1 = require("./dto/cheque-actions.dto");
const cheque_response_dto_1 = require("./dto/cheque-response.dto");
let ChequesController = class ChequesController {
    chequesService;
    depositService;
    clearService;
    bounceService;
    reissueService;
    returnService;
    constructor(chequesService, depositService, clearService, bounceService, reissueService, returnService) {
        this.chequesService = chequesService;
        this.depositService = depositService;
        this.clearService = clearService;
        this.bounceService = bounceService;
        this.reissueService = reissueService;
        this.returnService = returnService;
    }
    async list(query) {
        const data = await this.chequesService.list(query);
        return { success: true, message: `${data.total} cheque(s)`, data };
    }
    async get(query) {
        const data = await this.chequesService.get(query);
        return {
            success: true,
            message: `Cheque ${data.cheque.apdInstrumentNo} fetched successfully`,
            data,
        };
    }
    async history(query) {
        const data = await this.chequesService.history(query);
        return { success: true, message: `${data.entries.length} status step(s)`, data };
    }
    async deposit(dto) {
        const data = await this.depositService.deposit(dto);
        return {
            success: true,
            message: `${data.slip.chequeCount} cheque(s) deposited on slip ${data.slip.slipNo}`,
            data,
        };
    }
    async clear(dto) {
        const data = await this.clearService.clear(dto);
        return { success: true, message: `Cheque ${data.cheque.apdInstrumentNo} cleared`, data };
    }
    async bounce(dto) {
        const data = await this.bounceService.bounce(dto);
        return {
            success: true,
            message: `Cheque ${data.cheque.apdInstrumentNo} bounced — ${data.cheque.apdBounceReason}`,
            data,
        };
    }
    async represent(dto) {
        const data = await this.reissueService.represent(dto);
        return {
            success: true,
            message: `Cheque ${data.cheque.apdInstrumentNo} re-presented ` +
                `(presentation ${data.cheque.apdPresentCount})`,
            data,
        };
    }
    async replace(dto) {
        const data = await this.reissueService.replace(dto);
        return {
            success: true,
            message: `Cheque ${data.oldCheque.apdInstrumentNo} replaced by ${data.newCheque.apdInstrumentNo}`,
            data,
        };
    }
    async return(dto) {
        const data = await this.returnService.return(dto);
        return {
            success: true,
            message: `Cheque ${data.cheque.apdInstrumentNo} ` +
                (dto.action === receipt_enum_1.PdcStatus.CANCELLED ? 'cancelled' : 'returned to the party'),
            data,
        };
    }
    async depositSlip(query) {
        const data = await this.chequesService.depositSlip(query);
        return {
            success: true,
            message: `Slip ${data.slipNo}: ${data.chequeCount} cheque(s)`,
            data,
        };
    }
};
exports.ChequesController = ChequesController;
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The register, with the summary strip',
        description: 'The rows AND the aggregate. The grid `MAIN LIST - RECEIVED CHEQUES` serves TxnMainView ' +
            'through /configured-grid-sql — this route exists for the summary strip, which is an ' +
            'aggregate over the whole register and not over the page the grid returned.\n\n' +
            'The due bucket (FUTURE / DUE_TODAY / OVERDUE / STALE) is computed from the instrument ' +
            'date and today, never stored.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeListSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_query_dto_1.ListChequesQueryDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'One cheque, and everything hanging off it',
        description: 'The row, the ledger it was posted to, the four vouchers (receipt, clearing, bounce, ' +
            're-issue), every bill its adjustment rows name with what that bill owes NOW, the ' +
            'bounce-charge bill, and both ends of the replacement chain. One snapshot.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeDetailSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_query_dto_1.GetChequeQueryDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Every transition, with who and when',
        description: "The cheque's own public.txn_status_log rows, newest first. Append-only: correcting " +
            'history means appending another row, which is why a cheque that was bounced and then ' +
            're-presented shows both.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeHistorySuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_query_dto_1.ChequeHistoryQueryDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "history", null);
__decorate([
    (0, common_1.Post)('deposit'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Send a bundle of cheques to the bank',
        description: 'A BATCH, because a deposit slip is a batch: one bank, one date, one slip number, many ' +
            'cheques. All or nothing.\n\n' +
            '**No voucher is posted.** Handing paper over a counter moves no money — the bank has not ' +
            'paid us, it has taken custody. Crediting the bank here would leave every reconciliation ' +
            'afterwards with a permanent difference of whatever was in transit that night.\n\n' +
            "Every row must be HELD, and the deposit date must be on or after each cheque's own " +
            'instrument date. A BOUNCED row is refused with a pointer to /cheques/re-present.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeDepositSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [deposit_cheques_dto_1.DepositChequesDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "deposit", null);
__decorate([
    (0, common_1.Post)('clear'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The bank paid',
        description: '**ON_RECEIPT** — a ChqClr CONTRA: DR the bank, CR Cheques in Hand. Two legs, no party, no ' +
            'bills: the party was credited and the bills settled when the receipt was keyed, and ' +
            'touching them again would credit one payment twice. `av_recon_date` on the bank leg ' +
            'carries `bankDate`.\n\n' +
            '**ON_CLEARING** — an Rct: DR the bank, CR the party, with allocations through the ' +
            "receipt's own engine. Under this mode nothing was posted when the cheque arrived, so the " +
            'clearing IS the receipt.\n\n' +
            'The mode is read off the ROW (`apd_posting_mode`), never off the setting.\n\n' +
            'A second clearing is refused by `ux_avh_src` as "already cleared".',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeClearSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_actions_dto_1.ClearChequeDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "clear", null);
__decorate([
    (0, common_1.Post)('bounce'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The bank sent it back',
        description: 'Nine ordered steps in one transaction. Under ON_RECEIPT, five legs — DR party (amount + ' +
            'party charge), CR Cheques in Hand, CR BOUNCE_CHARGES_RECOVERED, DR BANK_CHARGES, CR the ' +
            'bank — then a negative adjustment row for everything this cheque settled, the C4 cascade ' +
            'over any advance it funded, and a JOURNAL bill for what the party now owes.\n\n' +
            'Under ON_CLEARING only the charge legs, because nothing was posted when it arrived.\n\n' +
            'A bounce is **never refused because an advance was spent** (§10): the bank has returned ' +
            'the cheque and that has to be recordable. The cascade unwinds the applications instead.\n\n' +
            'A charge with no role mapped is refused BY ROLE NAME before anything is written.\n\n' +
            'The body fields are `reason`, `bankCharge` and `partyCharge` — NOT `bounceReason` or ' +
            '`bounceCharges`, which is what the `apd_bounce_*` columns they land in would suggest. ' +
            '`bankCharge` is what the bank charged US and is our expense; `partyCharge` is what WE ' +
            'charge the party and raises a bill they owe. They are two different numbers, and both ' +
            'default to 0.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeBounceSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_actions_dto_1.BounceChequeDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "bounce", null);
__decorate([
    (0, common_1.Post)('re-present'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Send the same bounced cheque back to the bank',
        description: 'Not "undo the bounce" (C5). The bounce debited the party and relieved Cheques in Hand, ' +
            'and between the bounce and now the party genuinely was in debt. So this is a fresh act ' +
            'of taking a cheque in: an Rct re-issue voucher (DR Cheques in Hand / CR the party) ' +
            'against the bounce voucher, fresh allocations, then the deposit with ' +
            '`apd_present_count` going to 2.\n\n' +
            'The bounce columns are LEFT ALONE — that it bounced on the 14th stays true.\n\n' +
            '**The bills come back as they were.** With no `allocations` in the body, the re-issued ' +
            'credit is restored to the bills the bounce reversed, with the amounts it reversed — read ' +
            'out of those very reversal rows, which are the only place the per-bill split survives. ' +
            'It is not auto-FIFO: the same money is settling the same debt, and picking the oldest ' +
            'open invoice instead would pay a bill this cheque was never against. Send `allocations` ' +
            'to override that deliberately.\n\n' +
            'If a bill cannot take its share back — removed, or paid by something else since the ' +
            'bounce — the re-presentation is refused with a **409 naming the bill**, and nothing is ' +
            'written. Re-present again with explicit `allocations` once it is decided where that ' +
            'money should go.\n\n' +
            "The bounce-charge bill is in the party's open items and may be allocated to.",
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeRepresentSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_actions_dto_1.RepresentChequeDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "represent", null);
__decorate([
    (0, common_1.Post)('replace'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The party handed over different paper',
        description: 'A NEW register row, HELD, and the old one marked REPLACED pointing at it — never an edit ' +
            'of the old row (§10).\n\n' +
            'From BOUNCED the bounce has already taken it off the books. From HELD the old cheque is ' +
            'RETURNED first, with no charges, because nothing was dishonoured — the party simply ' +
            'swapped the paper.\n\n' +
            'The new amount need not equal the old one. A post-dated replacement gets its own voucher ' +
            'dated the cheque, and its adjustment rows carry `abj_is_post_dated` so the bills stay ' +
            'open until it matures.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeReplaceSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_actions_dto_1.ReplaceChequeDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "replace", null);
__decorate([
    (0, common_1.Post)('return'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Give the paper back, or void it',
        description: "**HELD only.** Once a cheque has gone to the bank, the bank's record and ours have to " +
            'agree: a cheque this system says was handed back cannot also be on a slip the bank is ' +
            'holding. A DEPOSITED cheque waits for the bank to say cleared or bounced.\n\n' +
            'RETURNED — the party has the paper. CANCELLED — it is void, and `ux_apd_instrument` ' +
            'excludes CANCELLED so the same cheque number can be keyed again.\n\n' +
            'Under ON_RECEIPT this posts the reversal (DR party / CR Cheques in Hand), reopens the ' +
            'bills and runs the C4 cascade. Under ON_CLEARING the register moves alone.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.ChequeReturnSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_actions_dto_1.ReturnChequeDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "return", null);
__decorate([
    (0, common_1.Get)('deposit-slip'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The dataset behind the printed slip',
        description: "Keyed by (company, bank ledger, deposit date, slip no): the bank's own account from " +
            'accounts.acc_ledger_bank_accounts, then one line per cheque deposited under that slip.\n\n' +
            'The print purpose CHEQUE_DEPOSIT_SLIP is seeded; until a template version carries the ' +
            'dataset, this route is what prints it.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: cheque_response_dto_1.DepositSlipSuccessDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: cheque_response_dto_1.ChequeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cheque_query_dto_1.DepositSlipQueryDto]),
    __metadata("design:returntype", Promise)
], ChequesController.prototype, "depositSlip", null);
exports.ChequesController = ChequesController = __decorate([
    (0, swagger_1.ApiTags)('Received Cheques'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('cheques'),
    (0, common_1.UseFilters)(cheques_exception_filter_1.ChequesExceptionFilter),
    __metadata("design:paramtypes", [cheques_service_1.ChequesService,
        cheque_deposit_service_1.ChequeDepositService,
        cheque_clear_service_1.ChequeClearService,
        cheque_bounce_service_1.ChequeBounceService,
        cheque_reissue_service_1.ChequeReissueService,
        cheque_return_service_1.ChequeReturnService])
], ChequesController);
//# sourceMappingURL=cheques.controller.js.map