import type { Prisma } from '@prisma/client';
import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type TransactionHoldErrorDetail = ModuleApiErrorDetail;
export type TransactionHoldErrorResponse = ModuleApiErrorResponse<TransactionHoldErrorDetail>;
export type TransactionHoldSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type TransactionHoldListMeta = ModuleListMeta;
// The enum-shaped th_* columns, member for member with the ck_th_status /
// ck_th_doc_type / ck_th_device_type CHECK constraints. The columns themselves
// are plain varchars — nothing here is a native PG enum type, and they are
// deliberately left that way — so these sets are what the application enforces;
// keep them in step with the constraints. The service judges them on the merged
// row, so a bad value comes back as a 400 naming the field rather than a raw
// Postgres 23514.
// ck_th_status — where a hold sits in its life: parked (HELD), pulled onto a
// till and being edited (LOCKED / RESUMED), or finished with (CONVERTED /
// CANCELLED / EXPIRED).
export enum TransactionHoldStatus {
  HELD = 'HELD',
  LOCKED = 'LOCKED',
  RESUMED = 'RESUMED',
  CONVERTED = 'CONVERTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}
// ck_th_doc_type — what the parked screen was raising, and, on
// th_converted_doc_type, what it eventually became. Purchase-side documents are
// in the set because the same park/recall behaviour serves a GRN counter.
export enum TransactionHoldDocType {
  SALE_INVOICE = 'SALE_INVOICE',
  POS_BILL = 'POS_BILL',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
  SALE_ORDER = 'SALE_ORDER',
  // The quotation screen parks carts here too. It borrowed SALE_ORDER until this
  // member existed, which meant sharing the ux_th_hold_no number space (and the
  // recall list) with any sale-order screen; rows written before this stay
  // SALE_ORDER, so a picker that wants them has to look under both.
  QUOTATION = 'QUOTATION',
  SALE_RETURN = 'SALE_RETURN',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  GRN = 'GRN',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
}
// ck_th_device_type — the hardware the hold was taken on. Narrower than
// sale_bill.sb_device_type, which the bill module leaves as free text.
export enum TransactionHoldDeviceType {
  DESKTOP = 'DESKTOP',
  WEB = 'WEB',
  MOBILE = 'MOBILE',
}
export const TRANSACTION_HOLD_STATUSES = Object.values(TransactionHoldStatus);
export const TRANSACTION_HOLD_DOC_TYPES = Object.values(TransactionHoldDocType);
export const TRANSACTION_HOLD_DEVICE_TYPES = Object.values(TransactionHoldDeviceType);
// Terminal states — a hold in one of these is done and can no longer be resumed,
// so the service refuses to move it back to an open status. Not a CHECK
// constraint: it is a transition rule, and a constraint only ever sees one row.
export const TRANSACTION_HOLD_CLOSED_STATUSES = [
  TransactionHoldStatus.CONVERTED,
  TransactionHoldStatus.CANCELLED,
  TransactionHoldStatus.EXPIRED,
] as readonly string[];
// The statuses ix_th_expiry indexes — the ones an expiry / purge job can still
// act on.
export const TRANSACTION_HOLD_EXPIRABLE_STATUSES = [
  TransactionHoldStatus.HELD,
  TransactionHoldStatus.LOCKED,
] as readonly string[];
// The edit-lock state machine the resume / release / convert endpoints drive.
// The lock holder is the DEVICE (the X-Device-Id header), not the user: two
// operators sharing one till are the same holder, one operator on two tills is
// not.
//
//   HELD ──(resume by device)──▶ LOCKED ──(convert)──▶ CONVERTED
//                                  │
//                                  └──(release)──▶ HELD
//
// There is deliberately NO timeout or auto-release: a LOCKED hold stays locked
// until the device that took it gives it back. th_expires_at is untouched by
// these paths.
export interface TransactionHoldLockScope {
  thCompanyId: string;
  thBranchId: string;
}
// The document a hold became, stamped onto the conversion trace as the hold
// closes. th_converted_doc_id is polymorphic (no FK), so the type travels with
// the id.
export interface TransactionHoldConversion {
  thConvertedDocType: TransactionHoldDocType;
  thConvertedDocId: string;
  thConvertedNo?: string | null;
  thConvertedBy?: string | null;
}
// "Somebody has this open" — what force-release is allowed to clear. LOCKED is
// the lock this module takes; RESUMED is what in-use meant BEFORE it existed
// (a client writing the status straight through the CRUD route), and rows in
// that state would otherwise be stuck for good: un-resumable (409, not HELD)
// and un-releasable (403, no th_locked_by to match). Terminal states are
// deliberately absent — nothing reopens a converted hold.
export const TRANSACTION_HOLD_IN_USE_STATUSES = [
  TransactionHoldStatus.LOCKED,
  TransactionHoldStatus.RESUMED,
] as readonly string[];
// One entry per single-column enum CHECK, in the order the columns are declared.
// `nullable` mirrors the DDL: th_doc_type, th_status and th_device_type are NOT
// NULL, th_converted_doc_type is nullable until the hold becomes a document.
export const TRANSACTION_HOLD_VALUE_GUARDS = [
  { field: 'thDocType', allowed: TRANSACTION_HOLD_DOC_TYPES, nullable: false },
  { field: 'thStatus', allowed: TRANSACTION_HOLD_STATUSES, nullable: false },
  { field: 'thDeviceType', allowed: TRANSACTION_HOLD_DEVICE_TYPES, nullable: false },
  { field: 'thConvertedDocType', allowed: TRANSACTION_HOLD_DOC_TYPES, nullable: true },
] as const satisfies ReadonlyArray<{
  field: string;
  allowed: readonly string[];
  nullable: boolean;
}>;
export type TransactionHoldGuardedField = (typeof TRANSACTION_HOLD_VALUE_GUARDS)[number]['field'];
// undefined = field absent from the request, so the stored value / column
// default stands and there is nothing to check.
export type TransactionHoldGuardedValues = Partial<
  Record<TransactionHoldGuardedField, string | null | undefined>
>;
// One parked transaction. th_customer_name / th_item_count / th_total_qty /
// th_total_amount are SNAPSHOTS of the screen at hold time — transaction_hold
// stores no lines of its own, the whole cart lives in th_ui_state — so the
// payload mirrors the stored row without joining anything back.
export interface TransactionHoldPayload {
  thId: string;
  thCompanyId: string;
  thBranchId: string;
  thAccYear: number;
  thHoldNo: string;
  thHoldDate: string;
  thDocType: TransactionHoldDocType;
  thCounterId: string | null;
  thSessionId: string | null;
  thUserId: string | null;
  thDeviceId: string;
  thDeviceType: TransactionHoldDeviceType;
  thCustomerName: string | null;
  thItemCount: number;
  thTotalQty: number;
  thTotalAmount: number;
  thStatus: TransactionHoldStatus;
  thHoldReason: string | null;
  thRemarks: string | null;
  thExpiresAt: string | null;
  thLockedBy: string | null;
  thLockedAt: string | null;
  thResumedBy: string | null;
  thResumedAt: string | null;
  thResumeCount: number;
  thConvertedDocType: TransactionHoldDocType | null;
  thConvertedDocId: string | null;
  thConvertedNo: string | null;
  thConvertedAt: string | null;
  thConvertedBy: string | null;
  thIsStockReserved: boolean;
  // Whatever the till screen needs to redraw itself — cart lines, discounts,
  // focus. Stored and returned verbatim; the server never reads into it.
  thUiState: Prisma.JsonValue | null;
  thIsDeleted: boolean;
  thCreatedBy: string | null;
  thCreatedAt: string;
  thModifiedBy: string | null;
  thModifiedAt: string | null;
}
// A configured grid answers with its own column set, so a list row is either the
// module's payload or whatever the grid SQL selected.
export type TransactionHoldListItem = TransactionHoldPayload | Record<string, unknown>;
export interface TransactionHoldDeleteResult {
  thId: string;
  deleted: true;
}
// The (company, branch, accounting year) a hold lives in — immutable once the
// row exists.
export interface TransactionHoldScope {
  thCompanyId: string;
  thBranchId: string;
  thAccYear: number;
}
// What ux_th_hold_no is keyed on: the scope above plus the document type, so a
// SALE_INVOICE and a SALE_ORDER hold may share a number.
export interface TransactionHoldHoldNoScope extends TransactionHoldScope {
  thDocType: string;
}
