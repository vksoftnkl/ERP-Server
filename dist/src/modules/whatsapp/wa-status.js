"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeStatus = mergeStatus;
exports.statusChanged = statusChanged;
exports.wacStateOf = wacStateOf;
const wa_constants_1 = require("./wa.constants");
const RANK = { SENDING: 0, SENT: 1, FAILED: 2, DELIVERED: 3, READ: 4 };
function mergeStatus(row, ev) {
    if (row.status === 'SKIPPED') {
        return row;
    }
    const next = { ...row };
    switch (ev.status) {
        case 'SENT':
            next.sentOn = row.sentOn ?? ev.at;
            break;
        case 'DELIVERED':
            next.deliveredOn = row.deliveredOn ?? ev.at;
            break;
        case 'READ':
            next.readOn = row.readOn ?? ev.at;
            break;
        case 'FAILED':
            next.failedOn = row.failedOn ?? ev.at;
            break;
    }
    if ((RANK[ev.status] ?? -1) > (RANK[row.status] ?? -1)) {
        next.status = ev.status;
        if (ev.status === 'FAILED') {
            next.errorCode = (0, wa_constants_1.waMetaCode)(ev.metaErrorCode ?? null);
            next.metaErrorCode = ev.metaErrorCode ?? null;
            next.errorText = (ev.metaErrorTitle ?? null)?.slice(0, 300) ?? null;
        }
        else if (ev.status === 'DELIVERED' || ev.status === 'READ') {
            next.errorCode = null;
            next.metaErrorCode = null;
            next.errorText = null;
        }
    }
    return next;
}
function statusChanged(a, b) {
    const t = (d) => (d ? d.getTime() : null);
    return (a.status !== b.status ||
        t(a.sentOn) !== t(b.sentOn) ||
        t(a.deliveredOn) !== t(b.deliveredOn) ||
        t(a.readOn) !== t(b.readOn) ||
        t(a.failedOn) !== t(b.failedOn) ||
        a.errorCode !== b.errorCode ||
        a.metaErrorCode !== b.metaErrorCode ||
        a.errorText !== b.errorText);
}
function wacStateOf(relayState) {
    switch ((relayState ?? '').toUpperCase()) {
        case 'CONNECTING':
            return 'CONNECTING';
        case 'CONNECTED':
            return 'CONNECTED';
        case 'DISCONNECTED':
            return 'DISCONNECTED';
        case 'SUSPENDED':
        case 'CLOSED':
            return 'SUSPENDED';
        case 'NEW':
        case 'ACTIVE':
        default:
            return 'ACTIVATED';
    }
}
//# sourceMappingURL=wa-status.js.map