"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logChequeStatus = logChequeStatus;
exports.toChequeRow = toChequeRow;
exports.reloadChequeRow = reloadChequeRow;
const client_1 = require("@prisma/client");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_utils_1 = require("../receipt/receipt.utils");
const cheques_guards_1 = require("./cheques.guards");
async function logChequeStatus(tx, cheque, entry) {
    await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
        companyId: cheque.apdCompanyId,
        branchId: cheque.apdBranchId,
        tenantId: cheque.apdTenantId,
        accYear: cheque.apdAccYear,
        srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
        srcDocType: txn_status_log_helper_1.TxnStatusDocType.OTHER,
        srcDocId: cheque.apdId,
        srcDocRefno: cheque.apdInstrumentNo,
        event: entry.event ?? eventFor(entry.toStatus),
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        changedBy: entry.actor,
        changedOn: entry.changedOn,
        remarks: entry.remarks,
        sessionId: entry.sessionId ?? null,
    });
}
function eventFor(status) {
    switch (status) {
        case receipt_enum_1.PdcStatus.CANCELLED:
        case receipt_enum_1.PdcStatus.RETURNED:
            return txn_status_log_helper_1.TxnStatusEvent.CANCELLED;
        case receipt_enum_1.PdcStatus.CLEARED:
            return txn_status_log_helper_1.TxnStatusEvent.CLOSED;
        default:
            return txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED;
    }
}
function toChequeRow(cheque, extras) {
    return {
        apdId: cheque.apdId,
        apdAccYear: cheque.apdAccYear,
        apdCompanyId: cheque.apdCompanyId,
        apdBranchId: cheque.apdBranchId,
        apdTraType: cheque.apdTraType,
        apdPartyId: cheque.apdPartyId,
        partyName: extras.partyName,
        apdInstrumentType: cheque.apdInstrumentType,
        apdInstrumentNo: cheque.apdInstrumentNo,
        apdInstrumentDate: (0, receipt_utils_1.toDateString)(cheque.apdInstrumentDate) ?? '',
        apdAmount: (0, receipt_utils_1.toAmount)(cheque.apdAmount),
        apdBankName: cheque.apdBankName,
        apdBankBranch: cheque.apdBankBranch,
        apdIfsc: cheque.apdIfsc,
        apdMicr: cheque.apdMicr,
        apdDrawerName: cheque.apdDrawerName,
        apdReceivedOn: (0, receipt_utils_1.toDateString)(cheque.apdReceivedOn) ?? '',
        apdBankLedgerId: cheque.apdBankLedgerId,
        bankLedgerName: extras.bankLedgerName,
        apdPostingMode: cheque.apdPostingMode,
        apdStatus: cheque.apdStatus,
        dueBucket: (0, cheques_guards_1.dueBucketOf)(cheque.apdInstrumentDate, cheque.apdStatus),
        apdPresentCount: cheque.apdPresentCount,
        apdDepositDate: (0, receipt_utils_1.toDateString)(cheque.apdDepositDate),
        apdDepositSlipNo: cheque.apdDepositSlipNo,
        apdClearDate: (0, receipt_utils_1.toDateString)(cheque.apdClearDate),
        apdBounceDate: (0, receipt_utils_1.toDateString)(cheque.apdBounceDate),
        apdBounceReason: cheque.apdBounceReason,
        apdBounceCharges: (0, receipt_utils_1.toAmount)(cheque.apdBounceCharges),
        apdRemarks: cheque.apdRemarks,
        apdStatusOn: (0, receipt_utils_1.toIsoString)(extras.apdStatusOn ?? null),
        apdStatusBy: extras.apdStatusBy ?? null,
    };
}
async function reloadChequeRow(tx, apdId, apdAccYear) {
    const row = await tx.accPdcRegister.findUniqueOrThrow({
        where: { apdId_apdAccYear: { apdId, apdAccYear } },
        include: {
            party: { select: { ledName: true } },
            bankLedger: { select: { ledName: true } },
        },
    });
    return toChequeRow({
        ...row,
        apdAmount: new client_1.Prisma.Decimal(row.apdAmount),
        apdBounceCharges: new client_1.Prisma.Decimal(row.apdBounceCharges),
        apdPostingMode: row.apdPostingMode,
        apdStatus: row.apdStatus,
    }, {
        partyName: row.party?.ledName ?? '',
        bankLedgerName: row.bankLedger?.ledName ?? null,
        apdStatusOn: row.apdStatusOn,
        apdStatusBy: row.apdStatusBy,
    });
}
//# sourceMappingURL=cheques.utils.js.map