import type { Prisma } from '@prisma/client';
import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
import type { ModuleListMeta } from "../../../../common/types/module-list.types";
export declare enum TxnHoldErrorCode {
    NOT_FOUND = "HOLD_NOT_FOUND",
    LOCKED_ELSEWHERE = "HOLD_LOCKED_ELSEWHERE",
    NOT_RESUMABLE = "HOLD_NOT_RESUMABLE",
    CLOSED = "HOLD_CLOSED",
    NOT_LEASED_HERE = "HOLD_NOT_LEASED_HERE",
    TEMPLATE_NOT_LEASABLE = "HOLD_TEMPLATE_NOT_LEASABLE",
    DEVICE_REQUIRED = "HOLD_DEVICE_REQUIRED",
    DEVICE_INVALID = "HOLD_DEVICE_INVALID",
    OPERATOR_REQUIRED = "HOLD_OPERATOR_REQUIRED",
    CONVERSION_INVALID = "HOLD_CONVERSION_INVALID",
    SCOPE_IMMUTABLE = "HOLD_SCOPE_IMMUTABLE",
    HOLD_NO_DUPLICATE = "HOLD_NO_DUPLICATE",
    SLNO_DUPLICATE = "HOLD_SLNO_DUPLICATE",
    DUPLICATE = "HOLD_DUPLICATE",
    COMPANY_NOT_FOUND = "HOLD_COMPANY_NOT_FOUND",
    BRANCH_NOT_FOUND = "HOLD_BRANCH_NOT_FOUND",
    DEVICE_NOT_FOUND = "HOLD_DEVICE_NOT_FOUND",
    DEVICE_BLOCKED = "HOLD_DEVICE_BLOCKED",
    USER_NOT_FOUND = "HOLD_USER_NOT_FOUND",
    SESSION_NOT_FOUND = "HOLD_SESSION_NOT_FOUND",
    STAFF_NOT_FOUND = "HOLD_STAFF_NOT_FOUND",
    VALUE_REQUIRED = "HOLD_VALUE_REQUIRED",
    VALUE_NOT_ALLOWED = "HOLD_VALUE_NOT_ALLOWED",
    PAYLOAD_INVALID = "HOLD_PAYLOAD_INVALID",
    PARTY_TYPE_REQUIRED = "HOLD_PARTY_TYPE_REQUIRED",
    AMOUNT_NEGATIVE = "HOLD_AMOUNT_NEGATIVE",
    EXPIRY_BEFORE_HOLD = "HOLD_EXPIRY_BEFORE_HOLD",
    PRINT_STAMP_INVALID = "HOLD_PRINT_STAMP_INVALID",
    STATUS_NOT_SETTABLE = "HOLD_STATUS_NOT_SETTABLE",
    DATE_INVALID = "HOLD_DATE_INVALID",
    FIELD_REQUIRED = "HOLD_FIELD_REQUIRED",
    ACC_YEAR_INVALID = "HOLD_ACC_YEAR_INVALID"
}
export interface TxnHoldErrorDetail extends ModuleApiErrorDetail {
    code: TxnHoldErrorCode;
    status?: string;
    lockedDeviceId?: string | null;
    lockExpiresOn?: string | null;
}
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
    txhHoldNo: string | null;
    txhHoldSlno: number | null;
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
