import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
export type TenderDetailErrorDetail = ModuleApiErrorDetail;
export type TenderDetailErrorResponse = ModuleApiErrorResponse<TenderDetailErrorDetail>;
export type TenderDetailSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
// The enum-shaped td_* columns. Unlike charge_master's, these ARE still CHECK
// constraints in the database (ck_td_src_module / ck_td_src_doc_type /
// ck_td_dr_cr / ck_td_settle_status, migration 20260731090000) — the enums and
// the guard below exist so a bad value comes back as a 400 naming the field
// instead of a raw Postgres 23514. The columns themselves are varchar, so the
// service asserts the enum when reading a row back.
// Which module raised the document the money belongs to.
export enum TenderSrcModule {
  SALES = 'SALES',
  ACCOUNTS = 'ACCOUNTS',
  POS = 'POS',
  SERVICE = 'SERVICE',
  OTHER = 'OTHER',
}
// Which kind of document it is (td_src_doc_id is polymorphic — no FK).
export enum TenderSrcDocType {
  SALES_ORDER = 'SALES_ORDER',
  SALE_BILL = 'SALE_BILL',
  SALE_RETURN = 'SALE_RETURN',
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
  OTHER = 'OTHER',
}
// Which side the tender ledger takes: money in on a sale is DR, money out on a
// return / refund is CR.
export enum TenderDrCr {
  DR = 'DR',
  CR = 'CR',
}
// Where a non-cash tender is in its journey from the acquirer to the bank.
export enum TenderSettleStatus {
  NA = 'NA',
  PENDING = 'PENDING',
  SETTLED = 'SETTLED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}
export const TENDER_SRC_MODULES = Object.values(TenderSrcModule);
export const TENDER_SRC_DOC_TYPES = Object.values(TenderSrcDocType);
export const TENDER_DR_CRS = Object.values(TenderDrCr);
export const TENDER_SETTLE_STATUSES = Object.values(TenderSettleStatus);
// One entry per enum CHECK constraint, in the order the columns are declared.
// None of the four columns is nullable in the DDL.
export const TENDER_DETAIL_VALUE_GUARDS = [
  { field: 'tdSrcModule', allowed: TENDER_SRC_MODULES, nullable: false },
  { field: 'tdSrcDocType', allowed: TENDER_SRC_DOC_TYPES, nullable: false },
  { field: 'tdDrCr', allowed: TENDER_DR_CRS, nullable: false },
  { field: 'tdSettleStatus', allowed: TENDER_SETTLE_STATUSES, nullable: false },
] as const satisfies ReadonlyArray<{
  field: string;
  allowed: readonly string[];
  nullable: boolean;
}>;
export type TenderDetailGuardedField = (typeof TENDER_DETAIL_VALUE_GUARDS)[number]['field'];
// undefined = field absent from the request, so the stored value / column
// default stands and there is nothing to check.
export type TenderDetailGuardedValues = Partial<
  Record<TenderDetailGuardedField, string | null | undefined>
>;
// One tendered amount on a document. Every td_* value except the amounts is a
// SNAPSHOT taken from the tender master at tender time, so the payload mirrors
// the stored row — tdTenderName / tdTenderLedgerName are the exceptions, display
// labels read from the mapped master rows.
export interface TenderDetailPayload {
  tdId: string;
  tdCompanyId: string;
  tdBranchId: string;
  tdTenantId: string | null;
  tdAccYear: string;
  tdSrcModule: TenderSrcModule;
  tdSrcDocType: TenderSrcDocType;
  tdSrcDocId: string;
  tdRowNo: number;
  // Date-only column, emitted as YYYY-MM-DD rather than a UTC midnight.
  tdDocDate: string;
  tdPartyLedgerId: string;
  tdVoucherId: string | null;
  tdTenderId: string;
  tdTenderName: string | null;
  // acc_tender_types.ttm_type_id is an integer; carried as a string the way the
  // tender master module carries tndTypeId.
  tdTenderTypeId: string;
  tdTenderLedgerId: string;
  tdTenderLedgerName: string | null;
  tdDrCr: TenderDrCr;
  tdAmount: number;
  tdSurchargePerc: number;
  tdSurchargeAmt: number;
  tdTotalAmt: number;
  tdReceivedAmt: number;
  tdChangeAmt: number;
  tdUnitsUsed: number;
  tdConversionRate: number;
  tdRefNo: string | null;
  tdAuthCode: string | null;
  tdCardLast4: string | null;
  tdBankName: string | null;
  tdPayerVpa: string | null;
  tdInstrumentDate: string | null;
  tdIsPdc: boolean;
  tdSettleStatus: TenderSettleStatus;
  tdSettleLedgerId: string | null;
  tdExpectedSettleOn: string | null;
  tdSettledOn: string | null;
  tdSettleAmount: number | null;
  tdMdrAmt: number;
  tdSettleRefNo: string | null;
  tdSettleVoucherId: string | null;
  tdSessionId: string | null;
  tdDeviceId: string | null;
  tdUserId: string;
  tdNotes: string | null;
  tdIsDeleted: boolean;
  tdSyncDate: string | null;
  tdCreatedOn: string;
  tdCreatedBy: string;
  tdModifiedOn: string | null;
  tdModifiedBy: string | null;
}
export interface TenderDetailDeleteResult {
  tdId: string;
  deleted: true;
}
// The parent document a tender line hangs off, as the owning module knows it.
// Every field is inherited by each tender of that document unless the payload
// overrides it, so a bill never repeats its own scope on each line it sends.
export interface TenderDocumentScope {
  tdSrcModule: TenderSrcModule;
  tdSrcDocType: TenderSrcDocType;
  tdSrcDocId: string;
  tdCompanyId: string;
  tdBranchId: string;
  tdTenantId: string | null;
  tdAccYear: string;
  // Snapshot of the document's date — td_src_doc_id is polymorphic, so the
  // date cannot be joined back from the parent.
  tdDocDate: Date;
  // The customer / supplier ledger the document is raised against.
  tdPartyLedgerId: string;
  // Who tendered, and where.
  tdUserId: string;
  tdSessionId: string | null;
  tdDeviceId: string | null;
  // Money in (a sale) or money out (a return); a line may still override it.
  tdDrCr: TenderDrCr;
}
// How an owning module labels the audit rows written for its tender lines, so a
// tender captured with a bill stays on the bill's screen in the trail.
export interface TenderDocumentAudit {
  tableName: string;
  screenName: string;
  // Prefixes the audit note: 'Bill tender' reads as "Bill tender created".
  entityName: string;
}
