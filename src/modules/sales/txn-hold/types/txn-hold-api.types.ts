import type { Prisma } from '@prisma/client';
import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type TxnHoldErrorDetail = ModuleApiErrorDetail;
export type TxnHoldErrorResponse = ModuleApiErrorResponse<TxnHoldErrorDetail>;
export type TxnHoldSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type TxnHoldListMeta = ModuleListMeta;
// The enum-shaped txh_* columns, member for member with the CHECK constraints
// in migration 20260810160000_add_txn_hold. The columns are plain varchars —
// nothing here is a native PG enum — so the constraint is the authority and
// these sets are what the application checks FIRST, to answer a 400 naming the
// field instead of a raw Postgres 23514. Keep them in step with the DDL.

// ck_txh_kind — what sort of parked work the row is.
export enum TxnHoldKind {
  // Operator pressed Hold; appears in the pick list.
  HOLD = 'HOLD',
  // The screen's own crash-recovery snapshot: invisible to the pick list, at
  // most one live row per (year, device, operator, doc type) — ux_txh_autosave —
  // so posting one overwrites the row in place and bumps txhRevision.
  AUTOSAVE = 'AUTOSAVE',
  // A saved starting point (standing order, repeat basket) that is copied on
  // resume and never consumed.
  TEMPLATE = 'TEMPLATE',
}
// ck_txh_src_module — same vocabulary as txn_status_log's tsl_src_module, so
// one join reads a hold's status trail.
export enum TxnHoldSrcModule {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
  INVENTORY = 'INVENTORY',
  ACCOUNTS = 'ACCOUNTS',
  POS = 'POS',
  SERVICE = 'SERVICE',
  OTHER = 'OTHER',
}
// ck_txh_doc_type — the document this hold will become. Kept in step with
// ck_tsl_src_doc_type; 'OTHER' is legitimate, so a new document type never
// forces a migration on either table.
export enum TxnHoldDocType {
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
// ck_txh_status — where a hold sits in its life.
export enum TxnHoldStatus {
  HELD = 'HELD',
  LOCKED = 'LOCKED',
  RESUMED = 'RESUMED',
  CONVERTED = 'CONVERTED',
  // Retired by the sweeper.
  EXPIRED = 'EXPIRED',
  // Killed by a human.
  CANCELLED = 'CANCELLED',
  // Its device / session went away and never came back.
  ABANDONED = 'ABANDONED',
}
// ck_txh_party_type — which master txhPartyId points into. The reference is
// polymorphic (no FK), so the type travels with the id.
export enum TxnHoldPartyType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
  EMPLOYEE = 'EMPLOYEE',
  LEDGER = 'LEDGER',
  BRANCH = 'BRANCH',
  OTHER = 'OTHER',
}
export const TXN_HOLD_KINDS = Object.values(TxnHoldKind);
export const TXN_HOLD_SRC_MODULES = Object.values(TxnHoldSrcModule);
export const TXN_HOLD_DOC_TYPES = Object.values(TxnHoldDocType);
export const TXN_HOLD_STATUSES = Object.values(TxnHoldStatus);
export const TXN_HOLD_PARTY_TYPES = Object.values(TxnHoldPartyType);
// Terminal states — a hold in one of these is done with and can no longer be
// resumed, so the service refuses to move it back to an open status. Not a
// CHECK constraint: it is a transition rule, and a constraint only ever sees
// one row.
export const TXN_HOLD_CLOSED_STATUSES = [
  TxnHoldStatus.CONVERTED,
  TxnHoldStatus.EXPIRED,
  TxnHoldStatus.CANCELLED,
  TxnHoldStatus.ABANDONED,
] as readonly string[];
// "Somebody has this open" — what force-release is allowed to clear. RESUMED is
// in the set because it is what in-use means for a client that drove the status
// through the CRUD route rather than the lease endpoints; such a row would
// otherwise be stuck for good, un-resumable (409) and un-releasable (403).
// Terminal states are deliberately absent — nothing reopens a converted hold.
export const TXN_HOLD_IN_USE_STATUSES = [
  TxnHoldStatus.LOCKED,
  TxnHoldStatus.RESUMED,
] as readonly string[];
// The statuses ix_txh_expiry indexes — the ones the expiry sweeper can act on.
export const TXN_HOLD_EXPIRABLE_STATUSES = [
  TxnHoldStatus.HELD,
  TxnHoldStatus.LOCKED,
] as readonly string[];
// One entry per single-column enum CHECK, in the order the columns are
// declared. `nullable` mirrors the DDL: only txh_party_type is nullable.
export const TXN_HOLD_VALUE_GUARDS = [
  { field: 'txhKind', allowed: TXN_HOLD_KINDS, nullable: false },
  { field: 'txhSrcModule', allowed: TXN_HOLD_SRC_MODULES, nullable: false },
  { field: 'txhDocType', allowed: TXN_HOLD_DOC_TYPES, nullable: false },
  { field: 'txhStatus', allowed: TXN_HOLD_STATUSES, nullable: false },
  { field: 'txhPartyType', allowed: TXN_HOLD_PARTY_TYPES, nullable: true },
] as const satisfies ReadonlyArray<{
  field: string;
  allowed: readonly string[];
  nullable: boolean;
}>;
export type TxnHoldGuardedField = (typeof TXN_HOLD_VALUE_GUARDS)[number]['field'];
// undefined = field absent from the request, so the stored value / column
// default stands and there is nothing to check.
export type TxnHoldGuardedValues = Partial<Record<TxnHoldGuardedField, string | null | undefined>>;
// ── The lease ──────────────────────────────────────────────────────────────
// The edit lock is a LEASE, not an open-ended lock: txh_locked_on /
// txh_lock_expires_on / txh_lock_token are all-or-nothing (ck_txh_lock_block),
// so every lock carries an end and a token that proves who may release it.
//
//   HELD ──(resume)──▶ LOCKED ──(convert)──▶ CONVERTED
//     ▲                   │
//     └───(release)───────┘
//
// A lease whose txh_lock_expires_on has passed is dead: the next resume takes
// the hold without a force-release, which is what stops a till that died
// mid-edit from stranding a cart. The lock HOLDER is the operator
// (txh_locked_by) on the device that took it (txh_locked_device_id); release
// and convert match on the device, so two operators sharing one till are the
// same holder and one operator on two tills is not.
export const TXN_HOLD_LOCK_TTL_SECONDS_MIN = 30;
export const TXN_HOLD_LOCK_TTL_SECONDS_MAX = 86_400;
export const TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT = 900;
// A lock query is always keyed on the tenant scope, so a hold can be neither
// taken nor spent from another company or branch.
export interface TxnHoldLockScope {
  txhCompanyId: string;
  txhBranchId: string;
  // Optional: a caller that knows the year skips the partition-wide lookup and
  // lets Postgres prune straight to the one partition the hold lives in.
  txhAccYear?: string;
  // Seconds the lease is good for, when the caller wants something other than
  // TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT (a back-office edit outlives a counter
  // recall).
  lockTtlSeconds?: number;
  // Proves the holder on release / convert. Optional — the device already has
  // to match — but when sent it must be the token resume answered with, so a
  // till cannot spend a lease it was handed before a force-release took it away.
  txhLockToken?: string | null;
}
// The document a hold became, stamped onto the conversion trace as the hold
// closes. There is no converted DOC TYPE: a hold becomes the document it was
// parked as, so txhDocType already names the table txhConvertedDocId points
// into. The YEAR travels with the id because a March hold can become an April
// document, and ck_txh_converted_block requires the whole block together.
export interface TxnHoldConversion {
  txhConvertedDocId: string;
  txhConvertedAccYear: string;
  txhConvertedRefno?: string | null;
  txhConvertedBy?: string | null;
}
// One parked document. The party columns and the three roll-up caches are
// SNAPSHOTS taken at hold time so the pick list renders without opening the
// payload or joining any master; everything else about the document is in
// txhPayload, which this module stores and hands back verbatim.
export interface TxnHoldPayload {
  txhId: string;
  txhCompanyId: string;
  txhBranchId: string;
  txhTenantId: string | null;
  txhAccYear: string;
  txhKind: TxnHoldKind;
  txhSrcModule: TxnHoldSrcModule;
  txhDocType: TxnHoldDocType;
  txhHoldNo: string;
  txhHoldSlno: number;
  txhHoldOn: string;
  txhDeviceId: string;
  txhCounterId: string | null;
  txhSessionId: string | null;
  txhHeldBy: string;
  txhPartyType: TxnHoldPartyType | null;
  txhPartyId: string | null;
  txhPartyName: string | null;
  txhPartyMobile: string | null;
  txhStaffId: string | null;
  txhRefLabel: string | null;
  txhItemCount: number;
  txhTotalQty: number;
  txhNetAmount: number;
  // The module's own save body — header, items, charges, tenders, screen state.
  // Stored and returned verbatim; the server never reads into it.
  txhPayload: Prisma.JsonValue;
  txhPayloadVersion: number;
  txhRevision: number;
  txhStatus: TxnHoldStatus;
  txhHoldReason: string | null;
  txhRemarks: string | null;
  txhExpiresOn: string | null;
  txhLockedBy: string | null;
  txhLockedDeviceId: string | null;
  txhLockedOn: string | null;
  txhLockExpiresOn: string | null;
  txhLockToken: string | null;
  txhResumedBy: string | null;
  txhResumedOn: string | null;
  txhResumeCount: number;
  txhConvertedDocId: string | null;
  txhConvertedAccYear: string | null;
  txhConvertedRefno: string | null;
  txhConvertedOn: string | null;
  txhConvertedBy: string | null;
  txhIsStockReserved: boolean;
  txhPrintCount: number;
  txhLastPrintedOn: string | null;
  txhIsDeleted: boolean;
  txhSyncDate: string | null;
  txhCreatedOn: string;
  txhCreatedBy: string;
  txhModifiedOn: string | null;
  txhModifiedBy: string | null;
}
// A configured grid answers with its own column set, so a list row is either the
// module's payload or whatever the grid SQL selected.
export type TxnHoldListItem = TxnHoldPayload | Record<string, unknown>;
export interface TxnHoldDeleteResult {
  txhId: string;
  deleted: true;
}
// The (company, branch, accounting year) a hold lives in. txhAccYear is half the
// primary key and the partition key, so it is immutable once the row exists —
// changing it would mean moving the row to another partition.
export interface TxnHoldScope {
  txhCompanyId: string;
  txhBranchId: string;
  txhAccYear: string;
}
// What ux_txh_hold_no is keyed on: the scope above plus the document type, so a
// SALE_BILL and a SALES_ORDER hold may share a number.
export interface TxnHoldHoldNoScope extends TxnHoldScope {
  txhDocType: string;
}
// What ux_txh_device_slno is keyed on — the per-device offline series behind the
// printed hold number.
export interface TxnHoldSlnoScope extends TxnHoldHoldNoScope {
  txhDeviceId: string;
}
// What ux_txh_autosave is keyed on: one live crash-recovery snapshot per screen.
// Note it is NOT scoped by company / branch — the device and operator already
// are.
export interface TxnHoldAutosaveScope {
  txhAccYear: string;
  txhDeviceId: string;
  txhHeldBy: string;
  txhDocType: string;
}
