"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockCheques = lockCheques;
exports.chequeKey = chequeKey;
exports.lockChequeOrThrow = lockChequeOrThrow;
exports.assertStatus = assertStatus;
exports.assertDateOnOrAfter = assertDateOnOrAfter;
exports.assertNotInFuture = assertNotInFuture;
exports.formatDate = formatDate;
exports.dueBucketOf = dueBucketOf;
exports.resolveChequesInHand = resolveChequesInHand;
exports.loadBankLedger = loadBankLedger;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_utils_1 = require("../receipt/receipt.utils");
const cheque_enum_1 = require("./types/cheque-enum");
async function lockCheques(tx, keys) {
    if (keys.length === 0) {
        return new Map();
    }
    const ids = keys.map((key) => key.apdId);
    const years = [...new Set(keys.map((key) => key.apdAccYear))];
    const rows = await tx.$queryRaw `
    SELECT apd_id, apd_acc_year, apd_company_id, apd_branch_id, apd_tenant_id,
           apd_tra_type, apd_party_id, apd_salesman_id,
           apd_instrument_type, apd_instrument_no, apd_instrument_date,
           apd_amount, apd_bank_name, apd_bank_branch, apd_ifsc, apd_micr,
           apd_drawer_name, apd_received_on, apd_bank_ledger_id,
           apd_posting_mode, apd_voucher_id, apd_voucher_acc_year,
           apd_tender_id, apd_status, apd_present_count,
           apd_deposit_date, apd_deposit_slip_no,
           apd_clear_date, apd_clear_voucher_id, apd_clear_acc_year,
           apd_bounce_date, apd_bounce_reason, apd_bounce_charges,
           apd_bounce_voucher_id, apd_bounce_acc_year,
           apd_charge_voucher_id, apd_charge_acc_year,
           apd_replaced_by_id, apd_replaced_by_acc_year,
           apd_remarks, apd_is_deleted
      FROM accounts.acc_pdc_register
     WHERE apd_id       = ANY(${ids}::uuid[])
       AND apd_acc_year = ANY(${years}::bpchar[])
     ORDER BY apd_id
       FOR UPDATE`;
    return new Map(rows.map((row) => [chequeKey(row.apd_id, row.apd_acc_year), toLockedCheque(row)]));
}
function chequeKey(apdId, apdAccYear) {
    return `${apdId}|${apdAccYear}`;
}
function toLockedCheque(row) {
    return {
        apdId: row.apd_id,
        apdAccYear: row.apd_acc_year,
        apdCompanyId: row.apd_company_id,
        apdBranchId: row.apd_branch_id,
        apdTenantId: row.apd_tenant_id,
        apdTraType: row.apd_tra_type,
        apdPartyId: row.apd_party_id,
        apdSalesmanId: row.apd_salesman_id,
        apdInstrumentType: row.apd_instrument_type,
        apdInstrumentNo: row.apd_instrument_no,
        apdInstrumentDate: row.apd_instrument_date,
        apdAmount: new client_1.Prisma.Decimal(row.apd_amount),
        apdBankName: row.apd_bank_name,
        apdBankBranch: row.apd_bank_branch,
        apdIfsc: row.apd_ifsc,
        apdMicr: row.apd_micr,
        apdDrawerName: row.apd_drawer_name,
        apdReceivedOn: row.apd_received_on,
        apdBankLedgerId: row.apd_bank_ledger_id,
        apdPostingMode: row.apd_posting_mode,
        apdVoucherId: row.apd_voucher_id,
        apdVoucherAccYear: row.apd_voucher_acc_year,
        apdTenderId: row.apd_tender_id,
        apdStatus: row.apd_status,
        apdPresentCount: row.apd_present_count,
        apdDepositDate: row.apd_deposit_date,
        apdDepositSlipNo: row.apd_deposit_slip_no,
        apdClearDate: row.apd_clear_date,
        apdClearVoucherId: row.apd_clear_voucher_id,
        apdClearAccYear: row.apd_clear_acc_year,
        apdBounceDate: row.apd_bounce_date,
        apdBounceReason: row.apd_bounce_reason,
        apdBounceCharges: new client_1.Prisma.Decimal(row.apd_bounce_charges),
        apdBounceVoucherId: row.apd_bounce_voucher_id,
        apdBounceAccYear: row.apd_bounce_acc_year,
        apdChargeVoucherId: row.apd_charge_voucher_id,
        apdChargeAccYear: row.apd_charge_acc_year,
        apdReplacedById: row.apd_replaced_by_id,
        apdReplacedByAccYear: row.apd_replaced_by_acc_year,
        apdRemarks: row.apd_remarks,
        apdIsDeleted: row.apd_is_deleted,
    };
}
async function lockChequeOrThrow(tx, keys, field = 'apdId') {
    const locked = await lockCheques(tx, [keys]);
    const cheque = locked.get(chequeKey(keys.apdId, keys.apdAccYear));
    if (!cheque ||
        cheque.apdIsDeleted ||
        cheque.apdCompanyId !== keys.apdCompanyId ||
        cheque.apdBranchId !== keys.apdBranchId) {
        (0, module_service_utils_1.throwAccountsNotFound)('Cheque not found', field, `No live cheque ${keys.apdId} at this company / branch in ${keys.apdAccYear}`);
    }
    if (cheque.apdTraType !== 'R') {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `${cheque.apdInstrumentNo} is an ISSUED cheque, not a received one. ` +
                    'It belongs to the Issued Cheques screen.',
            },
        ]);
    }
    return cheque;
}
function assertStatus(cheque, allowed, action, field = 'apdId') {
    if (allowed.includes(cheque.apdStatus)) {
        return;
    }
    (0, module_service_utils_1.throwAccountsConflict)(`Cheque cannot be ${action}`, [
        {
            field,
            message: `${cheque.apdInstrumentNo} is ${cheque.apdStatus} — ` +
                `${whatCanBeDone(cheque.apdStatus)}.`,
        },
    ]);
}
function whatCanBeDone(status) {
    switch (status) {
        case receipt_enum_1.PdcStatus.HELD:
            return 'deposit it, replace it, or return it';
        case receipt_enum_1.PdcStatus.DEPOSITED:
            return 'clear it or bounce it';
        case receipt_enum_1.PdcStatus.BOUNCED:
            return 're-present it or replace it';
        case receipt_enum_1.PdcStatus.CLEARED:
            return 'it is settled and nothing further happens to it';
        case receipt_enum_1.PdcStatus.RETURNED:
            return 'the party has the paper back';
        case receipt_enum_1.PdcStatus.CANCELLED:
            return 'it is void; key the replacement as a new receipt';
        case receipt_enum_1.PdcStatus.REPLACED:
            return 'act on the cheque that replaced it';
        default:
            return 'nothing can be done with it';
    }
}
function assertDateOnOrAfter(date, earliest, what, earliestLabel, field) {
    if (date.getTime() >= earliest.getTime()) {
        return;
    }
    (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
        {
            field,
            message: `${what} on or after ${formatDate(earliest)}, ${earliestLabel}`,
        },
    ]);
}
function assertNotInFuture(date, what, field) {
    const today = (0, receipt_utils_1.todayUtc)();
    if (date.getTime() <= today.getTime()) {
        return;
    }
    (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
        {
            field,
            message: `${what} cannot be dated ${formatDate(date)} — that is in the future`,
        },
    ]);
}
function formatDate(date) {
    const iso = date.toISOString();
    return `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
}
function dueBucketOf(instrumentDate, status, asOf = (0, receipt_utils_1.todayUtc)()) {
    if (status !== receipt_enum_1.PdcStatus.HELD && status !== receipt_enum_1.PdcStatus.DEPOSITED) {
        return null;
    }
    const days = (0, receipt_utils_1.daysBetween)(instrumentDate, asOf);
    if (days < 0) {
        return cheque_enum_1.ChequeDueBucket.FUTURE;
    }
    if (days === 0) {
        return cheque_enum_1.ChequeDueBucket.DUE_TODAY;
    }
    return days > cheque_enum_1.STALE_AFTER_DAYS ? cheque_enum_1.ChequeDueBucket.STALE : cheque_enum_1.ChequeDueBucket.OVERDUE;
}
async function resolveChequesInHand(tx, cheque, field = 'apdId') {
    if (!cheque.apdTenderId) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Cheque is not linked to its receipt', [
            {
                field,
                message: `${cheque.apdInstrumentNo} has no tender row, so the ledger it was posted to cannot ` +
                    'be known. A cheque posted ON_RECEIPT always has one; this row was written by hand ' +
                    'or by an import that skipped it.',
            },
        ]);
    }
    const tender = await tx.accTenderDetail.findFirst({
        where: { tdId: cheque.apdTenderId, tdIsDeleted: false },
        select: {
            tdId: true,
            tdAccYear: true,
            tdTenderLedgerId: true,
            ledger: { select: { ledName: true } },
        },
    });
    if (!tender) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Cheque is not linked to its receipt', [
            {
                field,
                message: `The tender row behind ${cheque.apdInstrumentNo} has been deleted, so the ledger it ` +
                    'was posted to cannot be known.',
            },
        ]);
    }
    return {
        ledgerId: tender.tdTenderLedgerId,
        ledgerName: tender.ledger?.ledName ?? 'Cheques in Hand',
        tenderId: tender.tdId,
        tenderAccYear: tender.tdAccYear,
    };
}
async function loadBankLedger(tx, companyId, bankLedgerId, field = 'bankLedgerId') {
    const ledger = await tx.accLedgerMaster.findFirst({
        where: {
            ledId: bankLedgerId,
            ledIsDeleted: false,
            OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
        },
        select: { ledId: true, ledName: true, ledIsActive: true, ledLedgerType: true },
    });
    if (!ledger) {
        (0, module_service_utils_1.throwAccountsNotFound)('Bank ledger not found', field, `No ledger ${bankLedgerId} is visible to this company`);
    }
    if (!ledger.ledIsActive) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field, message: `"${ledger.ledName}" is inactive and cannot take a deposit` },
        ]);
    }
    if (ledger.ledLedgerType !== 'BANK') {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `"${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger. ` +
                    'A cheque is deposited into a BANK ledger.',
            },
        ]);
    }
    return { ledgerId: ledger.ledId, ledgerName: ledger.ledName };
}
//# sourceMappingURL=cheques.guards.js.map