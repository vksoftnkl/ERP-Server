import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
export declare enum TenderDetailErrorCode {
    NOT_FOUND = "TENDER_LINE_NOT_FOUND",
    LOOKUP_AMBIGUOUS = "TENDER_LINE_LOOKUP_AMBIGUOUS",
    LOOKUP_MISSING = "TENDER_LINE_LOOKUP_MISSING",
    ROW_NO_DUPLICATE = "TENDER_LINE_ROW_NO_DUPLICATE",
    DOCUMENT_IMMUTABLE = "TENDER_LINE_DOCUMENT_IMMUTABLE",
    DOCUMENT_MISMATCH = "TENDER_LINE_DOCUMENT_MISMATCH",
    TENDER_NOT_FOUND = "TENDER_LINE_TENDER_NOT_FOUND",
    TENDER_TYPE_NOT_FOUND = "TENDER_LINE_TENDER_TYPE_NOT_FOUND",
    LEDGER_NOT_FOUND = "TENDER_LINE_LEDGER_NOT_FOUND",
    REFERENCE_INVALID = "TENDER_LINE_REFERENCE_INVALID",
    TOTAL_MISMATCH = "TENDER_LINE_TOTAL_MISMATCH",
    VALUE_REQUIRED = "TENDER_LINE_VALUE_REQUIRED",
    VALUE_NOT_ALLOWED = "TENDER_LINE_VALUE_NOT_ALLOWED",
    CHANGE_EXCEEDS_RECEIVED = "TENDER_LINE_CHANGE_EXCEEDS_RECEIVED",
    CONVERSION_RATE_INVALID = "TENDER_LINE_CONVERSION_RATE_INVALID",
    SETTLED_ON_REQUIRED = "TENDER_LINE_SETTLED_ON_REQUIRED",
    INSTRUMENT_DATE_REQUIRED = "TENDER_LINE_INSTRUMENT_DATE_REQUIRED",
    CARD_LAST4_INVALID = "TENDER_LINE_CARD_LAST4_INVALID",
    DATE_INVALID = "TENDER_LINE_DATE_INVALID",
    NUMBER_INVALID = "TENDER_LINE_NUMBER_INVALID",
    TENDER_TYPE_INVALID = "TENDER_LINE_TENDER_TYPE_INVALID",
    FIELD_REQUIRED = "TENDER_LINE_FIELD_REQUIRED"
}
export interface TenderDetailErrorDetail extends ModuleApiErrorDetail {
    code: TenderDetailErrorCode;
}
export type TenderDetailErrorResponse = ModuleApiErrorResponse<TenderDetailErrorDetail>;
export type TenderDetailSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export declare enum TenderSrcModule {
    SALES = "SALES",
    ACCOUNTS = "ACCOUNTS",
    POS = "POS",
    SERVICE = "SERVICE",
    OTHER = "OTHER"
}
export declare enum TenderSrcDocType {
    SALES_ORDER = "SALES_ORDER",
    SALE_BILL = "SALE_BILL",
    SALE_RETURN = "SALE_RETURN",
    RECEIPT = "RECEIPT",
    PAYMENT = "PAYMENT",
    OTHER = "OTHER",
    EXPENSE = "EXPENSE"
}
export declare enum TenderDrCr {
    DR = "DR",
    CR = "CR"
}
export declare enum TenderSettleStatus {
    NA = "NA",
    PENDING = "PENDING",
    SETTLED = "SETTLED",
    PARTIAL = "PARTIAL",
    FAILED = "FAILED"
}
export declare const TENDER_SRC_MODULES: TenderSrcModule[];
export declare const TENDER_SRC_DOC_TYPES: TenderSrcDocType[];
export declare const TENDER_DR_CRS: TenderDrCr[];
export declare const TENDER_SETTLE_STATUSES: TenderSettleStatus[];
export declare const TENDER_DETAIL_VALUE_GUARDS: readonly [{
    readonly field: "tdSrcModule";
    readonly allowed: TenderSrcModule[];
    readonly nullable: false;
}, {
    readonly field: "tdSrcDocType";
    readonly allowed: TenderSrcDocType[];
    readonly nullable: false;
}, {
    readonly field: "tdDrCr";
    readonly allowed: TenderDrCr[];
    readonly nullable: false;
}, {
    readonly field: "tdSettleStatus";
    readonly allowed: TenderSettleStatus[];
    readonly nullable: false;
}];
export type TenderDetailGuardedField = (typeof TENDER_DETAIL_VALUE_GUARDS)[number]['field'];
export type TenderDetailGuardedValues = Partial<Record<TenderDetailGuardedField, string | null | undefined>>;
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
    tdDocDate: string;
    tdPartyLedgerId: string;
    tdVoucherId: string | null;
    tdTenderId: string;
    tdTenderName: string | null;
    tdTenderTypeId: string;
    tdTenderLedgerId: string;
    tdTenderLedgerName: string | null;
    tdDrCr: TenderDrCr;
    tdAmount: number;
    tdSurchargePerc: number;
    tdSurchargeAmt: number;
    tdSurchargeLedgerId: string | null;
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
    tdIsVoided: boolean;
    tdVoidReason: string | null;
    tdVoidedOn: string | null;
    tdVoidedBy: string | null;
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
export interface TenderDocumentScope {
    tdSrcModule: TenderSrcModule;
    tdSrcDocType: TenderSrcDocType;
    tdSrcDocId: string;
    tdCompanyId: string;
    tdBranchId: string;
    tdTenantId: string | null;
    tdAccYear: string;
    tdDocDate: Date;
    tdPartyLedgerId: string | null;
    tdUserId: string;
    tdSessionId: string | null;
    tdDeviceId: string | null;
    tdDrCr: TenderDrCr;
}
export interface TenderDocumentAudit {
    tableName: string;
    screenName: string;
    entityName: string;
}
