"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_ADVANCE_VCHR_TYPE_ID = void 0;
exports.postOrderAdvanceToAccounts = postOrderAdvanceToAccounts;
exports.syncOrderAdvancePosting = syncOrderAdvancePosting;
exports.deleteOrderAdvancePosting = deleteOrderAdvancePosting;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const order_pdc_posting_helper_1 = require("./order-pdc-posting.helper");
exports.ORDER_ADVANCE_VCHR_TYPE_ID = 5;
const ORDER_SRC_MODULE = 'SALES';
const ORDER_SRC_DOC_TYPE = 'SALES_ORDER';
const DR = 'DR';
const CR = 'CR';
const VOUCHER_STATUS_POSTED = 'POSTED';
const VOUCHER_STATUS_CANCELLED = 'CANCELLED';
const ORDER_STATUS_CANCELLED = 'CANCELLED';
const UNPOST_CANCEL_REASON = 'Sale order no longer holds tendered money';
const DELETE_CANCEL_REASON = 'Sale order deleted';
const CANCEL_REASON_MAX_LENGTH = 250;
const VOUCHER_REFNO_MAX_LENGTH = 50;
const ADVANCE_BILL_TYPE = 'ADVANCE';
const ADVANCE_BILL_DR_CR = 'CR';
const BILL_REFNO_MAX_LENGTH = 100;
const ZERO = new client_1.Prisma.Decimal(0);
async function postOrderAdvanceToAccounts(tx, order, tenders, actor, postedOn) {
    const postable = toPostableTenders(tenders);
    const creditLedgerId = resolveCreditLedgerId(order);
    const surchargeLedgers = await resolveSurchargeLedgers(tx, postable);
    ensureLedgersDiffer(postable, creditLedgerId, surchargeLedgers);
    const totalAmount = sumTotals(postable);
    const voucherDate = order.soOrderDatetime ?? order.soOrderDate;
    const voucherNumber = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
        vchrTypeId: exports.ORDER_ADVANCE_VCHR_TYPE_ID,
        companyId: order.soCompanyId,
        branchId: order.soBranchId,
        accYear: order.soAccYear,
        documentDate: order.soOrderDate,
    });
    const voucherSlno = await (0, voucher_sequence_helper_1.allocateVoucherSlno)(tx, order.soCompanyId, order.soAccYear);
    const header = await tx.accVoucherHeader.create({
        data: {
            avhCompanyId: order.soCompanyId,
            avhBranchId: order.soBranchId,
            avhTenantId: order.soTenantId,
            avhAccYear: order.soAccYear,
            avhVoucherTypeId: exports.ORDER_ADVANCE_VCHR_TYPE_ID,
            avhVoucherNo: voucherNumber.lastNo,
            avhVoucherSlno: voucherSlno,
            avhVoucherRefno: voucherNumber.refno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
            avhVoucherDate: voucherDate,
            avhSrcModule: ORDER_SRC_MODULE,
            avhSrcDocType: ORDER_SRC_DOC_TYPE,
            avhSrcDocId: order.soId,
            avhUsrRefno: order.soUsrRefno,
            avhDocRefno: order.soOrderRefno,
            avhDocDate: order.soOrderDate,
            avhDocAmount: order.soOrderAmt ?? ZERO,
            avhRoundOff: order.soRoundOff ?? ZERO,
            avhTotalDebit: totalAmount,
            avhTotalCredit: totalAmount,
            avhPartyId: order.soCustId,
            avhOppositeLedgerId: creditLedgerId,
            avhEmployeeId: order.soSalesmanId ?? [],
            avhRemarks: order.soRemarks,
            avhVoucherStatus: VOUCHER_STATUS_POSTED,
            avhStatusOn: postedOn,
            avhStatusBy: order.soUserId,
            avhPostedOn: postedOn,
            avhUserId: order.soUserId,
            avhSessionId: order.soSessionId,
            avhDeviceType: null,
            avhDeviceId: order.soDeviceId,
            avhCreatedOn: postedOn,
            avhCreatedBy: actor,
        },
        select: { avhVoucherId: true },
    });
    const lineIds = await writeVoucherLines(tx, {
        order,
        tenders: postable,
        creditLedgerId,
        surchargeLedgers,
        voucherId: header.avhVoucherId,
        voucherNo: voucherNumber.lastNo,
        voucherRefno: voucherNumber.refno,
        voucherDate,
        actor,
        now: postedOn,
    });
    await stampTenderVoucher(tx, order, header.avhVoucherId);
    const pdcIds = await (0, order_pdc_posting_helper_1.syncOrderPdcRegister)(tx, order, postable, { voucherId: header.avhVoucherId, accYear: order.soAccYear }, actor, postedOn);
    const billId = await syncAdvanceBill(tx, order, {
        voucherId: header.avhVoucherId,
        voucherNo: voucherNumber.lastNo,
        voucherRefno: voucherNumber.refno,
        voucherDate,
    }, resolveAdvanceHeld(order, postable), actor, postedOn);
    return {
        voucherId: header.avhVoucherId,
        voucherNo: voucherNumber.lastNo,
        voucherRefno: voucherNumber.refno,
        lineIds,
        billId,
        pdcIds,
        totalAmount,
        postedOn,
    };
}
async function syncOrderAdvancePosting(tx, order, tenders, actor, now) {
    const live = await findLiveVoucher(tx, order);
    const postable = toPostableTenders(tenders);
    const shouldPost = order.soStatus !== ORDER_STATUS_CANCELLED && postable.length > 0;
    if (shouldPost) {
        if (live) {
            const resynced = await resyncPostedVoucher(tx, order, postable, live, actor, now);
            return {
                action: 'updated',
                voucherId: live.avhVoucherId,
                billId: resynced.billId,
                pdcIds: resynced.pdcIds,
                totalAmount: resynced.totalAmount,
                postedOn: live.avhPostedOn,
            };
        }
        await ensureNotPreviouslyCancelled(tx, order);
        const created = await postOrderAdvanceToAccounts(tx, order, postable, actor, now);
        return {
            action: 'created',
            voucherId: created.voucherId,
            billId: created.billId,
            pdcIds: created.pdcIds,
            totalAmount: created.totalAmount,
            postedOn: created.postedOn,
        };
    }
    if (live) {
        const pdcIds = await cancelPostedVoucher(tx, order, live, UNPOST_CANCEL_REASON, actor, now);
        return {
            action: 'cancelled',
            voucherId: null,
            billId: null,
            pdcIds,
            totalAmount: null,
            postedOn: null,
        };
    }
    return {
        action: 'unchanged',
        voucherId: null,
        billId: null,
        pdcIds: [],
        totalAmount: null,
        postedOn: null,
    };
}
async function deleteOrderAdvancePosting(tx, order, actor, now) {
    const headers = await tx.accVoucherHeader.findMany({
        where: {
            avhCompanyId: order.soCompanyId,
            avhAccYear: order.soAccYear,
            avhSrcModule: ORDER_SRC_MODULE,
            avhSrcDocType: ORDER_SRC_DOC_TYPE,
            avhSrcDocId: order.soId,
            avhIsDeleted: false,
        },
        select: { avhVoucherId: true, avhAccYear: true },
    });
    const billIds = await retireAdvanceBill(tx, order, actor, now);
    const pdcIds = await (0, order_pdc_posting_helper_1.cancelOrderPdcRegister)(tx, order, 'deleted', null, actor, now);
    const voucherIds = [];
    for (const header of headers) {
        await retireVoucherLines(tx, header, actor, now);
        await tx.accVoucherHeader.update({
            where: {
                avhVoucherId_avhAccYear: {
                    avhVoucherId: header.avhVoucherId,
                    avhAccYear: header.avhAccYear,
                },
            },
            data: {
                avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
                avhCancelReason: DELETE_CANCEL_REASON,
                avhStatusOn: now,
                avhStatusBy: actor,
                avhIsActive: false,
                avhIsDeleted: true,
                avhModifiedOn: now,
                avhModifiedBy: actor,
            },
        });
        voucherIds.push(header.avhVoucherId);
    }
    await clearTenderVoucher(tx, order);
    return { voucherIds, billIds, pdcIds };
}
function toPostableTenders(tenders) {
    return tenders
        .filter((tender) => (tender.tdTotalAmt ?? ZERO).greaterThan(0))
        .sort((left, right) => left.tdRowNo - right.tdRowNo);
}
function sumTotals(tenders) {
    return tenders.reduce((total, tender) => total.plus(tender.tdTotalAmt ?? ZERO), ZERO);
}
function toDecimal(value) {
    return value === null || value === undefined ? ZERO : new client_1.Prisma.Decimal(value);
}
function resolveAdvanceHeld(order, tenders) {
    const stated = toDecimal(order.soAdvanceRecdAmt);
    if (stated.greaterThan(0)) {
        return stated;
    }
    return tenders.reduce((total, tender) => total.plus(toDecimal(tender.tdAmount)), ZERO);
}
function resolveCreditLedgerId(order) {
    return order.soAdvanceLedgerId ?? order.soCustId;
}
async function resolveSurchargeLedgers(tx, tenders) {
    const surcharged = tenders.filter((tender) => (tender.tdSurchargeAmt ?? ZERO).greaterThan(0));
    if (surcharged.length === 0) {
        return new Map();
    }
    const masters = await tx.accTenderMaster.findMany({
        where: { tndId: { in: [...new Set(surcharged.map((tender) => tender.tdTenderId))] } },
        select: { tndId: true, tndName: true, tndSurchargeLedgerId: true },
    });
    const byId = new Map(masters.map((master) => [master.tndId, master]));
    const ledgers = new Map();
    for (const tender of surcharged) {
        const ledgerId = tender.tdSurchargeLedgerId ?? byId.get(tender.tdTenderId)?.tndSurchargeLedgerId;
        if (!ledgerId) {
            (0, module_service_utils_1.throwSalesBadRequest)('Order advance cannot be posted', [
                {
                    field: 'tenders',
                    message: `Tender line ${tender.tdRowNo} (${byId.get(tender.tdTenderId)?.tndName ?? 'unknown tender'}) ` +
                        'charges a surcharge but neither the line nor its tender master names a surcharge ledger, ' +
                        'so the receipt cannot be posted.',
                },
            ]);
        }
        ledgers.set(tender.tdId, ledgerId);
    }
    return ledgers;
}
function ensureLedgersDiffer(tenders, creditLedgerId, surchargeLedgers) {
    for (const tender of tenders) {
        const clash = tender.tdTenderLedgerId === creditLedgerId ||
            surchargeLedgers.get(tender.tdId) === tender.tdTenderLedgerId;
        if (clash) {
            (0, module_service_utils_1.throwSalesBadRequest)('Order advance cannot be posted', [
                {
                    field: 'tenders',
                    message: `Tender line ${tender.tdRowNo} pays into the same ledger it would be credited to, ` +
                        'so it has no entry to make. Point the tender or the advance ledger somewhere else.',
                },
            ]);
        }
    }
}
async function writeVoucherLines(tx, context) {
    const { order, creditLedgerId, surchargeLedgers } = context;
    const lineIds = [];
    let rowNo = 0;
    const addLine = async (line) => {
        rowNo += 1;
        const created = await tx.accVoucher.create({
            data: {
                avVoucherId: context.voucherId,
                avCompanyId: order.soCompanyId,
                avBranchId: order.soBranchId,
                avTenantId: order.soTenantId,
                avAccYear: order.soAccYear,
                avVoucherTypeId: exports.ORDER_ADVANCE_VCHR_TYPE_ID,
                avVoucherNo: context.voucherNo,
                avRowNo: rowNo,
                avVoucherDate: context.voucherDate,
                avVoucherRefno: context.voucherRefno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
                avDocDate: order.soOrderDate,
                avDocRefno: order.soOrderRefno,
                avDrCr: line.drCr,
                avLedgerId: line.ledgerId,
                avOppLedgerId: line.oppLedgerId,
                avAmount: line.amount,
                avRemarks: line.remarks,
                avSessionId: order.soSessionId,
                avUserId: order.soUserId,
                avCreatedOn: context.now,
                avCreatedBy: context.actor,
            },
            select: { avId: true },
        });
        lineIds.push(created.avId);
    };
    for (const tender of context.tenders) {
        const narration = describeTender(tender, order);
        const surchargeLedgerId = surchargeLedgers.get(tender.tdId);
        const surcharge = tender.tdSurchargeAmt ?? ZERO;
        await addLine({
            drCr: DR,
            ledgerId: tender.tdTenderLedgerId,
            oppLedgerId: creditLedgerId,
            amount: tender.tdTotalAmt,
            remarks: narration,
        });
        if ((tender.tdAmount ?? ZERO).greaterThan(0)) {
            await addLine({
                drCr: CR,
                ledgerId: creditLedgerId,
                oppLedgerId: tender.tdTenderLedgerId,
                amount: tender.tdAmount,
                remarks: narration,
            });
        }
        if (surchargeLedgerId && surcharge.greaterThan(0)) {
            await addLine({
                drCr: CR,
                ledgerId: surchargeLedgerId,
                oppLedgerId: tender.tdTenderLedgerId,
                amount: surcharge,
                remarks: `Surcharge on ${narration}`,
            });
        }
    }
    return lineIds;
}
function describeTender(tender, order) {
    const reference = tender.tdRefNo ?? tender.tdNotes;
    return reference
        ? `Advance against order ${order.soOrderRefno} (${reference})`
        : `Advance against order ${order.soOrderRefno}`;
}
async function findLiveVoucher(tx, order) {
    return tx.accVoucherHeader.findFirst({
        where: {
            avhCompanyId: order.soCompanyId,
            avhAccYear: order.soAccYear,
            avhSrcModule: ORDER_SRC_MODULE,
            avhSrcDocType: ORDER_SRC_DOC_TYPE,
            avhSrcDocId: order.soId,
            avhIsDeleted: false,
            avhVoucherStatus: { not: VOUCHER_STATUS_CANCELLED },
        },
        select: {
            avhVoucherId: true,
            avhAccYear: true,
            avhVoucherNo: true,
            avhVoucherRefno: true,
            avhVoucherDate: true,
            avhPostedOn: true,
        },
    });
}
async function ensureNotPreviouslyCancelled(tx, order) {
    const cancelled = await tx.accVoucherHeader.findFirst({
        where: {
            avhCompanyId: order.soCompanyId,
            avhAccYear: order.soAccYear,
            avhSrcModule: ORDER_SRC_MODULE,
            avhSrcDocType: ORDER_SRC_DOC_TYPE,
            avhSrcDocId: order.soId,
            avhIsDeleted: false,
            avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
        },
        select: { avhVoucherId: true },
    });
    if (cancelled) {
        (0, module_service_utils_1.throwSalesBadRequest)('Order advance cannot be posted', [
            {
                field: 'tenders',
                message: 'This order already had an advance receipt posted and cancelled in accounts; it cannot be posted again. Raise the receipt separately instead.',
            },
        ]);
    }
}
async function resyncPostedVoucher(tx, order, tenders, live, actor, now) {
    const creditLedgerId = resolveCreditLedgerId(order);
    const surchargeLedgers = await resolveSurchargeLedgers(tx, tenders);
    ensureLedgersDiffer(tenders, creditLedgerId, surchargeLedgers);
    const totalAmount = sumTotals(tenders);
    await tx.accVoucherHeader.update({
        where: {
            avhVoucherId_avhAccYear: {
                avhVoucherId: live.avhVoucherId,
                avhAccYear: live.avhAccYear,
            },
        },
        data: {
            avhUsrRefno: order.soUsrRefno,
            avhDocRefno: order.soOrderRefno,
            avhDocDate: order.soOrderDate,
            avhDocAmount: order.soOrderAmt ?? ZERO,
            avhRoundOff: order.soRoundOff ?? ZERO,
            avhTotalDebit: totalAmount,
            avhTotalCredit: totalAmount,
            avhPartyId: order.soCustId,
            avhOppositeLedgerId: creditLedgerId,
            avhEmployeeId: order.soSalesmanId ?? [],
            avhRemarks: order.soRemarks,
            avhModifiedOn: now,
            avhModifiedBy: actor,
        },
    });
    await retireVoucherLines(tx, live, actor, now);
    await writeVoucherLines(tx, {
        order,
        tenders,
        creditLedgerId,
        surchargeLedgers,
        voucherId: live.avhVoucherId,
        voucherNo: live.avhVoucherNo ?? BigInt(0),
        voucherRefno: live.avhVoucherRefno ?? order.soOrderRefno,
        voucherDate: live.avhVoucherDate,
        actor,
        now,
    });
    await stampTenderVoucher(tx, order, live.avhVoucherId);
    const pdcIds = await (0, order_pdc_posting_helper_1.syncOrderPdcRegister)(tx, order, tenders, { voucherId: live.avhVoucherId, accYear: live.avhAccYear }, actor, now);
    const billId = await syncAdvanceBill(tx, order, {
        voucherId: live.avhVoucherId,
        voucherNo: live.avhVoucherNo ?? BigInt(0),
        voucherRefno: live.avhVoucherRefno ?? order.soOrderRefno,
        voucherDate: live.avhVoucherDate,
    }, resolveAdvanceHeld(order, tenders), actor, now);
    return { totalAmount, billId, pdcIds };
}
async function cancelPostedVoucher(tx, order, live, reason, actor, now) {
    await retireAdvanceBill(tx, order, actor, now);
    const pdcIds = await (0, order_pdc_posting_helper_1.cancelOrderPdcRegister)(tx, order, 'unposted', order.soUserId, actor, now);
    await retireVoucherLines(tx, live, actor, now);
    await tx.accVoucherHeader.update({
        where: {
            avhVoucherId_avhAccYear: {
                avhVoucherId: live.avhVoucherId,
                avhAccYear: live.avhAccYear,
            },
        },
        data: {
            avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
            avhCancelReason: reason.slice(0, CANCEL_REASON_MAX_LENGTH),
            avhStatusOn: now,
            avhStatusBy: order.soUserId,
            avhModifiedOn: now,
            avhModifiedBy: actor,
        },
    });
    await clearTenderVoucher(tx, order);
    return pdcIds;
}
async function retireVoucherLines(tx, header, actor, now) {
    await tx.accVoucher.updateMany({
        where: {
            avVoucherId: header.avhVoucherId,
            avAccYear: header.avhAccYear,
            avIsDeleted: false,
        },
        data: {
            avIsActive: false,
            avIsDeleted: true,
            avModifiedOn: now,
            avModifiedBy: actor,
        },
    });
}
async function syncAdvanceBill(tx, order, voucher, amount, actor, now) {
    const existing = await findAdvanceBill(tx, order);
    if (!amount.greaterThan(0)) {
        if (existing) {
            await ensureAdvanceCanBeRetired(tx, existing);
            await retireBillRow(tx, existing, actor, now);
        }
        return null;
    }
    if (!existing) {
        return createAdvanceBill(tx, order, voucher, amount, actor, now);
    }
    ensureNothingSettledAgainstAdvance(existing, amount);
    await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: existing.ablId, ablAccYear: existing.ablAccYear } },
        data: {
            ablPartyId: order.soCustId,
            ablSalesmanId: order.soSalesmanId?.[0] ?? null,
            ablAgentId: order.soAgentId ?? null,
            ablDocDate: order.soOrderDate,
            ablVoucherId: voucher.voucherId,
            ablVoucherTypeId: exports.ORDER_ADVANCE_VCHR_TYPE_ID,
            ablVoucherNo: voucher.voucherNo,
            ablVoucherDate: voucher.voucherDate,
            ablVoucherRefno: voucher.voucherRefno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
            ablBillAmount: amount,
            ablNarration: describeAdvance(order),
            ablModifiedOn: now,
            ablModifiedBy: actor,
            ...(await resolveAdvanceAllocation(tx, order, existing.ablId, amount)),
        },
    });
    return existing.ablId;
}
async function createAdvanceBill(tx, order, voucher, amount, actor, now) {
    const created = await tx.accBillBalance.create({
        data: {
            ablCompanyId: order.soCompanyId,
            ablBranchId: order.soBranchId,
            ablTenantId: order.soTenantId,
            ablAccYear: order.soAccYear,
            ablPartyId: order.soCustId,
            ablSalesmanId: order.soSalesmanId?.[0] ?? null,
            ablAgentId: order.soAgentId ?? null,
            ablBillType: ADVANCE_BILL_TYPE,
            ablSrcModule: ORDER_SRC_MODULE,
            ablSrcDocType: ORDER_SRC_DOC_TYPE,
            ablSrcDocId: order.soId,
            ablSrcAccYear: order.soAccYear,
            ablVoucherId: voucher.voucherId,
            ablVoucherTypeId: exports.ORDER_ADVANCE_VCHR_TYPE_ID,
            ablVoucherNo: voucher.voucherNo,
            ablVoucherDate: voucher.voucherDate,
            ablVoucherRefno: voucher.voucherRefno.slice(0, VOUCHER_REFNO_MAX_LENGTH),
            ablDocRefno: order.soOrderRefno.slice(0, BILL_REFNO_MAX_LENGTH),
            ablDocDate: order.soOrderDate,
            ablDrCr: ADVANCE_BILL_DR_CR,
            ablBillAmount: amount,
            ablNarration: describeAdvance(order),
            ablCreatedOn: now,
            ablCreatedBy: actor,
            ...(await resolveAdvanceAllocation(tx, order, null, amount)),
        },
        select: { ablId: true },
    });
    return created.ablId;
}
async function resolveAdvanceAllocation(tx, order, billId, amount) {
    if (billId !== null) {
        const adjustments = await tx.accBillAdjustment.count({
            where: { abjBillId: billId, abjIsDeleted: false },
        });
        if (adjustments > 0) {
            return {};
        }
    }
    const used = toDecimal(order.soAdvanceAdjustedAmt)
        .plus(toDecimal(order.soAdvanceRefundAmt))
        .plus(toDecimal(order.soAdvanceForfeitAmt));
    return { ablAllocAmount: used.greaterThan(amount) ? amount : used };
}
async function retireAdvanceBill(tx, order, actor, now) {
    const bills = await tx.accBillBalance.findMany({
        where: {
            ablSrcModule: ORDER_SRC_MODULE,
            ablSrcDocType: ORDER_SRC_DOC_TYPE,
            ablSrcDocId: order.soId,
            ablIsDeleted: false,
        },
        select: {
            ablId: true,
            ablAccYear: true,
            ablDocRefno: true,
            ablAllocAmount: true,
            ablDiscAmount: true,
            ablWriteoffAmount: true,
        },
    });
    const retired = [];
    for (const bill of bills) {
        await ensureAdvanceCanBeRetired(tx, bill);
        await retireBillRow(tx, bill, actor, now);
        retired.push(bill.ablId);
    }
    return retired;
}
async function ensureAdvanceCanBeRetired(tx, bill) {
    const adjustments = await tx.accBillAdjustment.count({
        where: { abjBillId: bill.ablId, abjIsDeleted: false },
    });
    const settled = toDecimal(bill.ablDiscAmount).plus(toDecimal(bill.ablWriteoffAmount));
    if (adjustments === 0 && !settled.greaterThan(0)) {
        return;
    }
    (0, module_service_utils_1.throwSalesBadRequest)('Order advance cannot be removed', [
        {
            field: 'tenders',
            message: `The advance on order ${bill.ablDocRefno} has already been settled against in accounts, ` +
                'so it cannot be taken back out. Reverse the settlement first.',
        },
    ]);
}
async function findAdvanceBill(tx, order) {
    return tx.accBillBalance.findFirst({
        where: {
            ablSrcModule: ORDER_SRC_MODULE,
            ablSrcDocType: ORDER_SRC_DOC_TYPE,
            ablSrcDocId: order.soId,
            ablIsDeleted: false,
        },
        select: {
            ablId: true,
            ablAccYear: true,
            ablDocRefno: true,
            ablAllocAmount: true,
            ablDiscAmount: true,
            ablWriteoffAmount: true,
        },
    });
}
async function retireBillRow(tx, bill, actor, now) {
    await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
        data: {
            ablIsActive: false,
            ablIsDeleted: true,
            ablModifiedOn: now,
            ablModifiedBy: actor,
        },
    });
}
function ensureNothingSettledAgainstAdvance(bill, amount) {
    const settled = toDecimal(bill.ablAllocAmount)
        .plus(toDecimal(bill.ablDiscAmount))
        .plus(toDecimal(bill.ablWriteoffAmount));
    if (settled.greaterThan(amount)) {
        (0, module_service_utils_1.throwSalesBadRequest)('Order advance cannot be updated', [
            {
                field: 'soAdvanceRecdAmt',
                message: `The advance on order ${bill.ablDocRefno} already has ${settled.toString()} settled ` +
                    `against it in accounts, so it cannot be changed to ${amount.toString()}. ` +
                    'Reverse the settlement first.',
            },
        ]);
    }
}
function describeAdvance(order) {
    return `Advance received against order ${order.soOrderRefno}`;
}
async function stampTenderVoucher(tx, order, voucherId) {
    await tx.accTenderDetail.updateMany({
        where: {
            tdSrcModule: ORDER_SRC_MODULE,
            tdSrcDocType: ORDER_SRC_DOC_TYPE,
            tdSrcDocId: order.soId,
            tdIsDeleted: false,
        },
        data: { tdVoucherId: voucherId },
    });
}
async function clearTenderVoucher(tx, order) {
    await tx.accTenderDetail.updateMany({
        where: {
            tdSrcModule: ORDER_SRC_MODULE,
            tdSrcDocType: ORDER_SRC_DOC_TYPE,
            tdSrcDocId: order.soId,
            tdVoucherId: { not: null },
        },
        data: { tdVoucherId: null },
    });
}
//# sourceMappingURL=order-advance-posting.helper.js.map