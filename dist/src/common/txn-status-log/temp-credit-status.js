"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendTempCreditStatus = appendTempCreditStatus;
exports.settlementEventOf = settlementEventOf;
exports.movementRemark = movementRemark;
const txn_status_log_helper_1 = require("./txn-status-log.helper");
async function appendTempCreditStatus(tx, step) {
    await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
        companyId: step.credit.companyId,
        branchId: step.credit.branchId,
        tenantId: step.credit.tenantId ?? null,
        accYear: step.credit.accYear,
        srcModule: txn_status_log_helper_1.TxnStatusSrcModule.SALES,
        srcDocType: txn_status_log_helper_1.TxnStatusDocType.TEMP_CREDIT,
        srcDocId: step.credit.atcId,
        srcDocRefno: step.credit.billRefno,
        event: step.event,
        fromStatus: step.fromStatus,
        toStatus: step.toStatus,
        changedOn: step.changedOn,
        changedBy: step.changedBy,
        remarks: step.remarks,
        deviceId: step.deviceId ?? null,
        sessionId: step.sessionId ?? null,
    });
}
function settlementEventOf(toStatus, fromStatus) {
    switch (toStatus) {
        case 'PARTIAL':
            return fromStatus === 'OPEN' ? txn_status_log_helper_1.TxnStatusEvent.PARTIAL : txn_status_log_helper_1.TxnStatusEvent.REOPENED;
        case 'SETTLED':
            return txn_status_log_helper_1.TxnStatusEvent.SETTLED;
        case 'WRITTEN_OFF':
            return txn_status_log_helper_1.TxnStatusEvent.WRITTEN_OFF;
        case 'OPEN':
            return txn_status_log_helper_1.TxnStatusEvent.REOPENED;
        case 'CANCELLED':
            return txn_status_log_helper_1.TxnStatusEvent.CANCELLED;
        default:
            return txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED;
    }
}
function movementRemark(before, after, toStatus, refno) {
    const delta = before.minus(after).toDecimalPlaces(2);
    const by = refno ? ` by ${refno}` : '';
    const balance = `balance ${after.toFixed(2)}`;
    if (delta.greaterThan(0)) {
        const verb = toStatus === 'WRITTEN_OFF' ? 'written off' : 'received';
        return `${verb} ${delta.toFixed(2)}${by}, ${balance}`;
    }
    if (delta.lessThan(0)) {
        return `reversed ${delta.negated().toFixed(2)}${by}, ${balance}`;
    }
    return `${balance}${by}`;
}
//# sourceMappingURL=temp-credit-status.js.map