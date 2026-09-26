import { type AccountsErrorDetail } from "../../../common/utils/module-service.utils";
export declare const VCH: {
    readonly RIGHT_VIEW: "VCH_RIGHT_VIEW";
    readonly RIGHT_CREATE: "VCH_RIGHT_CREATE";
    readonly RIGHT_EDIT: "VCH_RIGHT_EDIT";
    readonly RIGHT_DELETE: "VCH_RIGHT_DELETE";
    readonly RIGHT_POST: "VCH_RIGHT_POST";
    readonly RIGHT_CANCEL: "VCH_RIGHT_CANCEL";
    readonly RIGHT_OVERRIDE: "VCH_RIGHT_OVERRIDE";
    readonly UNBALANCED: "VCH_UNBALANCED";
    readonly NO_LINES: "VCH_NO_LINES";
    readonly LINE_AMOUNT: "VCH_LINE_AMOUNT";
    readonly LEDGER_SIDE: "VCH_LEDGER_SIDE";
    readonly LEDGER_INACTIVE: "VCH_LEDGER_INACTIVE";
    readonly LEDGER_NOT_FOUND: "VCH_LEDGER_NOT_FOUND";
    readonly INSTRUMENT_LEDGER: "VCH_INSTRUMENT_LEDGER";
    readonly PARTY_MODE: "VCH_PARTY_MODE";
    readonly PARTY_NOT_FOUND: "VCH_PARTY_NOT_FOUND";
    readonly BILLWISE_SHORT: "VCH_BILLWISE_SHORT";
    readonly BILL_OVERSPENT: "VCH_BILL_OVERSPENT";
    readonly BILL_NOT_FOUND: "VCH_BILL_NOT_FOUND";
    readonly BILL_WRONG_PARTY: "VCH_BILL_WRONG_PARTY";
    readonly BILL_WRONG_SIDE: "VCH_BILL_WRONG_SIDE";
    readonly ALLOCATION_LINE: "VCH_ALLOCATION_LINE";
    readonly PERIOD_LOCKED: "VCH_PERIOD_LOCKED";
    readonly YEAR_CLOSED: "VCH_YEAR_CLOSED";
    readonly DATE_OUTSIDE_YEAR: "VCH_DATE_OUTSIDE_YEAR";
    readonly TYPE_NOT_REGISTER: "VCH_TYPE_NOT_REGISTER";
    readonly TYPE_INVENTORY: "VCH_TYPE_INVENTORY";
    readonly GST_RATE_MISSING: "VCH_GST_RATE_MISSING";
    readonly GST_LEDGER_UNMAPPED: "VCH_GST_LEDGER_UNMAPPED";
    readonly GST_LEDGER_TYPED: "VCH_GST_LEDGER_TYPED";
    readonly GST_NOT_ALLOWED: "VCH_GST_NOT_ALLOWED";
    readonly TDS_UNMAPPED: "VCH_TDS_UNMAPPED";
    readonly TDS_RATE_MISSING: "VCH_TDS_RATE_MISSING";
    readonly TDS_BELOW_THRESHOLD: "VCH_TDS_BELOW_THRESHOLD";
    readonly TDS_DEPOSITED: "VCH_TDS_DEPOSITED";
    readonly IRN_LIVE: "VCH_IRN_LIVE";
    readonly ALLOCATED_ELSEWHERE: "VCH_ALLOCATED_ELSEWHERE";
    readonly NOT_DRAFT: "VCH_NOT_DRAFT";
    readonly NOT_POSTED: "VCH_NOT_POSTED";
    readonly POSTED: "VCH_POSTED";
    readonly CANCELLED: "VCH_CANCELLED";
    readonly NOT_FOUND: "VCH_NOT_FOUND";
    readonly BACKDATED: "VCH_BACKDATED";
    readonly DUP_DOC_REFNO: "VCH_DUP_DOC_REFNO";
    readonly DOC_REFNO_REQUIRED: "VCH_DOC_REFNO_REQUIRED";
    readonly INVALID: "VCH_INVALID";
};
export type VoucherErrorCode = (typeof VCH)[keyof typeof VCH];
export interface VoucherErrorDetail extends AccountsErrorDetail {
    code: string;
    line?: number;
}
export interface VoucherRefusal {
    code: string;
    message: string;
    field?: string;
    line?: number;
}
export interface VoucherWarning extends VoucherRefusal {
    level: 'INFO' | 'WARN';
    overridable: boolean;
}
export interface VoucherGuardContext {
    dryRun: boolean;
    overrides: readonly string[];
    canOverride: boolean;
    refusals: VoucherRefusal[];
    warnings: VoucherWarning[];
}
export declare function newGuardContext(opts: {
    dryRun: boolean;
    overrides?: readonly string[] | null;
    canOverride: boolean;
}): VoucherGuardContext;
export declare function refuse(ctx: VoucherGuardContext, code: string, message: string, opts?: {
    field?: string;
    line?: number;
}): void;
export declare function warn(ctx: VoucherGuardContext, code: string, message: string, opts?: {
    field?: string;
    line?: number;
    overridable?: boolean;
}): void;
export declare function throwRefusals(message: string, refusals: readonly VoucherRefusal[]): never;
export declare function throwRefused(message: string, code: string, field?: string): never;
export declare function throwRight(message: string, code: string, field?: string): never;
export declare function throwState(message: string, code: string, field?: string): never;
export declare function throwMissing(message: string, code: string, field?: string): never;
export declare function throwInvalid(message: string, code: string, field?: string): never;
