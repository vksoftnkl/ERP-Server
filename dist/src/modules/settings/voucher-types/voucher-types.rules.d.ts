import { AccVoucherType, VoucherNumberingMode } from '@prisma/client';
export declare const VOUCHER_TYPES_MENU_ID = 303;
export declare const VOUCHER_TYPES_AUDIT_SCREEN_NAME = "Voucher Types";
export declare const VOUCHER_TYPES_TABLE_NAME = "accounts.acc_voucher_types";
export declare const PARENT_TYPE_CODES: readonly string[];
export declare const SALES_BILL_TYPE_CODE = "Bil";
export declare const SCREEN_NUMBERED_CODES: readonly string[];
export declare const ALLOWED_METHODS: readonly VoucherNumberingMode[];
export declare const ABBR_PATTERN: RegExp;
export declare const WIDTH_MIN = 1;
export declare const WIDTH_MAX = 9;
export declare const START_NO_MAX = 999999999;
export declare const MIRROR_FIELDS: readonly ["vchrCategory", "vchrNature", "vchrAffectsAccounts", "vchrAffectsInventory", "vchrIsCashVoucher", "vchrIsBankVoucher", "vchrPartyMode", "vchrPartySide", "vchrBillwiseMode", "vchrRaiseBillType", "vchrDrGroups", "vchrCrGroups", "vchrGstRegister", "vchrGstSide", "vchrTdsMode", "vchrMenuId", "vchrInRegister", "vchrInstruments", "vchrTallyExportEnabled", "vchrTallyBaseVoucherType"];
export type MirrorField = (typeof MIRROR_FIELDS)[number];
export type VoucherKind = 'DOCUMENT' | 'VOUCHER_REGISTER' | 'NUMBERING_ONLY';
export type NumberedBy = 'COUNTER' | 'SCREEN';
export declare function kindOf(t: Pick<AccVoucherType, 'vchrAffectsAccounts' | 'vchrInRegister'>): VoucherKind;
export declare function numberedByOf(t: Pick<AccVoucherType, 'vchrTypeCode' | 'vchrParentId'>): NumberedBy;
export declare function isBaseType(t: Pick<AccVoucherType, 'vchrParentId'>): boolean;
export declare function canHaveChildren(t: Pick<AccVoucherType, 'vchrParentId' | 'vchrTypeCode'>): boolean;
export declare function isGstOutward(t: Pick<AccVoucherType, 'vchrGstSide'>): boolean;
export declare function printDocTypeOf(base: Pick<AccVoucherType, 'vchrTypeCode'>, basePurposeDocType: string | null): string | null;
export declare function childTypeCode(baseCode: string, abbr: string, taken: ReadonlySet<string>): string;
export interface VtIssue {
    field: string;
    code: string;
    message: string;
    params?: Record<string, string>;
    rule?: string;
}
export declare function issue(code: string, field: string, message: string, extra?: Pick<VtIssue, 'params' | 'rule'>): VtIssue;
export interface NumberingDraft {
    mode: VoucherNumberingMode;
    prefix: string | null;
    suffix: string | null;
    width: number;
    startNo: number;
}
export interface BranchFact {
    branchId: string;
    branchName: string;
    companyId: string;
    numberCode: string | null;
    gstin: string | null;
}
export interface SeriesFact {
    vchrTypeId: number;
    vchrTypeName: string;
    prefix: string | null;
    suffix: string | null;
}
export interface NumberingFacts {
    vchrTypeId: number | null;
    accYear: string;
    gstOutward: boolean;
    branches: readonly BranchFact[];
    previewBranch: BranchFact | null;
    series: readonly SeriesFact[];
}
export interface NumberingPreview {
    sample: string | null;
    length: number | null;
    branchCode: string | null;
    branchName: string | null;
    accYear: string;
    gstLimit: number | null;
    clashWith: string | null;
}
export interface NumberingVerdict {
    errors: VtIssue[];
    warnings: VtIssue[];
    preview: NumberingPreview;
}
export declare function checkNumbering(d: NumberingDraft, f: NumberingFacts): NumberingVerdict;
export declare function sharedGstin(branches: readonly BranchFact[]): {
    gstin: string;
    count: number;
} | null;
export interface NamedRow {
    vchrTypeId: number;
    vchrTypeName: string;
    vchrTypeShort: string | null;
}
export declare function checkChildIdentity(draft: {
    name: string;
    abbr: string;
}, others: readonly NamedRow[], selfId: number | null): VtIssue[];
export declare const BASE_LOCKED_FIELDS: readonly ["vchrTypeName", "vchrTypeShort", "vchrParentId", "vchrIsActive", "vchrTallyVoucherTypeName"];
export declare const NUMBERING_FIELDS: readonly ["vchrNumberingMode", "vchrNoPrefix", "vchrNoSuffix", "vchrNoWidth", "vchrResetFreq", "vchrStartNo"];
export declare const sameValue: (a: unknown, b: unknown) => boolean;
export declare function lockedFieldChanges(stored: Pick<AccVoucherType, (typeof BASE_LOCKED_FIELDS)[number] | (typeof NUMBERING_FIELDS)[number]>, draft: Partial<Record<(typeof BASE_LOCKED_FIELDS)[number] | (typeof NUMBERING_FIELDS)[number], unknown>>, fields: ReadonlyArray<(typeof BASE_LOCKED_FIELDS)[number] | (typeof NUMBERING_FIELDS)[number]>, why: string): VtIssue[];
export declare const VT_DELIVERY_MODES: readonly ["INSTANT", "PICKUP", "DISPATCH"];
export type VtDeliveryMode = (typeof VT_DELIVERY_MODES)[number];
export declare const VT_DEFAULT_DELIVERY_MODE: VtDeliveryMode;
export declare function hasDeliveryMode(row: Pick<AccVoucherType, 'vchrTypeCode' | 'vchrParentId'> | null, base: Pick<AccVoucherType, 'vchrTypeCode'> | null): boolean;
export declare function effectiveDeliveryMode(own: string | null | undefined, baseMode: string | null | undefined, applies: boolean): VtDeliveryMode | null;
export declare function checkDeliveryMode(sent: string | null | undefined, resolved: string | null, ctx: {
    applies: boolean;
    isBase?: boolean;
}): VtIssue[];
