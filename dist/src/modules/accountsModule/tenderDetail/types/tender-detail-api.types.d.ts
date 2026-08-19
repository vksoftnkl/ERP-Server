import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
export type TenderDetailErrorDetail = ModuleApiErrorDetail;
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
    OTHER = "OTHER"
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
    tdPartyLedgerId: string;
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
