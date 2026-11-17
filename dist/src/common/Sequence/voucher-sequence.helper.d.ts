import { AccVoucherSeq, AccVoucherType, Prisma } from '@prisma/client';
export declare const SEQ_VOUCHER_PREFIX_MAX_LENGTH = 60;
export declare const SEQ_VOUCHER_SUFFIX_MAX_LENGTH = 20;
export declare const KNOWN_FORMAT_TOKENS: readonly ["FY", "YY", "BR"];
export type FormatToken = (typeof KNOWN_FORMAT_TOKENS)[number];
export declare const GST_DOC_NO_MAX_LENGTH = 16;
export declare const GST_OUTWARD_SIDE = "OUTPUT";
export interface VoucherNumberScope {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceCode?: string | null;
    documentDate?: Date | null;
    typedRefno?: string | null;
}
export interface AllocatedVoucherNumber {
    lastNo: bigint;
    refno: string;
    periodKey: string;
    typed?: true;
}
export declare function allocateVoucherNumber(tx: Prisma.TransactionClient, scope: VoucherNumberScope): Promise<AllocatedVoucherNumber>;
export declare function previewNextVoucherNumber(client: Prisma.TransactionClient, scope: VoucherNumberScope): Promise<{
    refno: string | null;
    code: string | null;
}>;
export declare function allocateVoucherSlno(tx: Prisma.TransactionClient, companyId: string, accYear: string): Promise<bigint>;
export declare function buildRefno(sequence: AccVoucherSeq): string;
export interface VoucherFormat {
    prefix: string | null;
    suffix: string | null;
    noWidth: number;
}
export interface VoucherFormatScope {
    vchrTypeId: number;
    branchId: string;
    accYear: string;
}
export declare function expandVoucherFormat(tx: Prisma.TransactionClient, scope: VoucherFormatScope, format: VoucherFormat): Promise<VoucherFormat>;
export declare function scanFormatTokens(text: string | null | undefined): {
    names: FormatToken[];
    unknown: string | undefined;
};
export declare function shortAccYear(accYear: string): string | null;
export declare function fillVoucherFormatTokens(text: string | null, values: Record<FormatToken, string>): string | null;
export declare function voucherStartNo(voucherType: Partial<Pick<AccVoucherType, 'vchrStartNo'>>): number;
export declare function firstVoucherNumber(format: VoucherFormat, startNo?: number): string;
export declare function formatHasBranchToken(prefix: string | null, suffix: string | null): boolean;
export type CounterRuleSubject = Pick<AccVoucherType, 'vchrNoPrefix' | 'vchrNoSuffix'> & Partial<Pick<AccVoucherType, 'vchrGstSide' | 'vchrParentId'>>;
export declare function assertCounterRules(tx: Prisma.TransactionClient, scope: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
}, voucherType: CounterRuleSubject, format: VoucherFormat, startNo: number): Promise<void>;
export declare function acquireVoucherScopeLock(tx: Prisma.TransactionClient, scope: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceCode: string;
    periodKey: string;
}): Promise<void>;
