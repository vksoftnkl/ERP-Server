"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDC_STATUS_CANCELLED = exports.PDC_STATUS_HELD = exports.CHEQUE_TENDER_TYPE_ID = void 0;
exports.syncDocPdcRegister = syncDocPdcRegister;
exports.cancelDocPdcRegister = cancelDocPdcRegister;
exports.assertDocPdcHeld = assertDocPdcHeld;
exports.findDocPdcRows = findDocPdcRows;
exports.matchChequeDetails = matchChequeDetails;
exports.readPdcChequeDetails = readPdcChequeDetails;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
exports.CHEQUE_TENDER_TYPE_ID = 5;
const CHEQUE_INSTRUMENT_TYPE = 'CHEQUE';
const PDC_TRA_TYPE_RECEIVABLE = 'R';
exports.PDC_STATUS_HELD = 'HELD';
exports.PDC_STATUS_CANCELLED = 'CANCELLED';
const PDC_POSTING_ON_RECEIPT = 'ON_RECEIPT';
const PDC_POSTING_ON_CLEARING = 'ON_CLEARING';
const INSTRUMENT_NO_MAX_LENGTH = 30;
const BANK_NAME_MAX_LENGTH = 100;
const DRAWER_NAME_MAX_LENGTH = 150;
const BANK_BRANCH_MAX_LENGTH = 100;
const CANCEL_REASON_MAX_LENGTH = 250;
const INSTRUMENT_DATE_MONTHS_BACK = 3;
const INSTRUMENT_DATE_YEARS_FORWARD = 1;
const ZERO = new client_1.Prisma.Decimal(0);
async function syncDocPdcRegister(tx, doc, rules, tenders, voucher, actor, now, opts) {
    const cheques = toRegistrableCheques(tenders);
    const existing = await findDocPdcRows(tx, doc);
    if (cheques.length === 0 && existing.length === 0) {
        return [];
    }
    ensureNoRepeatedInstrument(cheques, rules);
    const liveTenderIds = new Set(cheques.map((cheque) => cheque.tdId));
    for (const row of existing) {
        if (liveTenderIds.has(row.apdTenderId)) {
            continue;
        }
        ensureInstrumentIsHeld(row, 'removed', rules);
        await cancelPdcRow(tx, row, opts.removedReason, doc.userId, actor, now, false);
    }
    await ensureInstrumentsAreFree(tx, doc, rules, cheques);
    const received = startOfUtcDay(doc.docDate);
    const byTender = new Map(existing.map((row) => [row.apdTenderId, row]));
    const registered = [];
    for (const cheque of cheques) {
        const stored = byTender.get(cheque.tdId);
        const data = {
            apdCompanyId: doc.companyId,
            apdBranchId: doc.branchId,
            apdTenantId: doc.tenantId,
            apdTraType: PDC_TRA_TYPE_RECEIVABLE,
            apdPartyId: doc.partyId,
            apdSalesmanId: doc.salesmanId,
            apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
            apdInstrumentNo: requireInstrumentNo(cheque, rules),
            apdInstrumentDate: requireInstrumentDate(cheque, received, rules),
            apdAmount: cheque.tdTotalAmt,
            apdBankName: cheque.tdBankName?.slice(0, BANK_NAME_MAX_LENGTH) ?? null,
            apdReceivedOn: received,
            apdBankLedgerId: cheque.tdSettleLedgerId ?? null,
            apdTenderId: cheque.tdId,
            apdRemarks: describeCheque(cheque, doc, rules),
        };
        const detailData = stored && cheque.cheque === undefined ? {} : toDetailData(cheque.cheque ?? null, doc);
        const voucherData = {
            apdPostingMode: voucher ? PDC_POSTING_ON_RECEIPT : PDC_POSTING_ON_CLEARING,
            apdVoucherId: voucher?.voucherId ?? null,
            apdVoucherAccYear: voucher?.accYear ?? null,
        };
        if (stored) {
            ensureInstrumentIsHeld(stored, 'changed', rules);
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: stored.apdId, apdAccYear: stored.apdAccYear } },
                data: {
                    ...data,
                    ...detailData,
                    ...(opts.keepStoredVoucher ? {} : voucherData),
                    apdModifiedOn: now,
                    apdModifiedBy: actor,
                },
            });
            registered.push(stored.apdId);
            continue;
        }
        const created = await tx.accPdcRegister.create({
            data: {
                ...data,
                ...detailData,
                ...voucherData,
                apdAccYear: doc.accYear,
                apdStatus: exports.PDC_STATUS_HELD,
                apdStatusOn: now,
                apdStatusBy: doc.userId,
                apdCreatedOn: now,
                apdCreatedBy: actor,
            },
            select: { apdId: true },
        });
        registered.push(created.apdId);
    }
    return registered;
}
async function cancelDocPdcRegister(tx, doc, rules, reason, deleted, statusBy, actor, now) {
    const existing = await findDocPdcRows(tx, doc);
    for (const row of existing) {
        ensureInstrumentIsHeld(row, 'removed', rules);
    }
    for (const row of existing) {
        await cancelPdcRow(tx, row, reason, statusBy, actor, now, deleted);
    }
    return existing.map((row) => row.apdId);
}
async function assertDocPdcHeld(tx, doc, rules) {
    for (const row of await findDocPdcRows(tx, doc)) {
        ensureInstrumentIsHeld(row, 'removed', rules);
    }
}
async function findDocPdcRows(tx, doc) {
    const tenders = await tx.accTenderDetail.findMany({
        where: {
            tdSrcModule: doc.srcModule,
            tdSrcDocType: doc.srcDocType,
            tdSrcDocId: doc.docId,
        },
        select: { tdId: true },
    });
    if (tenders.length === 0) {
        return [];
    }
    const rows = await tx.accPdcRegister.findMany({
        where: {
            apdAccYear: doc.accYear,
            apdTenderId: { in: tenders.map((tender) => tender.tdId) },
            apdIsDeleted: false,
            apdStatus: { not: exports.PDC_STATUS_CANCELLED },
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
function toRegistrableCheques(tenders) {
    return tenders
        .filter((tender) => tender.tdTenderTypeId === exports.CHEQUE_TENDER_TYPE_ID &&
        (tender.tdTotalAmt ?? ZERO).greaterThan(0))
        .sort((left, right) => left.tdRowNo - right.tdRowNo);
}
function refuse(message) {
    (0, module_service_utils_1.throwSalesBadRequest)('Cheque cannot be registered', [
        { field: 'tenders', message },
    ]);
}
function requireInstrumentNo(cheque, rules) {
    const instrumentNo = cheque.tdRefNo?.trim();
    if (!instrumentNo) {
        refuse(`Tender line ${cheque.tdRowNo} is a cheque but carries no cheque number. ` +
            'Send it as tdRefNo — the cheque register is keyed by it.');
    }
    void rules;
    return instrumentNo.slice(0, INSTRUMENT_NO_MAX_LENGTH);
}
function requireInstrumentDate(cheque, received, rules) {
    if (!cheque.tdInstrumentDate) {
        refuse(`Tender line ${cheque.tdRowNo} is a cheque but carries no cheque date. ` +
            'Send it as tdInstrumentDate — it is the date the instrument matures on.');
    }
    const instrumentDate = startOfUtcDay(cheque.tdInstrumentDate);
    if (rules.refuseBackdated && instrumentDate.getTime() < received.getTime()) {
        refuse(`Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, ` +
            `before the ${rules.label} date ${toDateText(received)}. A cheque cannot mature ` +
            'before the day it was received.');
    }
    if (!rules.checkDateWindow) {
        return instrumentDate;
    }
    const earliest = new Date(received);
    earliest.setUTCMonth(earliest.getUTCMonth() - INSTRUMENT_DATE_MONTHS_BACK);
    const latest = new Date(received);
    latest.setUTCFullYear(latest.getUTCFullYear() + INSTRUMENT_DATE_YEARS_FORWARD);
    if (instrumentDate.getTime() < earliest.getTime()) {
        refuse(`Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, more than three ` +
            `months before the ${rules.label} date ${toDateText(received)} — the bank would refuse ` +
            'it as stale.');
    }
    if (instrumentDate.getTime() > latest.getTime()) {
        refuse(`Tender line ${cheque.tdRowNo} is dated ${toDateText(instrumentDate)}, more than a year ` +
            `after the ${rules.label} date ${toDateText(received)}. Check the year on the cheque.`);
    }
    return instrumentDate;
}
function ensureNoRepeatedInstrument(cheques, rules) {
    const seen = new Map();
    for (const cheque of cheques) {
        const instrumentNo = requireInstrumentNo(cheque, rules);
        const firstRow = seen.get(instrumentNo);
        if (firstRow !== undefined) {
            refuse(`Cheque ${instrumentNo} is tendered twice on this ${rules.label} (lines ${firstRow} and ` +
                `${cheque.tdRowNo}). One cheque can only be taken once.`);
        }
        seen.set(instrumentNo, cheque.tdRowNo);
    }
}
async function ensureInstrumentsAreFree(tx, doc, rules, cheques) {
    if (cheques.length === 0) {
        return;
    }
    const numbers = cheques.map((cheque) => requireInstrumentNo(cheque, rules));
    const clashes = await tx.accPdcRegister.findMany({
        where: {
            apdCompanyId: doc.companyId,
            apdAccYear: doc.accYear,
            apdPartyId: doc.partyId,
            apdInstrumentType: CHEQUE_INSTRUMENT_TYPE,
            apdInstrumentNo: { in: numbers },
            apdIsDeleted: false,
            apdStatus: { not: exports.PDC_STATUS_CANCELLED },
        },
        select: { apdInstrumentNo: true, apdTenderId: true },
    });
    const ownTenderIds = new Set(cheques.map((cheque) => cheque.tdId));
    for (const clash of clashes) {
        if (clash.apdTenderId && ownTenderIds.has(clash.apdTenderId)) {
            continue;
        }
        refuse(`Cheque ${clash.apdInstrumentNo} is already registered for this customer in ` +
            `${doc.accYear}. The same instrument cannot be taken twice.`);
    }
}
function ensureInstrumentIsHeld(row, change, rules) {
    if (row.apdStatus === exports.PDC_STATUS_HELD) {
        return;
    }
    if (rules.onMoved) {
        rules.onMoved(row, change);
    }
    (0, module_service_utils_1.throwSalesBadRequest)(`Cheque cannot be ${change}`, [
        {
            field: 'tenders',
            message: `Cheque ${row.apdInstrumentNo} on this ${rules.label} is ${row.apdStatus} in the cheque ` +
                `register, so it can no longer be ${change} from the ${rules.label}. ` +
                'Settle it on the PDC screen first.',
        },
    ]);
}
async function cancelPdcRow(tx, row, reason, statusBy, actor, now, deleted) {
    await tx.accPdcRegister.update({
        where: { apdId_apdAccYear: { apdId: row.apdId, apdAccYear: row.apdAccYear } },
        data: {
            apdStatus: exports.PDC_STATUS_CANCELLED,
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
function toDetailData(detail, doc) {
    return {
        apdDrawerName: (detail?.drawerName?.trim() || doc.partyName)?.slice(0, DRAWER_NAME_MAX_LENGTH) ?? null,
        apdBankBranch: detail?.bankBranch?.trim().slice(0, BANK_BRANCH_MAX_LENGTH) || null,
        apdIfsc: detail?.ifsc?.trim().toUpperCase() || null,
        apdMicr: detail?.micr?.trim() || null,
    };
}
function matchChequeDetails(payload, persisted) {
    const live = persisted.filter((row) => !row.tdIsDeleted && Number(row.tdTenderTypeId) === exports.CHEQUE_TENDER_TYPE_ID);
    const out = {};
    payload.forEach((sent, index) => {
        if (sent.cheque === undefined) {
            return;
        }
        const rowNo = sent.tdRowNo ?? index + 1;
        const row = sent.tdId
            ? live.find((r) => r.tdId === sent.tdId)
            : live.find((r) => r.tdRowNo === rowNo);
        if (row) {
            out[row.tdId] = sent.cheque
                ? {
                    drawerName: sent.cheque.drawerName ?? null,
                    bankBranch: sent.cheque.bankBranch ?? null,
                    ifsc: sent.cheque.ifsc ?? null,
                    micr: sent.cheque.micr ?? null,
                }
                : null;
        }
    });
    return out;
}
async function readPdcChequeDetails(client, tenderIds) {
    if (tenderIds.length === 0) {
        return new Map();
    }
    const rows = await client.accPdcRegister.findMany({
        where: {
            apdTenderId: { in: [...tenderIds] },
            apdIsDeleted: false,
            apdStatus: { not: exports.PDC_STATUS_CANCELLED },
        },
        select: {
            apdTenderId: true,
            apdDrawerName: true,
            apdBankBranch: true,
            apdIfsc: true,
            apdMicr: true,
        },
    });
    return new Map(rows
        .filter((row) => row.apdTenderId !== null)
        .map((row) => [
        row.apdTenderId,
        {
            drawerName: row.apdDrawerName,
            bankBranch: row.apdBankBranch,
            ifsc: row.apdIfsc,
            micr: row.apdMicr,
        },
    ]));
}
function describeCheque(cheque, doc, rules) {
    const note = cheque.tdNotes?.trim();
    const base = `Cheque tendered against ${rules.label} ${doc.refno}`;
    return note ? `${base} (${note})` : base;
}
function startOfUtcDay(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}
function toDateText(value) {
    return value.toISOString().slice(0, 10);
}
//# sourceMappingURL=pdc-register.helper.js.map