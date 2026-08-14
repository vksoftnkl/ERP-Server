import type { Prisma } from '@prisma/client';
import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
import type { ModuleListMeta } from "../../../../common/types/module-list.types";
export type TxnHoldErrorDetail = ModuleApiErrorDetail;
export type TxnHoldErrorResponse = ModuleApiErrorResponse<TxnHoldErrorDetail>;
export type TxnHoldSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type TxnHoldListMeta = ModuleListMeta;
export declare enum TxnHoldKind {
    HOLD = "HOLD",
    AUTOSAVE = "AUTOSAVE",
    TEMPLATE = "TEMPLATE"
}
export declare enum TxnHoldSrcModule {
    SALES = "SALES",
    PURCHASE = "PURCHASE",
    INVENTORY = "INVENTORY",
    ACCOUNTS = "ACCOUNTS",
    POS = "POS",
    SERVICE = "SERVICE",
    OTHER = "OTHER"
}
export declare enum TxnHoldDocType {
    QUOTATION = "QUOTATION",
    SALES_ORDER = "SALES_ORDER",
    DELIVERY_CHALLAN = "DELIVERY_CHALLAN",
    SALE_BILL = "SALE_BILL",
    SALE_RETURN = "SALE_RETURN",
    PURCHASE_ORDER = "PURCHASE_ORDER",
    PURCHASE_BILL = "PURCHASE_BILL",
    PURCHASE_RETURN = "PURCHASE_RETURN",
    STOCK_TRANSFER = "STOCK_TRANSFER",
    STOCK_ADJUSTMENT = "STOCK_ADJUSTMENT",
    RECEIPT = "RECEIPT",
    PAYMENT = "PAYMENT",
    JOURNAL = "JOURNAL",
    OTHER = "OTHER"
}
export declare enum TxnHoldStatus {
    HELD = "HELD",
    LOCKED = "LOCKED",
    RESUMED = "RESUMED",
    CONVERTED = "CONVERTED",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED",
    ABANDONED = "ABANDONED"
}
export declare enum TxnHoldPartyType {
    CUSTOMER = "CUSTOMER",
    SUPPLIER = "SUPPLIER",
    EMPLOYEE = "EMPLOYEE",
    LEDGER = "LEDGER",
    BRANCH = "BRANCH",
    OTHER = "OTHER"
}
export declare const TXN_HOLD_KINDS: TxnHoldKind[];
export declare const TXN_HOLD_SRC_MODULES: TxnHoldSrcModule[];
export declare const TXN_HOLD_DOC_TYPES: TxnHoldDocType[];
export declare const TXN_HOLD_STATUSES: TxnHoldStatus[];
export declare const TXN_HOLD_PARTY_TYPES: TxnHoldPartyType[];
export declare const TXN_HOLD_CLOSED_STATUSES: readonly string[];
export declare const TXN_HOLD_IN_USE_STATUSES: readonly string[];
export declare const TXN_HOLD_EXPIRABLE_STATUSES: readonly string[];
export declare const TXN_HOLD_VALUE_GUARDS: readonly [{
    readonly field: "txhKind";
    readonly allowed: TxnHoldKind[];
    readonly nullable: false;
}, {
    readonly field: "txhSrcModule";
    readonly allowed: TxnHoldSrcModule[];
    readonly nullable: false;
}, {
    readonly field: "txhDocType";
    readonly allowed: TxnHoldDocType[];
    readonly nullable: false;
}, {
    readonly field: "txhStatus";
    readonly allowed: TxnHoldStatus[];
    readonly nullable: false;
}, {
    readonly field: "txhPartyType";
    readonly allowed: TxnHoldPartyType[];
    readonly nullable: true;
}];
export type TxnHoldGuardedField = (typeof TXN_HOLD_VALUE_GUARDS)[number]['field'];
export type TxnHoldGuardedValues = Partial<Record<TxnHoldGuardedField, string | null | undefined>>;
export declare const TXN_HOLD_LOCK_TTL_SECONDS_MIN = 30;
export declare const TXN_HOLD_LOCK_TTL_SECONDS_MAX = 86400;
export declare const TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT = 900;
export interface TxnHoldLockScope {
    txhCompanyId: string;
    txhBranchId: string;
    txhAccYear?: string;
    lockTtlSeconds?: number;
    txhLockToken?: string | null;
}
export interface TxnHoldConversion {
    txhConvertedDocId: string;
    txhConvertedAccYear: string;
    txhConvertedRefno?: string | null;
    txhConvertedBy?: string | null;
}
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
export type TxnHoldListItem = TxnHoldPayload | Record<string, unknown>;
export interface TxnHoldDeleteResult {
    txhId: string;
    deleted: true;
}
export interface TxnHoldScope {
    txhCompanyId: string;
    txhBranchId: string;
    txhAccYear: string;
}
export interface TxnHoldHoldNoScope extends TxnHoldScope {
    txhDocType: string;
}
export interface TxnHoldSlnoScope extends TxnHoldHoldNoScope {
    txhDeviceId: string;
}
export interface TxnHoldAutosaveScope {
    txhAccYear: string;
    txhDeviceId: string;
    txhHeldBy: string;
    txhDocType: string;
}
