"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postBillToAccounts = postBillToAccounts;
exports.syncBillPosting = syncBillPosting;
exports.deleteBillPosting = deleteBillPosting;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const BILL_SRC_MODULE = 'SALES';
const BILL_SRC_DOC_TYPE = 'BILL';
const BILL_REF_TYPE = 'SALES';
const BILL_DR_CR = 'DR';
const DEVICE_TYPE_MAP = {
    DESKTOP: 'DESKTOP',
    WEB: 'WEB',
    MOBILE: 'MOBILE',
};
const BILL_STATUS_POSTED = 'POSTED';
const VOUCHER_STATUS_POSTED = 'POSTED';
const VOUCHER_STATUS_CANCELLED = 'CANCELLED';
const DEFAULT_CANCEL_REASON = 'Sale bill is no longer posted';
const DELETE_CANCEL_REASON = 'Sale bill deleted';
const CANCEL_REASON_MAX_LENGTH = 250;
async function postBillToAccounts(tx, bill, vchrTypeId, actor, postedOn) {
    if (bill.sbBillSlno === null || !bill.sbBillRefno) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be posted', [
            {
                field: 'sbStatus',
                message: 'A POSTED bill must have a bill number (sbBillSlno / sbBillRefno) assigned.',
            },
        ]);
    }
    const billSlno = bill.sbBillSlno;
    const billRefno = bill.sbBillRefno;
    const voucherSlno = await (0, voucher_sequence_helper_1.allocateVoucherSlno)(tx, bill.sbCompanyId, bill.sbAccYear);
    const billAmount = bill.sbBillAmt ?? new client_1.Prisma.Decimal(0);
    const header = await tx.accVoucherHeader.create({
        data: {
            avhCompanyId: bill.sbCompanyId,
            avhBranchId: bill.sbBranchId,
            avhTenantId: bill.sbTenantId,
            avhAccYear: bill.sbAccYear,
            avhVoucherTypeId: vchrTypeId,
            avhVoucherNo: billSlno,
            avhVoucherSlno: voucherSlno,
            avhVoucherRefno: billRefno,
            avhVoucherDate: bill.sbBillDatetime ?? bill.sbBillDate,
            avhSrcModule: BILL_SRC_MODULE,
            avhSrcDocType: BILL_SRC_DOC_TYPE,
            avhSrcDocId: bill.sbId,
            avhUsrRefno: bill.sbUsrRefno,
            avhDocRefno: billRefno,
            avhDocDate: bill.sbBillDate,
            avhDocAmount: billAmount,
            avhRoundOff: bill.sbRoundOff ?? 0,
            avhTotalDebit: billAmount,
            avhTotalCredit: billAmount,
            avhPartyId: bill.sbCustId,
            avhOppositeLedgerId: null,
            avhEmployeeId: bill.sbSalesmanId ?? [],
            avhRemarks: bill.sbRemarks,
            avhVoucherStatus: VOUCHER_STATUS_POSTED,
            avhStatusOn: postedOn,
            avhStatusBy: bill.sbUserId,
            avhPostedOn: postedOn,
            avhUserId: bill.sbUserId,
            avhSessionId: bill.sbSessionId,
            avhDeviceType: mapDeviceType(bill.sbDeviceType),
            avhDeviceId: bill.sbDeviceId,
            avhCreatedOn: postedOn,
            avhCreatedBy: actor,
        },
        select: { avhVoucherId: true },
    });
    let billId = null;
    if (billAmount.greaterThan(0)) {
        const paid = bill.sbPaidAmt ?? new client_1.Prisma.Decimal(0);
        const allocated = paid.greaterThan(billAmount) ? billAmount : paid;
        const created = await tx.accBillBalance.create({
            data: {
                ablCompanyId: bill.sbCompanyId,
                ablBranchId: bill.sbBranchId,
                ablTenantId: bill.sbTenantId,
                ablAccYear: bill.sbAccYear,
                ablPartyId: bill.sbCustId,
                ablSalesmanId: bill.sbSalesmanId?.[0] ?? null,
                ablAgentId: bill.sbAgentId,
                ablBillType: BILL_REF_TYPE,
                ablSrcModule: BILL_SRC_MODULE,
                ablSrcDocType: BILL_SRC_DOC_TYPE,
                ablSrcDocId: bill.sbId,
                ablSrcAccYear: bill.sbAccYear,
                ablVoucherId: header.avhVoucherId,
                ablVoucherTypeId: vchrTypeId,
                ablVoucherNo: billSlno,
                ablVoucherDate: bill.sbBillDate,
                ablVoucherRefno: billRefno,
                ablDocRefno: billRefno,
                ablDocDate: bill.sbBillDate,
                ablDueDate: bill.sbDueDate,
                ablCreditDays: bill.sbDueDays ?? 0,
                ablDrCr: BILL_DR_CR,
                ablBillAmount: billAmount,
                ablAllocAmount: allocated,
                ablNarration: bill.sbRemarks,
                ablCreatedOn: postedOn,
                ablCreatedBy: actor,
            },
            select: { ablId: true },
        });
        billId = created.ablId;
    }
    return { voucherId: header.avhVoucherId, billId, postedOn };
}
async function syncBillPosting(tx, bill, vchrTypeId, actor, now) {
    const live = await findLiveVoucher(tx, bill);
    if (bill.sbStatus === BILL_STATUS_POSTED) {
        if (live) {
            const billId = await syncPostedVoucher(tx, bill, live, vchrTypeId, actor, now);
            return {
                action: 'updated',
                voucherId: live.avhVoucherId,
                billId,
                postedOn: live.avhPostedOn,
            };
        }
        await ensureNotPreviouslyCancelled(tx, bill);
        const created = await postBillToAccounts(tx, bill, vchrTypeId, actor, now);
        return {
            action: 'created',
            voucherId: created.voucherId,
            billId: created.billId,
            postedOn: created.postedOn,
        };
    }
    if (live) {
        await cancelPostedVoucher(tx, bill, live, actor, now);
        return { action: 'cancelled', voucherId: null, billId: null, postedOn: null };
    }
    return { action: 'unchanged', voucherId: null, billId: null, postedOn: null };
}
async function deleteBillPosting(tx, bill, actor, now) {
    const headers = await tx.accVoucherHeader.findMany({
        where: {
            avhCompanyId: bill.sbCompanyId,
            avhAccYear: bill.sbAccYear,
            avhSrcModule: BILL_SRC_MODULE,
            avhSrcDocType: BILL_SRC_DOC_TYPE,
            avhSrcDocId: bill.sbId,
            avhIsDeleted: false,
        },
        select: { avhVoucherId: true, avhAccYear: true },
    });
    const result = { voucherIds: [], billIds: [] };
    for (const header of headers) {
        result.billIds.push(...(await deleteReceivables(tx, header, actor, now)));
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
        result.voucherIds.push(header.avhVoucherId);
    }
    return result;
}
async function deleteReceivables(tx, header, actor, now) {
    const receivables = await tx.accBillBalance.findMany({
        where: {
            ablVoucherId: header.avhVoucherId,
            ablAccYear: header.avhAccYear,
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
    const deleted = [];
    for (const receivable of receivables) {
        ensureNothingSettledForDelete(receivable);
        await retireReceivable(tx, receivable, actor, now);
        deleted.push(receivable.ablId);
    }
    return deleted;
}
function ensureNothingSettledForDelete(receivable) {
    const settled = receivable.ablDiscAmount.plus(receivable.ablWriteoffAmount);
    if (settled.greaterThan(0)) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be deleted', [
            {
                field: 'sbId',
                message: `Bill ${receivable.ablDocRefno ?? ''} has ${settled.toString()} discounted or written ` +
                    `off against it in accounts, so it cannot be deleted. Reverse the settlement first.`.trim(),
            },
        ]);
    }
}
async function findLiveVoucher(tx, bill) {
    return tx.accVoucherHeader.findFirst({
        where: {
            avhCompanyId: bill.sbCompanyId,
            avhAccYear: bill.sbAccYear,
            avhSrcModule: BILL_SRC_MODULE,
            avhSrcDocType: BILL_SRC_DOC_TYPE,
            avhSrcDocId: bill.sbId,
            avhIsDeleted: false,
            avhVoucherStatus: { not: VOUCHER_STATUS_CANCELLED },
        },
        select: { avhVoucherId: true, avhAccYear: true, avhPostedOn: true },
    });
}
async function ensureNotPreviouslyCancelled(tx, bill) {
    const cancelled = await tx.accVoucherHeader.findFirst({
        where: {
            avhCompanyId: bill.sbCompanyId,
            avhAccYear: bill.sbAccYear,
            avhSrcModule: BILL_SRC_MODULE,
            avhSrcDocType: BILL_SRC_DOC_TYPE,
            avhSrcDocId: bill.sbId,
            avhIsDeleted: false,
            avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
        },
        select: { avhVoucherId: true },
    });
    if (cancelled) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be posted', [
            {
                field: 'sbStatus',
                message: 'This bill was already posted and cancelled in accounts; it cannot be posted again. Raise a new bill instead.',
            },
        ]);
    }
}
async function syncPostedVoucher(tx, bill, live, vchrTypeId, actor, now) {
    const billAmount = bill.sbBillAmt ?? new client_1.Prisma.Decimal(0);
    await tx.accVoucherHeader.update({
        where: {
            avhVoucherId_avhAccYear: {
                avhVoucherId: live.avhVoucherId,
                avhAccYear: live.avhAccYear,
            },
        },
        data: {
            avhVoucherDate: bill.sbBillDatetime ?? bill.sbBillDate,
            avhUsrRefno: bill.sbUsrRefno,
            avhDocDate: bill.sbBillDate,
            avhDocAmount: billAmount,
            avhRoundOff: bill.sbRoundOff ?? 0,
            avhTotalDebit: billAmount,
            avhTotalCredit: billAmount,
            avhPartyId: bill.sbCustId,
            avhEmployeeId: bill.sbSalesmanId ?? [],
            avhRemarks: bill.sbRemarks,
            avhDeviceType: mapDeviceType(bill.sbDeviceType),
            avhDeviceId: bill.sbDeviceId,
            avhModifiedOn: now,
            avhModifiedBy: actor,
        },
    });
    return syncReceivable(tx, bill, live, vchrTypeId, actor, now, billAmount);
}
async function syncReceivable(tx, bill, live, vchrTypeId, actor, now, billAmount) {
    const existing = await tx.accBillBalance.findFirst({
        where: {
            ablVoucherId: live.avhVoucherId,
            ablAccYear: live.avhAccYear,
            ablIsDeleted: false,
        },
        select: {
            ablId: true,
            ablAccYear: true,
            ablAllocAmount: true,
            ablDiscAmount: true,
            ablWriteoffAmount: true,
        },
    });
    if (billAmount.lessThanOrEqualTo(0)) {
        if (existing) {
            ensureNothingSettled(existing, billAmount);
            await retireReceivable(tx, existing, actor, now);
        }
        return null;
    }
    if (!existing) {
        return createReceivable(tx, bill, live, vchrTypeId, actor, now, billAmount);
    }
    ensureNothingSettled(existing, billAmount);
    await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: existing.ablId, ablAccYear: existing.ablAccYear } },
        data: {
            ablPartyId: bill.sbCustId,
            ablSalesmanId: bill.sbSalesmanId?.[0] ?? null,
            ablAgentId: bill.sbAgentId,
            ablDocDate: bill.sbBillDate,
            ablVoucherDate: bill.sbBillDate,
            ablDueDate: bill.sbDueDate,
            ablCreditDays: bill.sbDueDays ?? 0,
            ablBillAmount: billAmount,
            ablNarration: bill.sbRemarks,
            ablModifiedOn: now,
            ablModifiedBy: actor,
            ...(await resolveAllocation(tx, bill, existing, billAmount)),
        },
    });
    return existing.ablId;
}
async function resolveAllocation(tx, bill, receivable, billAmount) {
    const adjustments = await tx.accBillAdjustment.count({
        where: {
            abjBillId: receivable.ablId,
            abjIsDeleted: false,
        },
    });
    if (adjustments > 0) {
        return {};
    }
    const paid = bill.sbPaidAmt ?? new client_1.Prisma.Decimal(0);
    return { ablAllocAmount: paid.greaterThan(billAmount) ? billAmount : paid };
}
async function createReceivable(tx, bill, live, vchrTypeId, actor, now, billAmount) {
    if (bill.sbBillSlno === null || !bill.sbBillRefno) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be posted', [
            {
                field: 'sbStatus',
                message: 'A POSTED bill must have a bill number (sbBillSlno / sbBillRefno) assigned.',
            },
        ]);
    }
    const paid = bill.sbPaidAmt ?? new client_1.Prisma.Decimal(0);
    const created = await tx.accBillBalance.create({
        data: {
            ablCompanyId: bill.sbCompanyId,
            ablBranchId: bill.sbBranchId,
            ablTenantId: bill.sbTenantId,
            ablAccYear: bill.sbAccYear,
            ablPartyId: bill.sbCustId,
            ablSalesmanId: bill.sbSalesmanId?.[0] ?? null,
            ablAgentId: bill.sbAgentId,
            ablBillType: BILL_REF_TYPE,
            ablSrcModule: BILL_SRC_MODULE,
            ablSrcDocType: BILL_SRC_DOC_TYPE,
            ablSrcDocId: bill.sbId,
            ablSrcAccYear: bill.sbAccYear,
            ablVoucherId: live.avhVoucherId,
            ablVoucherTypeId: vchrTypeId,
            ablVoucherNo: bill.sbBillSlno,
            ablVoucherDate: bill.sbBillDate,
            ablVoucherRefno: bill.sbBillRefno,
            ablDocRefno: bill.sbBillRefno,
            ablDocDate: bill.sbBillDate,
            ablDueDate: bill.sbDueDate,
            ablCreditDays: bill.sbDueDays ?? 0,
            ablDrCr: BILL_DR_CR,
            ablBillAmount: billAmount,
            ablAllocAmount: paid.greaterThan(billAmount) ? billAmount : paid,
            ablNarration: bill.sbRemarks,
            ablCreatedOn: now,
            ablCreatedBy: actor,
        },
        select: { ablId: true },
    });
    return created.ablId;
}
function ensureNothingSettled(existing, billAmount) {
    const settled = existing.ablAllocAmount
        .plus(existing.ablDiscAmount)
        .plus(existing.ablWriteoffAmount);
    if (settled.greaterThan(billAmount)) {
        (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be updated', [
            {
                field: 'sbBillAmt',
                message: `This bill already has ${settled.toString()} settled against it, so it cannot be ` +
                    `changed to ${billAmount.toString()}. Reverse the settlement first.`,
            },
        ]);
    }
}
async function retireReceivable(tx, receivable, actor, now) {
    await tx.accBillBalance.update({
        where: {
            ablId_ablAccYear: { ablId: receivable.ablId, ablAccYear: receivable.ablAccYear },
        },
        data: {
            ablIsActive: false,
            ablIsDeleted: true,
            ablModifiedOn: now,
            ablModifiedBy: actor,
        },
    });
}
async function cancelPostedVoucher(tx, bill, live, actor, now) {
    const receivable = await tx.accBillBalance.findFirst({
        where: {
            ablVoucherId: live.avhVoucherId,
            ablAccYear: live.avhAccYear,
            ablIsDeleted: false,
        },
        select: {
            ablId: true,
            ablAccYear: true,
            ablAllocAmount: true,
            ablDiscAmount: true,
            ablWriteoffAmount: true,
        },
    });
    if (receivable) {
        ensureNothingSettled(receivable, new client_1.Prisma.Decimal(0));
        await retireReceivable(tx, receivable, actor, now);
    }
    await tx.accVoucherHeader.update({
        where: {
            avhVoucherId_avhAccYear: {
                avhVoucherId: live.avhVoucherId,
                avhAccYear: live.avhAccYear,
            },
        },
        data: {
            avhVoucherStatus: VOUCHER_STATUS_CANCELLED,
            avhCancelReason: (bill.sbCancelReason ?? DEFAULT_CANCEL_REASON).slice(0, CANCEL_REASON_MAX_LENGTH),
            avhStatusOn: now,
            avhStatusBy: bill.sbUserId,
            avhModifiedOn: now,
            avhModifiedBy: actor,
        },
    });
}
function mapDeviceType(deviceType) {
    const key = deviceType?.trim().toUpperCase();
    if (!key) {
        return null;
    }
    return DEVICE_TYPE_MAP[key] ?? null;
}
//# sourceMappingURL=bill-posting.helper.js.map