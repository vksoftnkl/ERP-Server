"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADVANCE_ADJ_TYPE = void 0;
exports.allocateChequeMoney = allocateChequeMoney;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const allocation_engine_1 = require("../receipt/allocation-engine");
const receipt_guards_1 = require("../receipt/receipt.guards");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_utils_1 = require("../receipt/receipt.utils");
async function allocateChequeMoney(tx, scope, requested) {
    const amount = (0, receipt_utils_1.money)(scope.cheque.apdAmount);
    const bills = requested.length > 0
        ? await loadNamedBills(tx, scope, requested)
        : await autoFifoBills(tx, scope, amount);
    const allocated = (0, receipt_utils_1.sum)(bills.map((bill) => bill.amount));
    if (allocated.greaterThan(amount)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'allocations',
                message: `The allocations come to ${allocated.toFixed(2)} but ${scope.cheque.apdInstrumentNo} ` +
                    `is for ${amount.toFixed(2)}.`,
            },
        ]);
    }
    const plan = (0, allocation_engine_1.allocate)({
        receiptDate: scope.adjDate,
        bills,
        credits: [],
        otherLines: [],
        tenders: [
            {
                tenderRowNo: 1,
                amount,
                isCheque: true,
                isPostDated: false,
                instrumentDate: scope.cheque.apdInstrumentDate,
                settlementMode: receipt_enum_1.BillSettlementMode.CHEQUE,
            },
        ],
        pins: [],
        claimedOnAccount: amount.minus(allocated),
    });
    await writeAdjustments(tx, scope, plan);
    await writeAdvanceBill(tx, scope, plan);
    return {
        plan,
        bills: bills.map((bill) => ({ billId: bill.billId, accYear: bill.billAccYear })),
        refs: bills.map((bill) => ({
            billId: bill.billId,
            billAccYear: bill.billAccYear,
            billType: '',
            docRefno: bill.docRefno,
            docDate: '',
            dueDate: null,
            billAmount: 0,
            pendingAmount: 0,
            settledByThisCheque: (0, receipt_utils_1.toAmount)(bill.amount),
        })),
        partyCredit: plan.partyCreditByVoucher.get(allocation_engine_1.RECEIPT_VOUCHER_KEY) ?? receipt_utils_1.ZERO,
        onAccount: plan.totalOnAccount,
    };
}
async function loadNamedBills(tx, scope, requested) {
    const locked = await (0, receipt_guards_1.lockBills)(tx, requested.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })));
    return requested.map((row, index) => {
        const bill = (0, receipt_guards_1.assertBillUsable)(locked.get(`${row.billId}|${row.billAccYear}`), {
            billId: row.billId,
            partyId: scope.partyId,
            companyId: scope.companyId,
            kind: 'RECEIVABLE',
            field: `allocations.${index}.billId`,
        });
        return {
            billId: bill.ablId,
            billAccYear: bill.ablAccYear,
            docRefno: bill.ablDocRefno,
            amount: (0, receipt_utils_1.money)(row.amount),
            discount: (0, receipt_utils_1.money)(row.discount ?? 0),
            writeoff: (0, receipt_utils_1.money)(row.writeoff ?? 0),
            pendingAmount: bill.ablPendingAmount,
            writeoffApprovedBy: row.writeoffApprovedBy ?? null,
        };
    });
}
async function autoFifoBills(tx, scope, amount) {
    const candidates = await tx.accBillBalance.findMany({
        where: {
            ablPartyId: scope.partyId,
            ablCompanyId: scope.companyId,
            ablIsDeleted: false,
            ablDrCr: receipt_enum_1.DrCr.DR,
            ablBillType: { in: [...receipt_enum_1.RECEIVABLE_BILL_TYPES] },
            ablStatus: { not: 'CLOSED' },
        },
        orderBy: [{ ablDueDate: 'asc' }, { ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
        select: { ablId: true, ablAccYear: true },
        take: 500,
    });
    const locked = await (0, receipt_guards_1.lockBills)(tx, candidates.map((row) => ({ billId: row.ablId, billAccYear: row.ablAccYear })));
    const bills = [];
    let left = amount;
    for (const candidate of candidates) {
        if (left.lessThanOrEqualTo(0)) {
            break;
        }
        const bill = locked.get(`${candidate.ablId}|${candidate.ablAccYear}`);
        if (!bill || bill.ablIsDeleted || bill.ablPendingAmount.lessThanOrEqualTo(0)) {
            continue;
        }
        const take = client_1.Prisma.Decimal.min(left, bill.ablPendingAmount);
        bills.push({
            billId: bill.ablId,
            billAccYear: bill.ablAccYear,
            docRefno: bill.ablDocRefno,
            amount: take,
            discount: receipt_utils_1.ZERO,
            writeoff: receipt_utils_1.ZERO,
            pendingAmount: bill.ablPendingAmount,
            writeoffApprovedBy: null,
        });
        left = left.minus(take);
    }
    return bills;
}
async function writeAdjustments(tx, scope, plan) {
    if (plan.adjustments.length === 0) {
        return;
    }
    const rows = plan.adjustments.map((adjustment, index) => ({
        abjCompanyId: scope.companyId,
        abjBranchId: scope.branchId,
        abjTenantId: scope.tenantId,
        abjAccYear: scope.accYear,
        abjBillId: adjustment.billId,
        abjBillAccYear: adjustment.billAccYear,
        abjPartyId: scope.partyId,
        abjRowNo: index + 1,
        abjAgainstBillId: adjustment.againstBill?.billId ?? null,
        abjAgainstBillAccYear: adjustment.againstBill?.billAccYear ?? null,
        abjVoucherId: scope.voucherId,
        abjVoucherAccYear: scope.accYear,
        abjAdjType: adjustment.adjType,
        abjAdjDate: scope.adjDate,
        abjDrCr: adjustment.drCr,
        abjAmount: adjustment.amount,
        abjSettlementMode: adjustment.settlementMode,
        abjSettlementLedgerId: null,
        abjTenderId: scope.tenderId,
        abjTenderAccYear: scope.tenderId ? scope.tenderAccYear : null,
        abjChequeId: scope.cheque.apdId,
        abjChequeAccYear: scope.cheque.apdAccYear,
        abjIsPostDated: scope.isPostDated,
        abjApprovedBy: adjustment.approvedBy,
        abjRemarks: adjustment.remarks,
        abjUserId: scope.userId,
        abjSessionId: scope.sessionId,
        abjCreatedBy: scope.actor,
    }));
    await tx.accBillAdjustment.createMany({ data: rows });
}
async function writeAdvanceBill(tx, scope, plan) {
    if (plan.totalOnAccount.lessThanOrEqualTo(0)) {
        return;
    }
    await tx.accBillBalance.create({
        data: {
            ablCompanyId: scope.companyId,
            ablBranchId: scope.branchId,
            ablTenantId: scope.tenantId,
            ablAccYear: scope.accYear,
            ablPartyId: scope.partyId,
            ablSalesmanId: scope.salesmanId,
            ablBillType: receipt_enum_1.BillType.ADVANCE,
            ablSrcModule: receipt_enum_1.RECEIPT_SRC_MODULE,
            ablSrcDocType: receipt_enum_1.ADVANCE_SRC_DOC_TYPE,
            ablSrcDocId: scope.voucherId,
            ablSrcAccYear: scope.accYear,
            ablVoucherId: scope.voucherId,
            ablVoucherTypeId: scope.voucherTypeId,
            ablVoucherNo: scope.voucherNo,
            ablVoucherRefno: scope.voucherRefno,
            ablVoucherDate: scope.adjDate,
            ablDocRefno: `ADV/${scope.cheque.apdInstrumentNo}`,
            ablDocDate: scope.adjDate,
            ablDrCr: receipt_enum_1.DrCr.CR,
            ablBillAmount: plan.totalOnAccount,
            ablNarration: `On account from cheque ${scope.cheque.apdInstrumentNo} ` +
                `dated ${(0, receipt_utils_1.toDateString)(scope.cheque.apdInstrumentDate) ?? ''}`,
            ablCreatedBy: scope.actor,
        },
    });
}
exports.ADVANCE_ADJ_TYPE = receipt_enum_1.BillAdjType.ADVANCE_ADJUST;
//# sourceMappingURL=cheque-allocation.js.map