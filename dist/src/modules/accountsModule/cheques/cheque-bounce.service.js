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
exports.ChequeBounceService = void 0;
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
const cheque_ledger_roles_1 = require("./cheque-ledger-roles");
const cheque_enum_1 = require("./types/cheque-enum");
const BOUNCE_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };
let ChequeBounceService = class ChequeBounceService {
    prisma;
    requestContext;
    recompute;
    constructor(prisma, requestContext, recompute) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.recompute = recompute;
    }
    async bounce(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const bounceDate = (0, receipt_utils_1.toDateOnly)(dto.bounceDate);
        const bankCharge = (0, receipt_utils_1.money)(dto.bankCharge);
        const partyCharge = (0, receipt_utils_1.money)(dto.partyCharge);
        return this.prisma.$transaction(async (tx) => {
            const cheque = await (0, cheques_guards_1.lockChequeOrThrow)(tx, dto);
            (0, cheques_guards_1.assertStatus)(cheque, cheque_enum_1.BOUNCEABLE_STATUSES, 'bounced');
            (0, cheques_guards_1.assertNotInFuture)(bounceDate, 'A bounce', 'bounceDate');
            (0, cheques_guards_1.assertDateOnOrAfter)(bounceDate, cheque.apdDepositDate, `Bounce ${cheque.apdInstrumentNo}`, 'the day it was deposited', 'bounceDate');
            const reason = dto.reason.trim();
            if (!reason) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    { field: 'reason', message: 'A bounce has to say why the bank sent it back' },
                ]);
            }
            const onReceipt = cheque.apdPostingMode !== receipt_enum_1.PdcPostingMode.ON_CLEARING;
            if (!onReceipt && bankCharge.isZero() && partyCharge.isZero()) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Nothing to post', [
                    {
                        field: 'apdId',
                        message: `${cheque.apdInstrumentNo} was posted ON_CLEARING, so nothing stands behind it to ` +
                            'reverse. With no charges on either side there is no voucher to write — record ' +
                            'the bounce with a charge, or return the cheque instead.',
                    },
                ]);
            }
            const { bankChargeLedgerId, recoveredLedgerId } = await this.resolveRoles(tx, {
                cheque,
                bankCharge,
                partyCharge,
            });
            const inHand = onReceipt ? await (0, cheques_guards_1.resolveChequesInHand)(tx, cheque) : null;
            const bank = bankCharge.greaterThan(0)
                ? await (0, cheques_guards_1.loadBankLedger)(tx, cheque.apdCompanyId, cheque.apdBankLedgerId, 'apdId')
                : null;
            const voucherAccYear = (0, receipt_guards_1.accYearOf)(bounceDate);
            const legs = this.buildLegs({
                cheque,
                onReceipt,
                inHandLedgerId: inHand?.ledgerId ?? null,
                bankLedgerId: bank?.ledgerId ?? null,
                bankChargeLedgerId,
                recoveredLedgerId,
                bankCharge,
                partyCharge,
            });
            const written = await (0, cheque_voucher_helper_1.writeChequeVoucher)(tx, {
                typeCode: cheque_enum_1.BOUNCE_VOUCHER_TYPE_CODE,
                field: 'apdId',
                companyId: cheque.apdCompanyId,
                branchId: cheque.apdBranchId,
                tenantId: cheque.apdTenantId,
                accYear: voucherAccYear,
                voucherDate: bounceDate,
                partyId: cheque.apdPartyId,
                employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
                docAmount: cheque.apdAmount,
                remarks: `Cheque ${cheque.apdInstrumentNo} returned — ${reason}` +
                    (dto.reasonText ? ` (${dto.reasonText})` : ''),
                againstVoucherId: cheque.apdVoucherId,
                againstAccYear: cheque.apdVoucherAccYear,
                userId: actor,
                actor,
                legs,
            });
            const reversalScope = {
                voucherId: written.ref.voucherId,
                accYear: voucherAccYear,
                companyId: cheque.apdCompanyId,
                branchId: cheque.apdBranchId,
                tenantId: cheque.apdTenantId,
                userId: actor,
                sessionId: null,
                actor,
                reason: `Cheque ${cheque.apdInstrumentNo} bounced: ${reason}`,
            };
            const reversed = await (0, cheque_reversal_helper_1.reverseChequeAdjustments)(tx, cheque, reversalScope);
            const cascade = await (0, cheque_reversal_helper_1.cascadeAdvances)(tx, cheque, reversalScope, reversed.nextRowNo);
            const chargeBill = await this.writeChargeBill(tx, {
                cheque,
                partyCharge,
                bounceDate,
                voucherId: written.ref.voucherId,
                voucherAccYear,
                voucherRefno: written.ref.voucherRefno,
                voucherTypeId: written.voucherTypeId,
                voucherNo: written.voucherNo,
                reason,
                actor,
            });
            const touched = [...reversed.bills, ...cascade.bills];
            const recomputed = await this.recompute.recomputeBills(tx, touched, (0, receipt_utils_1.todayUtc)());
            const now = new Date();
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
                data: {
                    apdStatus: receipt_enum_1.PdcStatus.BOUNCED,
                    apdBounceDate: bounceDate,
                    apdBounceReason: reason.slice(0, 150),
                    apdBounceCharges: bankCharge.plus(partyCharge),
                    apdBounceVoucherId: written.ref.voucherId,
                    apdBounceAccYear: voucherAccYear,
                    apdChargeVoucherId: partyCharge.greaterThan(0) ? written.ref.voucherId : null,
                    apdChargeAccYear: partyCharge.greaterThan(0) ? voucherAccYear : null,
                    apdStatusOn: now,
                    apdStatusBy: actor,
                    apdModifiedOn: now,
                    apdModifiedBy: actor,
                },
            });
            await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                fromStatus: cheque.apdStatus,
                toStatus: receipt_enum_1.PdcStatus.BOUNCED,
                remarks: `${reason}${dto.reasonText ? ` — ${dto.reasonText}` : ''} — ` +
                    `${written.ref.voucherRefno ?? ''}`,
                actor,
                changedOn: now,
            });
            const pendingByBill = new Map(recomputed.map((bill) => [`${bill.billId}|${bill.accYear}`, bill]));
            const docRefnos = await this.loadBillRefs(tx, touched);
            return {
                cheque: await (0, cheques_utils_1.reloadChequeRow)(tx, cheque.apdId, cheque.apdAccYear),
                voucher: written.ref,
                legs: written.legs,
                billsReopened: recomputed.map((bill) => {
                    const ref = docRefnos.get(`${bill.billId}|${bill.accYear}`);
                    return {
                        billId: bill.billId,
                        billAccYear: bill.accYear,
                        billType: ref?.billType ?? '',
                        docRefno: ref?.docRefno ?? '',
                        docDate: ref?.docDate ?? '',
                        dueDate: ref?.dueDate ?? null,
                        billAmount: (0, receipt_utils_1.toAmount)(bill.billAmount),
                        pendingAmount: (0, receipt_utils_1.toAmount)(pendingByBill.get(`${bill.billId}|${bill.accYear}`)?.pendingAmount ?? receipt_utils_1.ZERO),
                        settledByThisCheque: 0,
                    };
                }),
                cascade: cascade.report,
                chargeBill,
                bankCharge: (0, receipt_utils_1.toAmount)(bankCharge),
                partyCharge: (0, receipt_utils_1.toAmount)(partyCharge),
            };
        }, BOUNCE_TRANSACTION_OPTIONS);
    }
    async resolveRoles(tx, params) {
        const wanted = [];
        if (params.bankCharge.greaterThan(0)) {
            wanted.push(cheque_enum_1.ChequeLedgerRole.BANK_CHARGES);
        }
        if (params.partyCharge.greaterThan(0)) {
            wanted.push(cheque_enum_1.ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED);
        }
        if (wanted.length === 0) {
            return { bankChargeLedgerId: null, recoveredLedgerId: null };
        }
        if (params.bankCharge.greaterThan(0) && !params.cheque.apdBankLedgerId) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Cheque has no deposit bank', [
                {
                    field: 'bankCharge',
                    message: `${params.cheque.apdInstrumentNo} names no bank ledger, so there is nowhere to ` +
                        'credit the return fee the bank took. Record the bounce without a bank charge, or ' +
                        're-deposit it first.',
                },
            ]);
        }
        const resolved = await (0, cheque_ledger_roles_1.requireChequeRoleLedgers)(tx, wanted, {
            companyId: params.cheque.apdCompanyId,
            branchId: params.cheque.apdBranchId,
        });
        return {
            bankChargeLedgerId: (0, cheque_ledger_roles_1.ledgerForRole)(resolved, cheque_enum_1.ChequeLedgerRole.BANK_CHARGES)?.ledgerId ?? null,
            recoveredLedgerId: (0, cheque_ledger_roles_1.ledgerForRole)(resolved, cheque_enum_1.ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED)?.ledgerId ?? null,
        };
    }
    buildLegs(params) {
        const { cheque } = params;
        const legs = [];
        const partyDebit = (params.onReceipt ? cheque.apdAmount : receipt_utils_1.ZERO).plus(params.partyCharge);
        if (partyDebit.greaterThan(0)) {
            legs.push({
                drCr: receipt_enum_1.DrCr.DR,
                ledgerId: cheque.apdPartyId,
                amount: partyDebit,
                role: null,
                remarks: params.onReceipt
                    ? `Cheque ${cheque.apdInstrumentNo} returned` +
                        (params.partyCharge.greaterThan(0) ? ' and bounce charge' : '')
                    : `Bounce charge on cheque ${cheque.apdInstrumentNo}`,
            });
        }
        if (params.onReceipt && params.inHandLedgerId) {
            legs.push({
                drCr: receipt_enum_1.DrCr.CR,
                ledgerId: params.inHandLedgerId,
                amount: cheque.apdAmount,
                remarks: `Cheque ${cheque.apdInstrumentNo} returned`,
            });
        }
        if (params.partyCharge.greaterThan(0) && params.recoveredLedgerId) {
            legs.push({
                drCr: receipt_enum_1.DrCr.CR,
                ledgerId: params.recoveredLedgerId,
                amount: params.partyCharge,
                role: cheque_enum_1.ChequeLedgerRole.BOUNCE_CHARGES_RECOVERED,
                remarks: `Bounce charge recovered on ${cheque.apdInstrumentNo}`,
            });
        }
        if (params.bankCharge.greaterThan(0) && params.bankChargeLedgerId && params.bankLedgerId) {
            legs.push({
                drCr: receipt_enum_1.DrCr.DR,
                ledgerId: params.bankChargeLedgerId,
                amount: params.bankCharge,
                role: cheque_enum_1.ChequeLedgerRole.BANK_CHARGES,
                remarks: `Return charge on ${cheque.apdInstrumentNo}`,
            });
            legs.push({
                drCr: receipt_enum_1.DrCr.CR,
                ledgerId: params.bankLedgerId,
                amount: params.bankCharge,
                remarks: `Return charge on ${cheque.apdInstrumentNo}`,
            });
        }
        return legs;
    }
    async writeChargeBill(tx, params) {
        if (params.partyCharge.lessThanOrEqualTo(0)) {
            return null;
        }
        const bill = await tx.accBillBalance.create({
            data: {
                ablCompanyId: params.cheque.apdCompanyId,
                ablBranchId: params.cheque.apdBranchId,
                ablTenantId: params.cheque.apdTenantId,
                ablAccYear: params.voucherAccYear,
                ablPartyId: params.cheque.apdPartyId,
                ablSalesmanId: params.cheque.apdSalesmanId,
                ablBillType: receipt_enum_1.BillType.JOURNAL,
                ablSrcModule: 'ACCOUNTS',
                ablSrcDocType: cheque_enum_1.BOUNCE_CHARGE_SRC_DOC_TYPE,
                ablSrcDocId: params.cheque.apdId,
                ablSrcAccYear: params.cheque.apdAccYear,
                ablVoucherId: params.voucherId,
                ablVoucherTypeId: params.voucherTypeId,
                ablVoucherNo: params.voucherNo,
                ablVoucherDate: params.bounceDate,
                ablVoucherRefno: params.voucherRefno,
                ablDocRefno: `BNC/${params.cheque.apdInstrumentNo}`,
                ablDocDate: params.bounceDate,
                ablDueDate: params.bounceDate,
                ablDrCr: receipt_enum_1.DrCr.DR,
                ablBillAmount: params.partyCharge,
                ablNarration: `Bounce charge on cheque ${params.cheque.apdInstrumentNo} — ${params.reason}`,
                ablCreatedBy: params.actor,
            },
            select: {
                ablId: true,
                ablAccYear: true,
                ablBillType: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablDueDate: true,
                ablBillAmount: true,
                ablPendingAmount: true,
            },
        });
        return {
            billId: bill.ablId,
            billAccYear: bill.ablAccYear,
            billType: bill.ablBillType,
            docRefno: bill.ablDocRefno,
            docDate: (0, receipt_utils_1.toDateString)(bill.ablDocDate) ?? '',
            dueDate: (0, receipt_utils_1.toDateString)(bill.ablDueDate),
            billAmount: (0, receipt_utils_1.toAmount)(bill.ablBillAmount),
            pendingAmount: (0, receipt_utils_1.toAmount)(bill.ablPendingAmount ?? bill.ablBillAmount),
            settledByThisCheque: 0,
        };
    }
    async loadBillRefs(tx, bills) {
        if (bills.length === 0) {
            return new Map();
        }
        const rows = await tx.accBillBalance.findMany({
            where: {
                OR: bills.map((bill) => ({ ablId: bill.billId, ablAccYear: bill.accYear })),
            },
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
exports.ChequeBounceService = ChequeBounceService;
exports.ChequeBounceService = ChequeBounceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], ChequeBounceService);
//# sourceMappingURL=cheque-bounce.service.js.map