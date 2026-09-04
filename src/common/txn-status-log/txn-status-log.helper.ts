import { Prisma, TxnStatusLog } from '@prisma/client';
import { DEFAULT_ACTOR } from '../utils/module-shared.utils';
/// Appends one row to public.txn_status_log — the append-only status trail every
/// transactional document (quotation, order, challan, bill, return, voucher)
/// shares. A row is written once and never edited: correcting history means
/// appending another row, which is why there is no update/delete counterpart
/// here.
///
/// The table is LIST-partitioned by tsl_acc_year, so `accYear` must be the
/// SOURCE DOCUMENT's year and its partition must exist — a fiscal year that
/// never had public.ensure_acc_year_partitions('YYYY-YYYY') run against it fails
/// every insert with "no partition of relation \"txn_status_log\" found for
/// row".
///
/// Everything here is written inside the CALLER'S transaction, so a status step
/// commits with the document write that caused it: a bill that says CANCELLED
/// with no row saying who cancelled it is exactly what this prevents.
// ck_tsl_src_module. Same vocabulary as accounts.acc_tender_detail's
// ck_td_src_module and public.txn_hold's ck_txh_src_module.
export enum TxnStatusSrcModule {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
  INVENTORY = 'INVENTORY',
  ACCOUNTS = 'ACCOUNTS',
  POS = 'POS',
  SERVICE = 'SERVICE',
  OTHER = 'OTHER',
}
// ck_tsl_src_doc_type. 'OTHER' is a legitimate member, so a new document type
// never forces an ALTER on the table.
export enum TxnStatusDocType {
  QUOTATION = 'QUOTATION',
  SALES_ORDER = 'SALES_ORDER',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
  SALE_BILL = 'SALE_BILL',
  SALE_RETURN = 'SALE_RETURN',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  PURCHASE_BILL = 'PURCHASE_BILL',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  STOCK_TRANSFER = 'STOCK_TRANSFER',
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
  JOURNAL = 'JOURNAL',
  OTHER = 'OTHER',
}
// tsl_event has no value CHECK of its own — ck_tsl_event_shape only demands a
// non-blank upper-case token — so this is the APPLICATION's vocabulary, kept in
// one place so every module's trail reads the same way.
export enum TxnStatusEvent {
  // First row of a document's trail; tslToStatus says what it was created as.
  CREATED = 'CREATED',
  SUBMITTED = 'SUBMITTED',
  // Issued to the party (a quotation mailed out, an order acknowledged).
  SENT = 'SENT',
  APPROVED = 'APPROVED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  // Ran out of validity on its own — nobody did this to it.
  EXPIRED = 'EXPIRED',
  // Became the next document in the chain (quotation → order → bill).
  CONVERTED = 'CONVERTED',
  // Put into the books (a voucher now stands behind the document).
  POSTED = 'POSTED',
  // Taken back out of them, the document itself staying alive.
  UNPOSTED = 'UNPOSTED',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
  // Soft-deleted. Distinct from CANCELLED, which is a status the document
  // itself carries: this one is for documents whose delete leaves their status
  // column alone, so the trail says the row left play without claiming it says
  // something it does not.
  DELETED = 'DELETED',
  // A status move none of the above names.
  STATUS_CHANGED = 'STATUS_CHANGED',
}
// ck_tsl_notify_channel.
export enum TxnStatusNotifyChannel {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  NONE = 'NONE',
}
// ck_tsl_reason_required: these three must say why. A caller that leaves the
// remark blank gets REASON_FALLBACK rather than a 23514 that would roll back the
// document write itself — the step is worth recording even when the screen
// failed to collect a reason.
const REASON_REQUIRED_EVENTS: readonly string[] = [
  TxnStatusEvent.CANCELLED,
  TxnStatusEvent.CLOSED,
  TxnStatusEvent.REJECTED,
];
const REASON_FALLBACK = 'No reason recorded';
// Column widths, so an over-long value is trimmed here instead of coming back as
// a 22001 from Postgres.
const EVENT_MAX_LENGTH = 30;
const STATUS_MAX_LENGTH = 20;
const DOC_REFNO_MAX_LENGTH = 100;
const REMARKS_MAX_LENGTH = 500;
const CREATED_BY_MAX_LENGTH = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface TxnStatusLogEntry {
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  // The SOURCE DOCUMENT's accounting year — the partition key.
  accYear: string;
  srcModule: TxnStatusSrcModule;
  srcDocType: TxnStatusDocType;
  srcDocId: string;
  // Snapshot of the document's printable number, so a trail reads on its own.
  srcDocRefno?: string | null;
  event: TxnStatusEvent;
  // NULL on the first row of a document's trail.
  fromStatus?: string | null;
  toStatus: string;
  // Defaults to now(). Pass the caller's timestamp so every row written by one
  // save carries the same instant.
  changedOn?: Date;
  // tsl_changed_by is a uuid column while most sb_*/sq_* created_by columns are
  // free text, so a non-uuid actor is recorded as DEFAULT_ACTOR here and kept
  // verbatim in tsl_created_by (VarChar(50)).
  changedBy: string;
  remarks?: string | null;
  // Either a fixed.device_master uuid or a dev_device_uid — sale_bill.sb_device_id
  // and friends hold the CODE, not the id. Resolved to the master's uuid, and
  // left NULL when it matches no device, because tsl_device_id carries an FK.
  deviceId?: string | null;
  sessionId?: string | null;
  notifyChannel?: TxnStatusNotifyChannel | null;
  notifiedOn?: Date | null;
  notifyRef?: string | null;
}

export async function appendTxnStatusLog(
  tx: Prisma.TransactionClient,
  entry: TxnStatusLogEntry,
): Promise<TxnStatusLog> {
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
      // ck_tsl_from_status_shape allows NULL but not a blank string.
      tslFromStatus: entry.fromStatus ? normalizeToken(entry.fromStatus, STATUS_MAX_LENGTH) : null,
      tslToStatus: normalizeToken(entry.toStatus, STATUS_MAX_LENGTH),
      tslChangedOn: changedOn,
      tslChangedBy: UUID_PATTERN.test(entry.changedBy) ? entry.changedBy : DEFAULT_ACTOR,
      tslRemarks: remarks,
      tslDeviceId: deviceId,
      tslSessionId: entry.sessionId && UUID_PATTERN.test(entry.sessionId) ? entry.sessionId : null,
      tslNotifyChannel: entry.notifyChannel ?? null,
      // ck_tsl_notified: a notification timestamp needs a channel to belong to.
      tslNotifiedOn: entry.notifyChannel ? (entry.notifiedOn ?? null) : null,
      tslNotifyRef: truncate(entry.notifyRef, DOC_REFNO_MAX_LENGTH),
      tslCreatedOn: changedOn,
      tslCreatedBy: truncate(entry.changedBy, CREATED_BY_MAX_LENGTH) ?? DEFAULT_ACTOR,
    },
  });
}

/// 1..n within the document, as ux_tsl_doc_seq (docType, docId, accYear, seqNo)
/// demands. Read inside the caller's transaction: two concurrent status steps on
/// ONE document would otherwise pick the same number, and the unique index —
/// not this read — is what stops the second one committing.
async function nextSeqNo(
  tx: Prisma.TransactionClient,
  srcDocType: string,
  srcDocId: string,
  accYear: string,
): Promise<number> {
  const last = await tx.txnStatusLog.findFirst({
    where: { tslSrcDocType: srcDocType, tslSrcDocId: srcDocId, tslAccYear: accYear },
    orderBy: { tslSeqNo: 'desc' },
    select: { tslSeqNo: true },
  });
  return (last?.tslSeqNo ?? 0) + 1;
}

/// tsl_device_id is a uuid with an FK to fixed.device_master, but the documents
/// feeding this table carry sb_device_id / sq_device_id as free TEXT — a device
/// code in practice. So the value is looked up either way round, and an
/// unrecognised one becomes NULL rather than a foreign-key violation that would
/// take the whole save down: the device is already recorded on the document.
async function resolveDeviceId(
  tx: Prisma.TransactionClient,
  deviceId: string | null | undefined,
): Promise<string | null> {
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

// ck_tsl_event_shape / ck_tsl_to_status_shape / ck_tsl_from_status_shape: upper
// case, no surrounding blanks, non-empty — so the same status always compares
// equal.
function normalizeToken(value: string, maxLength: number): string {
  return value.trim().toUpperCase().slice(0, maxLength);
}

function resolveRemarks(event: string, remarks: string | null | undefined): string | null {
  const trimmed = remarks?.trim();
  if (trimmed) {
    return trimmed.slice(0, REMARKS_MAX_LENGTH);
  }
  return REASON_REQUIRED_EVENTS.includes(event) ? REASON_FALLBACK : null;
}

function truncate(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}
