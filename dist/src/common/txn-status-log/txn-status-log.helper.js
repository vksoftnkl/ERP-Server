"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxnStatusNotifyChannel = exports.TxnStatusEvent = exports.TxnStatusDocType = exports.TxnStatusSrcModule = void 0;
exports.appendTxnStatusLog = appendTxnStatusLog;
const module_shared_utils_1 = require("../utils/module-shared.utils");
var TxnStatusSrcModule;
(function (TxnStatusSrcModule) {
    TxnStatusSrcModule["SALES"] = "SALES";
    TxnStatusSrcModule["PURCHASE"] = "PURCHASE";
    TxnStatusSrcModule["INVENTORY"] = "INVENTORY";
    TxnStatusSrcModule["ACCOUNTS"] = "ACCOUNTS";
    TxnStatusSrcModule["POS"] = "POS";
    TxnStatusSrcModule["SERVICE"] = "SERVICE";
    TxnStatusSrcModule["OTHER"] = "OTHER";
})(TxnStatusSrcModule || (exports.TxnStatusSrcModule = TxnStatusSrcModule = {}));
var TxnStatusDocType;
(function (TxnStatusDocType) {
    TxnStatusDocType["QUOTATION"] = "QUOTATION";
    TxnStatusDocType["SALES_ORDER"] = "SALES_ORDER";
    TxnStatusDocType["DELIVERY_CHALLAN"] = "DELIVERY_CHALLAN";
    TxnStatusDocType["SALE_BILL"] = "SALE_BILL";
    TxnStatusDocType["SALE_RETURN"] = "SALE_RETURN";
    TxnStatusDocType["PURCHASE_ORDER"] = "PURCHASE_ORDER";
    TxnStatusDocType["PURCHASE_BILL"] = "PURCHASE_BILL";
    TxnStatusDocType["PURCHASE_RETURN"] = "PURCHASE_RETURN";
    TxnStatusDocType["STOCK_TRANSFER"] = "STOCK_TRANSFER";
    TxnStatusDocType["STOCK_ADJUSTMENT"] = "STOCK_ADJUSTMENT";
    TxnStatusDocType["RECEIPT"] = "RECEIPT";
    TxnStatusDocType["PAYMENT"] = "PAYMENT";
    TxnStatusDocType["JOURNAL"] = "JOURNAL";
    TxnStatusDocType["OTHER"] = "OTHER";
})(TxnStatusDocType || (exports.TxnStatusDocType = TxnStatusDocType = {}));
var TxnStatusEvent;
(function (TxnStatusEvent) {
    TxnStatusEvent["CREATED"] = "CREATED";
    TxnStatusEvent["SUBMITTED"] = "SUBMITTED";
    TxnStatusEvent["SENT"] = "SENT";
    TxnStatusEvent["APPROVED"] = "APPROVED";
    TxnStatusEvent["ACCEPTED"] = "ACCEPTED";
    TxnStatusEvent["REJECTED"] = "REJECTED";
    TxnStatusEvent["EXPIRED"] = "EXPIRED";
    TxnStatusEvent["CONVERTED"] = "CONVERTED";
    TxnStatusEvent["POSTED"] = "POSTED";
    TxnStatusEvent["UNPOSTED"] = "UNPOSTED";
    TxnStatusEvent["CANCELLED"] = "CANCELLED";
    TxnStatusEvent["CLOSED"] = "CLOSED";
    TxnStatusEvent["REOPENED"] = "REOPENED";
    TxnStatusEvent["DELETED"] = "DELETED";
    TxnStatusEvent["STATUS_CHANGED"] = "STATUS_CHANGED";
})(TxnStatusEvent || (exports.TxnStatusEvent = TxnStatusEvent = {}));
var TxnStatusNotifyChannel;
(function (TxnStatusNotifyChannel) {
    TxnStatusNotifyChannel["SMS"] = "SMS";
    TxnStatusNotifyChannel["WHATSAPP"] = "WHATSAPP";
    TxnStatusNotifyChannel["EMAIL"] = "EMAIL";
    TxnStatusNotifyChannel["NONE"] = "NONE";
})(TxnStatusNotifyChannel || (exports.TxnStatusNotifyChannel = TxnStatusNotifyChannel = {}));
const REASON_REQUIRED_EVENTS = [
    TxnStatusEvent.CANCELLED,
    TxnStatusEvent.CLOSED,
    TxnStatusEvent.REJECTED,
];
const REASON_FALLBACK = 'No reason recorded';
const EVENT_MAX_LENGTH = 30;
const STATUS_MAX_LENGTH = 20;
const DOC_REFNO_MAX_LENGTH = 100;
const REMARKS_MAX_LENGTH = 500;
const CREATED_BY_MAX_LENGTH = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function appendTxnStatusLog(tx, entry) {
    const changedOn = entry.changedOn ?? new Date();
    const event = normalizeToken(entry.event, EVENT_MAX_LENGTH);
    const remarks = resolveRemarks(event, entry.remarks);
    const [seqNo, deviceId] = await Promise.all([
        nextSeqNo(tx, entry.srcDocType, entry.srcDocId, entry.accYear),
        resolveDeviceId(tx, entry.deviceId),
    ]);
    return tx.txnStatusLog.create({
        data: {
            tslCompanyId: entry.companyId,
            tslBranchId: entry.branchId,
            tslTenantId: entry.tenantId ?? null,
            tslAccYear: entry.accYear,
            tslSrcModule: entry.srcModule,
            tslSrcDocType: entry.srcDocType,
            tslSrcDocId: entry.srcDocId,
            tslSrcDocRefno: truncate(entry.srcDocRefno, DOC_REFNO_MAX_LENGTH),
            tslSeqNo: seqNo,
            tslEvent: event,
            tslFromStatus: entry.fromStatus ? normalizeToken(entry.fromStatus, STATUS_MAX_LENGTH) : null,
            tslToStatus: normalizeToken(entry.toStatus, STATUS_MAX_LENGTH),
            tslChangedOn: changedOn,
            tslChangedBy: UUID_PATTERN.test(entry.changedBy) ? entry.changedBy : module_shared_utils_1.DEFAULT_ACTOR,
            tslRemarks: remarks,
            tslDeviceId: deviceId,
            tslSessionId: entry.sessionId && UUID_PATTERN.test(entry.sessionId) ? entry.sessionId : null,
            tslNotifyChannel: entry.notifyChannel ?? null,
            tslNotifiedOn: entry.notifyChannel ? (entry.notifiedOn ?? null) : null,
            tslNotifyRef: truncate(entry.notifyRef, DOC_REFNO_MAX_LENGTH),
            tslCreatedOn: changedOn,
            tslCreatedBy: truncate(entry.changedBy, CREATED_BY_MAX_LENGTH) ?? module_shared_utils_1.DEFAULT_ACTOR,
        },
    });
}
async function nextSeqNo(tx, srcDocType, srcDocId, accYear) {
    const last = await tx.txnStatusLog.findFirst({
        where: { tslSrcDocType: srcDocType, tslSrcDocId: srcDocId, tslAccYear: accYear },
        orderBy: { tslSeqNo: 'desc' },
        select: { tslSeqNo: true },
    });
    return (last?.tslSeqNo ?? 0) + 1;
}
async function resolveDeviceId(tx, deviceId) {
    const value = deviceId?.trim();
    if (!value) {
        return null;
    }
    const device = await tx.deviceMaster.findFirst({
        where: UUID_PATTERN.test(value) ? { devId: value } : { devDeviceUid: value },
        select: { devId: true },
    });
    return device?.devId ?? null;
}
function normalizeToken(value, maxLength) {
    return value.trim().toUpperCase().slice(0, maxLength);
}
function resolveRemarks(event, remarks) {
    const trimmed = remarks?.trim();
    if (trimmed) {
        return trimmed.slice(0, REMARKS_MAX_LENGTH);
    }
    return REASON_REQUIRED_EVENTS.includes(event) ? REASON_FALLBACK : null;
}
function truncate(value, maxLength) {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, maxLength) : null;
}
//# sourceMappingURL=txn-status-log.helper.js.map