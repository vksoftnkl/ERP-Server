"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEQUE_TENDER_TYPE_ID = void 0;
exports.syncOrderPdcRegister = syncOrderPdcRegister;
exports.cancelOrderPdcRegister = cancelOrderPdcRegister;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
exports.CHEQUE_TENDER_TYPE_ID = 5;
const CHEQUE_INSTRUMENT_TYPE = 'CHEQUE';
const PDC_TRA_TYPE_RECEIVABLE = 'R';
const PDC_STATUS_HELD = 'HELD';
const PDC_STATUS_CANCELLED = 'CANCELLED';
const PDC_POSTING_ON_RECEIPT = 'ON_RECEIPT';
const PDC_POSTING_ON_CLEARING = 'ON_CLEARING';
const ORDER_SRC_MODULE = 'SALES';
const ORDER_SRC_DOC_TYPE = 'SALES_ORDER';
const TENDER_REMOVED_CANCEL_REASON = 'Cheque no longer tendered on the sale order';
const ORDER_UNPOSTED_CANCEL_REASON = 'Sale order no longer holds tendered money';
const ORDER_DELETED_CANCEL_REASON = 'Sale order deleted';
const INSTRUMENT_NO_MAX_LENGTH = 30;
const BANK_NAME_MAX_LENGTH = 100;
const DRAWER_NAME_MAX_LENGTH = 150;
const CANCEL_REASON_MAX_LENGTH = 250;
const ZERO = new client_1.Prisma.Decimal(0);
async function syncOrderPdcRegister(tx, order, tenders, voucher, actor, now) {
    const cheques = toRegistrableCheques(tenders);
    const existing = await findOrderPdcRows(tx, order);
    if (cheques.length === 0 && existing.length === 0) {
        return [];
    }
    ensureNoRepeatedInstrument(cheques);
    await ensureInstrumentsAreFree(tx, order, cheques);
    const received = startOfUtcDay(order.soOrderDate);
    const byTender = new Map(existing.map((row) => [row.apdTenderId, row]));
    const registered = [];
    const kept = new Set();
    for (const cheque of cheques) {
        const stored = byTender.get(cheque.tdId);
        const data = {
            apdCompanyId: order.soCompanyId,
            apdBranchId: order.soBranchId,
            apdTenantId: order.soTenantId,
            apdTraType: PDC_TRA_TYPE_RECEIVABLE,
            apdPartyId: order.soCustId,
            apdSalesmanId: order.soSalesmanId?.[0] ?? null,
            apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
            apdInstrumentNo: requireInstrumentNo(cheque),
            apdInstrumentDate: requireInstrumentDate(cheque, received),
            apdAmount: cheque.tdTotalAmt,
            apdBankName: cheque.tdBankName?.slice(0, BANK_NAME_MAX_LENGTH) ?? null,
            apdDrawerName: order.soCustName?.slice(0, DRAWER_NAME_MAX_LENGTH) ?? null,
            apdReceivedOn: received,
            apdBankLedgerId: cheque.tdSettleLedgerId ?? null,
            apdPostingMode: voucher ? PDC_POSTING_ON_RECEIPT : PDC_POSTING_ON_CLEARING,
            apdVoucherId: voucher?.voucherId ?? null,
            apdVoucherAccYear: voucher?.accYear ?? null,
            apdTenderId: cheque.tdId,
            apdRemarks: describeCheque(cheque, order),
        };
        if (stored) {
            ensureInstrumentIsHeld(stored, 'changed');
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: stored.apdId, apdAccYear: stored.apdAccYear } },
                data: { ...data, apdModifiedOn: now, apdModifiedBy: actor },
            });
            kept.add(stored.apdId);
            registered.push(stored.apdId);
            continue;
        }
        const created = await tx.accPdcRegister.create({
            data: {
                ...data,
                apdAccYear: order.soAccYear,
                apdStatus: PDC_STATUS_HELD,
                apdStatusOn: now,
                apdStatusBy: order.soUserId,
                apdCreatedOn: now,
                apdCreatedBy: actor,
            },
            select: { apdId: true },
        });
        registered.push(created.apdId);
    }
    for (const row of existing) {
        if (kept.has(row.apdId)) {
            continue;
        }
        ensureInstrumentIsHeld(row, 'removed');
        await cancelPdcRow(tx, row, TENDER_REMOVED_CANCEL_REASON, order.soUserId, actor, now, false);
    }
    return registered;
}
async function cancelOrderPdcRegister(tx, order, reason, statusBy, actor, now) {
    const existing = await findOrderPdcRows(tx, order);
    const cancelled = [];
    for (const row of existing) {
        ensureInstrumentIsHeld(row, 'removed');
        await cancelPdcRow(tx, row, reason === 'deleted' ? ORDER_DELETED_CANCEL_REASON : ORDER_UNPOSTED_CANCEL_REASON, statusBy, actor, now, reason === 'deleted');
        cancelled.push(row.apdId);
    }
    return cancelled;
}
function toRegistrableCheques(tenders) {
    return tenders
        .filter((tender) => tender.tdTenderTypeId === exports.CHEQUE_TENDER_TYPE_ID &&
        (tender.tdTotalAmt ?? ZERO).greaterThan(0))
        .sort((left, right) => left.tdRowNo - right.tdRowNo);
}
async function findOrderPdcRows(tx, order) {
    const tenders = await tx.accTenderDetail.findMany({
        where: {
            tdSrcModule: ORDER_SRC_MODULE,
            tdSrcDocType: ORDER_SRC_DOC_TYPE,
            tdSrcDocId: order.soId,
        },
        select: { tdId: true },
    });
    if (tenders.length === 0) {
        return [];
    }
    const rows = await tx.accPdcRegister.findMany({
        where: {
            apdAccYear: order.soAccYear,
            apdTenderId: { in: tenders.map((tender) => tender.tdId) },
            apdIsDeleted: false,
            apdStatus: { not: PDC_STATUS_CANCELLED },
        },
        select: {
            apdId: true,
            apdAccYear: true,
            apdTenderId: true,
            apdInstrumentNo: true,
            apdStatus: true,
        },
    });
    return rows.filter((row) => row.apdTenderId !== null);
}
function requireInstrumentNo(cheque) {
    const instrumentNo = cheque.tdRefNo?.trim();
    if (!instrumentNo) {
        (0, module_service_utils_1.throwSalesBadRequest)('Cheque cannot be registered', [
            {
                field: 'tenders',
                message: `Tender line ${cheque.tdRowNo} is a cheque but carries no cheque number. ` +
                    'Send it as tdRefNo — the cheque register is keyed by it.',
            },
        ]);
    }
    return instrumentNo.slice(0, INSTRUMENT_NO_MAX_LENGTH);
}
function requireInstrumentDate(cheque, received) {
    if (!cheque.tdInstrumentDate) {
        (0, module_service_utils_1.throwSalesBadRequest)('Cheque cannot be registered', [
            {
                field: 'tenders',
                message: `Tender line ${cheque.tdRowNo} is a cheque but carries no cheque date. ` +
                    'Send it as tdInstrumentDate — it is the date the instrument matures on.',
            },
        ]);
    }
    const instrumentDate = startOfUtcDay(cheque.tdInstrumentDate);
    if (instrumentDate.getTime() < received.getTime()) {
        (0, module_service_utils_1.throwSalesBadRequest)('Cheque cannot be registered', [
            {
                field: 'tenders',
                message: `Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, ` +
                    `before the order date ${toDateText(received)}. A cheque cannot mature ` +
                    'before the day it was received.',
            },
        ]);
    }
    return instrumentDate;
}
function ensureNoRepeatedInstrument(cheques) {
    const seen = new Map();
    for (const cheque of cheques) {
        const instrumentNo = requireInstrumentNo(cheque);
        const firstRow = seen.get(instrumentNo);
        if (firstRow !== undefined) {
            (0, module_service_utils_1.throwSalesBadRequest)('Cheque cannot be registered', [
                {
                    field: 'tenders',
                    message: `Cheque ${instrumentNo} is tendered twice on this order (lines ${firstRow} and ` +
                        `${cheque.tdRowNo}). One cheque can only be taken once.`,
                },
            ]);
        }
        seen.set(instrumentNo, cheque.tdRowNo);
    }
}
async function ensureInstrumentsAreFree(tx, order, cheques) {
    if (cheques.length === 0) {
        return;
    }
    const numbers = cheques.map((cheque) => requireInstrumentNo(cheque));
    const clashes = await tx.accPdcRegister.findMany({
        where: {
            apdCompanyId: order.soCompanyId,
            apdAccYear: order.soAccYear,
            apdPartyId: order.soCustId,
            apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
            apdInstrumentNo: { in: numbers },
            apdIsDeleted: false,
            apdStatus: { not: PDC_STATUS_CANCELLED },
        },
        select: { apdInstrumentNo: true, apdTenderId: true },
    });
    const ownTenderIds = new Set(cheques.map((cheque) => cheque.tdId));
    for (const clash of clashes) {
        if (clash.apdTenderId && ownTenderIds.has(clash.apdTenderId)) {
            continue;
        }
        (0, module_service_utils_1.throwSalesBadRequest)('Cheque cannot be registered', [
            {
                field: 'tenders',
                message: `Cheque ${clash.apdInstrumentNo} is already registered for this customer in ` +
                    `${order.soAccYear}. The same instrument cannot be taken twice.`,
            },
        ]);
    }
}
function ensureInstrumentIsHeld(row, change) {
    if (row.apdStatus === PDC_STATUS_HELD) {
        return;
    }
    (0, module_service_utils_1.throwSalesBadRequest)(`Cheque cannot be ${change === 'changed' ? 'changed' : 'removed'}`, [
        {
            field: 'tenders',
            message: `Cheque ${row.apdInstrumentNo} on this order is ${row.apdStatus} in the cheque ` +
                `register, so it can no longer be ${change} from the order. ` +
                'Settle it on the PDC screen first.',
        },
    ]);
}
async function cancelPdcRow(tx, row, reason, statusBy, actor, now, deleted) {
    await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: row.apdId, apdAccYear: row.apdAccYear } },
        data: {
            apdStatus: PDC_STATUS_CANCELLED,
            apdCancelReason: reason.slice(0, CANCEL_REASON_MAX_LENGTH),
            apdCancelDate: startOfUtcDay(now),
            apdStatusOn: now,
            apdStatusBy: statusBy,
            apdIsActive: false,
            ...(deleted ? { apdIsDeleted: true } : {}),
            apdModifiedOn: now,
            apdModifiedBy: actor,
        },
    });
}
function describeCheque(cheque, order) {
    const note = cheque.tdNotes?.trim();
    const base = `Cheque tendered against order ${order.soOrderRefno}`;
    return note ? `${base} (${note})` : base;
}
function startOfUtcDay(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}
function toDateText(value) {
    return value.toISOString().slice(0, 10);
}
//# sourceMappingURL=order-pdc-posting.helper.js.map