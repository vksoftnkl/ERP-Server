"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdcVoucherKey = exports.RECEIPT_VOUCHER_KEY = exports.AllocationError = void 0;
exports.allocate = allocate;
const client_1 = require("@prisma/client");
const receipt_enum_1 = require("./types/receipt-enum");
const receipt_utils_1 = require("./receipt.utils");
class AllocationError extends Error {
    kind;
    details;
    constructor(kind, message, details) {
        super(message);
        this.kind = kind;
        this.details = details;
        this.name = 'AllocationError';
    }
}
exports.AllocationError = AllocationError;
function conflict(message, details) {
    throw new AllocationError('CONFLICT', message, details);
}
function invalid(message, details) {
    throw new AllocationError('VALIDATION', message, details);
}
exports.RECEIPT_VOUCHER_KEY = 'RECEIPT';
const pdcVoucherKey = (tenderRowNo) => `PDC:${tenderRowNo}`;
exports.pdcVoucherKey = pdcVoucherKey;
function allocate(input) {
    const bills = input.bills;
    assertBillsFit(bills);
    assertCreditsFit(input.credits);
    assertIdentity(input);
    const adjustments = [];
    const capacity = bills.map((bill) => (0, receipt_utils_1.money)(bill.amount));
    reserveDeductions(input, bills, capacity, adjustments);
    const sources = buildSources(input);
    pour(bills, capacity, sources, adjustments);
    const unfilled = capacity.findIndex((left) => !left.isZero());
    if (unfilled >= 0) {
        invalid('Allocation could not be completed', [
            {
                field: `allocations.${unfilled}.amount`,
                message: `Bill ${bills[unfilled].docRefno} is short by ${capacity[unfilled].toFixed(2)} — ` +
                    'the receipt does not carry enough money, credit or deduction to settle what it claims',
            },
        ]);
    }
    addReductions(input, bills, adjustments);
    const onAccount = collectOnAccount(input, sources);
    const totalOnAccount = (0, receipt_utils_1.sum)(onAccount.map((entry) => entry.amount));
    if (!totalOnAccount.equals((0, receipt_utils_1.money)(input.claimedOnAccount))) {
        invalid('Validation failed', [
            {
                field: 'onAccount',
                message: `The server holds ${totalOnAccount.toFixed(2)} on account, not ` +
                    `${(0, receipt_utils_1.money)(input.claimedOnAccount).toFixed(2)}. The client's figure is a preview; ` +
                    're-read /receipts/open-items and re-post.',
            },
        ]);
    }
    return {
        adjustments,
        onAccount,
        totalOnAccount,
        adjustAmountByVoucher: totalPerVoucher(adjustments),
        partyCreditByVoucher: partyCreditPerVoucher(input, adjustments, onAccount),
    };
}
function assertBillsFit(bills) {
    const seen = new Set();
    bills.forEach((bill, index) => {
        const key = `${bill.billId}|${bill.billAccYear}`;
        if (seen.has(key)) {
            invalid('Validation failed', [
                {
                    field: `allocations.${index}.billId`,
                    message: `Bill ${bill.docRefno} appears twice. Send one row per bill with the total.`,
                },
            ]);
        }
        seen.add(key);
        const settled = (0, receipt_utils_1.money)(bill.amount).plus(bill.discount).plus(bill.writeoff).plus(bill.roundoff);
        if (bill.amount.isNegative() ||
            bill.discount.isNegative() ||
            bill.writeoff.isNegative() ||
            bill.roundoff.isNegative()) {
            invalid('Validation failed', [
                {
                    field: `allocations.${index}.amount`,
                    message: `Bill ${bill.docRefno}: amount, discount, write-off and round-off are all ` +
                        'positive figures',
                },
            ]);
        }
        if (settled.lessThanOrEqualTo(0)) {
            invalid('Validation failed', [
                {
                    field: `allocations.${index}.amount`,
                    message: `Bill ${bill.docRefno} settles nothing. Leave it out rather than sending a zero row.`,
                },
            ]);
        }
        if (settled.greaterThan((0, receipt_utils_1.money)(bill.pendingAmount))) {
            conflict('Bill moved while this receipt was being entered', [
                {
                    field: `allocations.${index}.amount`,
                    message: `Bill ${bill.docRefno} has ${(0, receipt_utils_1.money)(bill.pendingAmount).toFixed(2)} pending, but this ` +
                        `receipt settles ${settled.toFixed(2)} against it`,
                },
            ]);
        }
    });
}
function assertCreditsFit(credits) {
    const seen = new Set();
    credits.forEach((credit, index) => {
        const key = `${credit.billId}|${credit.billAccYear}`;
        if (seen.has(key)) {
            invalid('Validation failed', [
                {
                    field: `creditsApplied.${index}.billId`,
                    message: `Credit ${credit.docRefno} appears twice. Send one row per credit with the total.`,
                },
            ]);
        }
        seen.add(key);
        if ((0, receipt_utils_1.money)(credit.amount).lessThanOrEqualTo(0)) {
            invalid('Validation failed', [
                {
                    field: `creditsApplied.${index}.amount`,
                    message: `Credit ${credit.docRefno} applies nothing. Leave it out.`,
                },
            ]);
        }
        if ((0, receipt_utils_1.money)(credit.amount).greaterThan((0, receipt_utils_1.money)(credit.pendingAmount))) {
            conflict('Credit moved while this receipt was being entered', [
                {
                    field: `creditsApplied.${index}.amount`,
                    message: `Credit ${credit.docRefno} has ${(0, receipt_utils_1.money)(credit.pendingAmount).toFixed(2)} left, but this ` +
                        `receipt applies ${(0, receipt_utils_1.money)(credit.amount).toFixed(2)} of it`,
                },
            ]);
        }
    });
}
function assertIdentity(input) {
    const moneyIn = (0, receipt_utils_1.sum)(input.tenders.map((tender) => (0, receipt_utils_1.money)(tender.amount)));
    const otherDr = (0, receipt_utils_1.sum)(input.otherLines
        .filter((line) => line.drCr === receipt_enum_1.DrCr.DR && !line.isInstrumentSplit)
        .map((line) => (0, receipt_utils_1.money)(line.amount)));
    const otherCr = (0, receipt_utils_1.sum)(input.otherLines.filter((line) => line.drCr === receipt_enum_1.DrCr.CR).map((line) => (0, receipt_utils_1.money)(line.amount)));
    const credits = (0, receipt_utils_1.sum)(input.credits.map((credit) => (0, receipt_utils_1.money)(credit.amount)));
    const allocated = (0, receipt_utils_1.sum)(input.bills.map((bill) => (0, receipt_utils_1.money)(bill.amount)));
    const claimed = (0, receipt_utils_1.money)(input.claimedOnAccount);
    const left = moneyIn.plus(otherDr).plus(credits);
    const right = allocated.plus(claimed).plus(otherCr);
    if (!left.equals(right)) {
        invalid('The receipt does not balance', [
            {
                field: 'onAccount',
                message: `Received ${moneyIn.toFixed(2)} + deductions ${otherDr.toFixed(2)} + credits ` +
                    `${credits.toFixed(2)} = ${left.toFixed(2)}, but allocated ${allocated.toFixed(2)} + ` +
                    `on account ${claimed.toFixed(2)} + other income ${otherCr.toFixed(2)} = ` +
                    `${right.toFixed(2)}. Out by ${left.minus(right).toFixed(2)}.`,
            },
        ]);
    }
    const instant = (0, receipt_utils_1.sum)(input.tenders.filter((tender) => !tender.isPostDated).map((tender) => (0, receipt_utils_1.money)(tender.amount)));
    if (otherCr.greaterThan(instant)) {
        invalid('Validation failed', [
            {
                field: 'otherLines',
                message: `Other income of ${otherCr.toFixed(2)} needs money that has arrived, and only ` +
                    `${instant.toFixed(2)} has. A post-dated cheque cannot fund it.`,
            },
        ]);
    }
}
function reserveDeductions(input, bills, capacity, out) {
    const billIndex = new Map(bills.map((bill, index) => [`${bill.billId}|${bill.billAccYear}`, index]));
    const deductions = input.otherLines.filter((line) => line.drCr === receipt_enum_1.DrCr.DR && line.settlesBill && !line.isInstrumentSplit);
    const pinnedByLine = new Map();
    for (const pin of input.pins) {
        const list = pinnedByLine.get(pin.lineNo) ?? [];
        list.push(pin);
        pinnedByLine.set(pin.lineNo, list);
    }
    for (const [lineNo, pins] of pinnedByLine) {
        const line = deductions.find((candidate) => candidate.lineNo === lineNo);
        if (!line) {
            invalid('Validation failed', [
                {
                    field: 'otherLineBills',
                    message: `Line ${lineNo} is pinned to a bill, but it is not a deduction that settles one. ` +
                        'Only a DR other-ledger line with settlesBill can be pinned.',
                },
            ]);
        }
        const pinnedTotal = (0, receipt_utils_1.sum)(pins.map((pin) => (0, receipt_utils_1.money)(pin.amount)));
        if (!pinnedTotal.equals((0, receipt_utils_1.money)(line.amount))) {
            invalid('Validation failed', [
                {
                    field: 'otherLineBills',
                    message: `Line ${lineNo} is ${(0, receipt_utils_1.money)(line.amount).toFixed(2)} but its pins add up to ` +
                        `${pinnedTotal.toFixed(2)}. Pin all of a line or none of it.`,
                },
            ]);
        }
        for (const pin of pins) {
            const index = billIndex.get(`${pin.billId}|${pin.billAccYear}`);
            if (index === undefined) {
                invalid('Validation failed', [
                    {
                        field: 'otherLineBills',
                        message: `Line ${lineNo} is pinned to a bill this receipt does not allocate against`,
                    },
                ]);
            }
            takeFromBill(bills, capacity, index, (0, receipt_utils_1.money)(pin.amount), `otherLineBills (line ${lineNo})`);
            out.push(deductionRow(input, bills[index], line, (0, receipt_utils_1.money)(pin.amount)));
        }
    }
    for (const line of deductions) {
        if (pinnedByLine.has(line.lineNo)) {
            continue;
        }
        const shares = (0, receipt_utils_1.distributeProRata)((0, receipt_utils_1.money)(line.amount), capacity.map((left) => left));
        shares.forEach((share, index) => {
            if (share.isZero()) {
                return;
            }
            takeFromBill(bills, capacity, index, share, `otherLines.${line.lineNo}.amount`);
            out.push(deductionRow(input, bills[index], line, share));
        });
    }
}
function deductionRow(input, bill, line, amount) {
    return {
        billId: bill.billId,
        billAccYear: bill.billAccYear,
        adjType: receipt_enum_1.BillAdjType.ALLOCATION,
        settlementMode: line.settlementMode,
        drCr: receipt_enum_1.DrCr.CR,
        amount,
        adjDate: input.receiptDate,
        isPostDated: false,
        voucherKey: exports.RECEIPT_VOUCHER_KEY,
        tenderRowNo: null,
        otherLineNo: line.lineNo,
        againstBill: null,
        approvedBy: null,
        countsToAdjustAmount: true,
        remarks: null,
    };
}
function takeFromBill(bills, capacity, index, amount, field) {
    if (amount.greaterThan(capacity[index])) {
        invalid('Validation failed', [
            {
                field,
                message: `Bill ${bills[index].docRefno} has room for ${capacity[index].toFixed(2)} more, but ` +
                    `${amount.toFixed(2)} was aimed at it. Raise the bill's amount or lower the line.`,
            },
        ]);
    }
    capacity[index] = capacity[index].minus(amount);
}
function buildSources(input) {
    const sources = input.credits.map((credit) => ({
        kind: 'CREDIT',
        remaining: (0, receipt_utils_1.money)(credit.amount),
        voucherKey: exports.RECEIPT_VOUCHER_KEY,
        adjDate: input.receiptDate,
        isPostDated: false,
        settlementMode: credit.settlementMode,
        tenderRowNo: null,
        credit,
    }));
    const instant = input.tenders
        .filter((tender) => !tender.isPostDated)
        .sort((left, right) => left.tenderRowNo - right.tenderRowNo);
    const pooled = instant.filter((tender) => !tender.isCheque);
    const currentCheques = instant.filter((tender) => tender.isCheque);
    let otherCr = (0, receipt_utils_1.sum)(input.otherLines.filter((line) => line.drCr === receipt_enum_1.DrCr.CR).map((line) => (0, receipt_utils_1.money)(line.amount)));
    let pooledTotal = (0, receipt_utils_1.sum)(pooled.map((tender) => (0, receipt_utils_1.money)(tender.amount)));
    const takeFromPooled = client_1.Prisma.Decimal.min(otherCr, pooledTotal);
    pooledTotal = pooledTotal.minus(takeFromPooled);
    otherCr = otherCr.minus(takeFromPooled);
    if (pooledTotal.greaterThan(0)) {
        sources.push({
            kind: 'MONEY',
            remaining: pooledTotal,
            voucherKey: exports.RECEIPT_VOUCHER_KEY,
            adjDate: input.receiptDate,
            isPostDated: false,
            settlementMode: receipt_enum_1.BillSettlementMode.MIXED,
            tenderRowNo: null,
            credit: null,
        });
    }
    for (const cheque of currentCheques) {
        let amount = (0, receipt_utils_1.money)(cheque.amount);
        const take = client_1.Prisma.Decimal.min(otherCr, amount);
        amount = amount.minus(take);
        otherCr = otherCr.minus(take);
        if (amount.greaterThan(0)) {
            sources.push({
                kind: 'CHEQUE',
                remaining: amount,
                voucherKey: exports.RECEIPT_VOUCHER_KEY,
                adjDate: input.receiptDate,
                isPostDated: false,
                settlementMode: receipt_enum_1.BillSettlementMode.CHEQUE,
                tenderRowNo: cheque.tenderRowNo,
                credit: null,
            });
        }
    }
    const postDated = input.tenders
        .filter((tender) => tender.isPostDated)
        .sort((left, right) => (left.instrumentDate?.getTime() ?? 0) - (right.instrumentDate?.getTime() ?? 0) ||
        left.tenderRowNo - right.tenderRowNo);
    for (const cheque of postDated) {
        sources.push({
            kind: 'CHEQUE',
            remaining: (0, receipt_utils_1.money)(cheque.amount),
            voucherKey: (0, exports.pdcVoucherKey)(cheque.tenderRowNo),
            adjDate: cheque.instrumentDate ?? input.receiptDate,
            isPostDated: true,
            settlementMode: receipt_enum_1.BillSettlementMode.CHEQUE,
            tenderRowNo: cheque.tenderRowNo,
            credit: null,
        });
    }
    return sources;
}
function pour(bills, capacity, sources, out) {
    let cursor = 0;
    for (let index = 0; index < bills.length; index += 1) {
        while (capacity[index].greaterThan(0) && cursor < sources.length) {
            const source = sources[cursor];
            if (source.remaining.lessThanOrEqualTo(0)) {
                cursor += 1;
                continue;
            }
            const take = client_1.Prisma.Decimal.min(source.remaining, capacity[index]);
            source.remaining = source.remaining.minus(take);
            capacity[index] = capacity[index].minus(take);
            out.push(...settlementRows(bills[index], source, take));
        }
    }
}
function settlementRows(bill, source, amount) {
    const base = {
        adjDate: source.adjDate,
        isPostDated: source.isPostDated,
        voucherKey: source.voucherKey,
        tenderRowNo: source.tenderRowNo,
        otherLineNo: null,
        approvedBy: null,
        amount,
    };
    if (source.kind !== 'CREDIT' || source.credit === null) {
        return [
            {
                ...base,
                billId: bill.billId,
                billAccYear: bill.billAccYear,
                adjType: receipt_enum_1.BillAdjType.ALLOCATION,
                settlementMode: source.settlementMode,
                drCr: receipt_enum_1.DrCr.CR,
                againstBill: null,
                countsToAdjustAmount: true,
                remarks: null,
            },
        ];
    }
    const credit = source.credit;
    return [
        {
            ...base,
            billId: bill.billId,
            billAccYear: bill.billAccYear,
            adjType: credit.adjType,
            settlementMode: credit.settlementMode,
            drCr: receipt_enum_1.DrCr.CR,
            againstBill: { billId: credit.billId, billAccYear: credit.billAccYear },
            countsToAdjustAmount: true,
            remarks: `Settled from ${credit.docRefno}`,
        },
        {
            ...base,
            billId: credit.billId,
            billAccYear: credit.billAccYear,
            adjType: credit.adjType,
            settlementMode: credit.settlementMode,
            drCr: receipt_enum_1.DrCr.DR,
            againstBill: { billId: bill.billId, billAccYear: bill.billAccYear },
            countsToAdjustAmount: false,
            remarks: `Applied to ${bill.docRefno}`,
        },
    ];
}
function addReductions(input, bills, out) {
    bills.forEach((bill) => {
        const discount = (0, receipt_utils_1.money)(bill.discount);
        if (discount.greaterThan(0)) {
            out.push({
                billId: bill.billId,
                billAccYear: bill.billAccYear,
                adjType: receipt_enum_1.BillAdjType.DISCOUNT,
                settlementMode: receipt_enum_1.BillSettlementMode.DISCOUNT,
                drCr: receipt_enum_1.DrCr.CR,
                amount: discount,
                adjDate: input.receiptDate,
                isPostDated: false,
                voucherKey: exports.RECEIPT_VOUCHER_KEY,
                tenderRowNo: null,
                otherLineNo: null,
                againstBill: null,
                approvedBy: null,
                countsToAdjustAmount: true,
                remarks: null,
            });
        }
        const writeoff = (0, receipt_utils_1.money)(bill.writeoff);
        if (writeoff.greaterThan(0)) {
            if (!bill.writeoffApprovedBy) {
                invalid('Validation failed', [
                    {
                        field: 'allocations.writeoffApprovedBy',
                        message: `Writing off ${writeoff.toFixed(2)} on ${bill.docRefno} needs an approver`,
                    },
                ]);
            }
            out.push({
                billId: bill.billId,
                billAccYear: bill.billAccYear,
                adjType: receipt_enum_1.BillAdjType.WRITEOFF,
                settlementMode: receipt_enum_1.BillSettlementMode.WRITEOFF,
                drCr: receipt_enum_1.DrCr.CR,
                amount: writeoff,
                adjDate: input.receiptDate,
                isPostDated: false,
                voucherKey: exports.RECEIPT_VOUCHER_KEY,
                tenderRowNo: null,
                otherLineNo: null,
                againstBill: null,
                approvedBy: bill.writeoffApprovedBy,
                countsToAdjustAmount: true,
                remarks: null,
            });
        }
        const roundoff = (0, receipt_utils_1.money)(bill.roundoff);
        if (roundoff.greaterThan(0)) {
            out.push({
                billId: bill.billId,
                billAccYear: bill.billAccYear,
                adjType: receipt_enum_1.BillAdjType.ROUND_OFF,
                settlementMode: receipt_enum_1.BillSettlementMode.ROUND_OFF,
                drCr: receipt_enum_1.DrCr.CR,
                amount: roundoff,
                adjDate: input.receiptDate,
                isPostDated: false,
                voucherKey: exports.RECEIPT_VOUCHER_KEY,
                tenderRowNo: null,
                otherLineNo: null,
                againstBill: null,
                approvedBy: null,
                countsToAdjustAmount: true,
                remarks: null,
            });
        }
    });
}
function collectOnAccount(input, sources) {
    const byVoucher = new Map();
    const add = (voucherKey, amount, onDate) => {
        if (amount.lessThanOrEqualTo(0)) {
            return;
        }
        const existing = byVoucher.get(voucherKey);
        byVoucher.set(voucherKey, {
            voucherKey,
            amount: (existing?.amount ?? receipt_utils_1.ZERO).plus(amount),
            onDate: existing?.onDate ?? onDate,
        });
    };
    for (const source of sources) {
        if (source.remaining.lessThanOrEqualTo(0)) {
            continue;
        }
        if (source.kind === 'CREDIT') {
            invalid('Validation failed', [
                {
                    field: 'creditsApplied',
                    message: `${source.credit?.docRefno ?? 'A credit'} has ${source.remaining.toFixed(2)} left over. ` +
                        'A credit may only be applied to a bill — it cannot be held on account again. ' +
                        'Apply less of it.',
                },
            ]);
        }
        add(source.voucherKey, source.remaining, source.adjDate);
    }
    const floating = (0, receipt_utils_1.sum)(input.otherLines
        .filter((line) => line.drCr === receipt_enum_1.DrCr.DR && !line.settlesBill && !line.isInstrumentSplit)
        .map((line) => (0, receipt_utils_1.money)(line.amount)));
    add(exports.RECEIPT_VOUCHER_KEY, floating, input.receiptDate);
    return [...byVoucher.values()].map((entry) => ({ ...entry, amount: (0, receipt_utils_1.money)(entry.amount) }));
}
function totalPerVoucher(adjustments) {
    const totals = new Map();
    for (const row of adjustments) {
        if (!row.countsToAdjustAmount) {
            continue;
        }
        totals.set(row.voucherKey, (totals.get(row.voucherKey) ?? receipt_utils_1.ZERO).plus(row.amount));
    }
    for (const [key, value] of totals) {
        totals.set(key, (0, receipt_utils_1.money)(value));
    }
    return totals;
}
function partyCreditPerVoucher(input, adjustments, onAccount) {
    const totals = new Map();
    const add = (key, amount) => {
        totals.set(key, (totals.get(key) ?? receipt_utils_1.ZERO).plus(amount));
    };
    for (const row of adjustments) {
        add(row.voucherKey, row.drCr === receipt_enum_1.DrCr.CR ? row.amount : row.amount.negated());
    }
    for (const entry of onAccount) {
        add(entry.voucherKey, entry.amount);
    }
    if (!totals.has(exports.RECEIPT_VOUCHER_KEY)) {
        totals.set(exports.RECEIPT_VOUCHER_KEY, receipt_utils_1.ZERO);
    }
    for (const tender of input.tenders) {
        if (tender.isPostDated) {
            const key = (0, exports.pdcVoucherKey)(tender.tenderRowNo);
            if (!totals.has(key)) {
                totals.set(key, receipt_utils_1.ZERO);
            }
        }
    }
    for (const [key, value] of totals) {
        totals.set(key, (0, receipt_utils_1.money)(value));
    }
    return totals;
}
//# sourceMappingURL=allocation-engine.js.map