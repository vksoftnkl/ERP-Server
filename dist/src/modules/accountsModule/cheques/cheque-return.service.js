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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChequeReturnService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_guards_1 = require("../receipt/receipt.guards");
const receipt_utils_1 = require("../receipt/receipt.utils");
const cheques_guards_1 = require("./cheques.guards");
const cheques_utils_1 = require("./cheques.utils");
const cheque_voucher_helper_1 = require("./cheque-voucher.helper");
const cheque_reversal_helper_1 = require("./cheque-reversal.helper");
const cheque_enum_1 = require("./types/cheque-enum");
const RETURN_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 60_000 };
let ChequeReturnService = class ChequeReturnService {
    prisma;
    requestContext;
    recompute;
    constructor(prisma, requestContext, recompute) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.recompute = recompute;
    }
    async return(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            const cheque = await (0, cheques_guards_1.lockChequeOrThrow)(tx, dto);
            (0, cheques_guards_1.assertStatus)(cheque, cheque_enum_1.RETURNABLE_STATUSES, dto.action.toLowerCase());
            const outcome = await this.unwind(tx, cheque, {
                reason: dto.reason,
                actor,
                asOf: (0, receipt_utils_1.todayUtc)(),
            });
            const now = new Date();
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
                data: {
                    apdStatus: dto.action,
                    apdCancelReason: dto.reason.slice(0, cheque_enum_1.CANCEL_REASON_MAX_LENGTH),
                    apdCancelDate: now,
                    apdRemarks: dto.remarks ?? cheque.apdRemarks,
                    apdStatusOn: now,
                    apdStatusBy: actor,
                    apdModifiedOn: now,
                    apdModifiedBy: actor,
                },
            });
            await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                fromStatus: cheque.apdStatus,
                toStatus: dto.action,
                remarks: dto.reason,
                actor,
                changedOn: now,
            });
            return {
                cheque: await (0, cheques_utils_1.reloadChequeRow)(tx, cheque.apdId, cheque.apdAccYear),
                reversalVoucher: outcome.voucher,
                legs: outcome.legs,
                billsReopened: outcome.billsReopened,
                cascade: outcome.cascade,
            };
        }, RETURN_TRANSACTION_OPTIONS);
    }
    async unwind(tx, cheque, params) {
        const emptyCascade = {
            advanceBillsRemoved: [],
            advanceApplicationsReversed: 0,
            advancesLeftMixed: [],
        };
        if (cheque.apdPostingMode === receipt_enum_1.PdcPostingMode.ON_CLEARING || !cheque.apdVoucherId) {
            return { voucher: null, legs: [], billsReopened: [], cascade: emptyCascade };
        }
        const inHand = await (0, cheques_guards_1.resolveChequesInHand)(tx, cheque);
        const voucherDate = cheque.apdReceivedOn;
        const voucherAccYear = (0, receipt_guards_1.accYearOf)(voucherDate);
        const written = await (0, cheque_voucher_helper_1.writeChequeVoucher)(tx, {
            typeCode: cheque_enum_1.RECEIPT_VOUCHER_TYPE_CODE,
            field: 'apdId',
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            accYear: voucherAccYear,
            voucherDate,
            partyId: cheque.apdPartyId,
            employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
            docAmount: cheque.apdAmount,
            remarks: `Cheque ${cheque.apdInstrumentNo} returned to the party: ${params.reason}`,
            againstVoucherId: cheque.apdVoucherId,
            againstAccYear: cheque.apdVoucherAccYear,
            userId: params.actor,
            actor: params.actor,
            legs: [
                {
                    drCr: receipt_enum_1.DrCr.DR,
                    ledgerId: cheque.apdPartyId,
                    amount: cheque.apdAmount,
                    remarks: `Cheque ${cheque.apdInstrumentNo} returned`,
                },
                {
                    drCr: receipt_enum_1.DrCr.CR,
                    ledgerId: inHand.ledgerId,
                    amount: cheque.apdAmount,
                    remarks: `Cheque ${cheque.apdInstrumentNo} returned`,
                },
            ],
        });
        const scope = {
            voucherId: written.ref.voucherId,
            accYear: voucherAccYear,
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            userId: params.actor,
            sessionId: null,
            actor: params.actor,
            reason: `Cheque ${cheque.apdInstrumentNo} returned: ${params.reason}`,
        };
        const reversed = await (0, cheque_reversal_helper_1.reverseChequeAdjustments)(tx, cheque, scope);
        const cascade = await (0, cheque_reversal_helper_1.cascadeAdvances)(tx, cheque, scope, reversed.nextRowNo);
        const touched = [...reversed.bills, ...cascade.bills];
        const recomputed = await this.recompute.recomputeBills(tx, touched, params.asOf);
        const refs = await this.loadBillRefs(tx, touched);
        return {
            voucher: written.ref,
            legs: written.legs,
            billsReopened: recomputed.map((bill) => {
                const ref = refs.get(`${bill.billId}|${bill.accYear}`);
                return {
                    billId: bill.billId,
                    billAccYear: bill.accYear,
                    billType: ref?.billType ?? '',
                    docRefno: ref?.docRefno ?? '',
                    docDate: ref?.docDate ?? '',
                    dueDate: ref?.dueDate ?? null,
                    billAmount: (0, receipt_utils_1.toAmount)(bill.billAmount ?? receipt_utils_1.ZERO),
                    pendingAmount: (0, receipt_utils_1.toAmount)(bill.pendingAmount),
                    settledByThisCheque: 0,
                };
            }),
            cascade: cascade.report,
        };
    }
    async loadBillRefs(tx, bills) {
        if (bills.length === 0) {
            return new Map();
        }
        const rows = await tx.accBillBalance.findMany({
            where: { OR: bills.map((bill) => ({ ablId: bill.billId, ablAccYear: bill.accYear })) },
            select: {
                ablId: true,
                ablAccYear: true,
                ablBillType: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablDueDate: true,
            },
        });
        return new Map(rows.map((row) => [
            `${row.ablId}|${row.ablAccYear}`,
            {
                billType: row.ablBillType,
                docRefno: row.ablDocRefno,
                docDate: (0, receipt_utils_1.toDateString)(row.ablDocDate) ?? '',
                dueDate: (0, receipt_utils_1.toDateString)(row.ablDueDate),
            },
        ]));
    }
};
exports.ChequeReturnService = ChequeReturnService;
exports.ChequeReturnService = ChequeReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], ChequeReturnService);
//# sourceMappingURL=cheque-return.service.js.map