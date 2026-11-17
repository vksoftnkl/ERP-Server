import { AccVoucherSeq, AccVoucherType, Prisma } from '@prisma/client';
export declare const SEQ_VOUCHER_PREFIX_MAX_LENGTH = 60;
export declare const SEQ_VOUCHER_SUFFIX_MAX_LENGTH = 20;
export declare const KNOWN_FORMAT_TOKENS: readonly ["FY", "YY", "BR", "FYC", "DV"];
export type FormatToken = (typeof KNOWN_FORMAT_TOKENS)[number];
export declare const GST_DOC_NO_MAX_LENGTH = 16;
export declare const GST_DOC_NO_PATTERN: RegExp;
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
    deviceCode?: string | null;
}
export declare function expandVoucherFormat(tx: Prisma.TransactionClient, scope: VoucherFormatScope, format: VoucherFormat): Promise<VoucherFormat>;
export declare function scanFormatTokens(text: string | null | undefined): {
    names: FormatToken[];
    unknown: string | undefined;
};
export declare function shortAccYear(accYear: string): string | null;
export declare function compactAccYear(accYear: string): string | null;
export declare function isSharedDeviceCode(deviceCode: string | null | undefined): boolean;
export declare function formatHasDeviceToken(prefix: string | null | undefined, suffix: string | null | undefined): boolean;
export declare function isDeviceWideSeries(voucherType: Partial<Pick<AccVoucherType, 'vchrGstDocNo' | 'vchrNoPrefix' | 'vchrNoSuffix'>>, deviceCode?: string | null): boolean;
export declare function deviceSeriesAnchorBranch(client: Pick<Prisma.TransactionClient, '$queryRaw'>, companyId: string): Promise<string | null>;
export declare function findDeviceSeries(client: Prisma.TransactionClient, scope: {
    vchrTypeId: number;
    companyId: string;
    accYear: string;
    deviceCode: string;
    periodKey: string;
}): Promise<AccVoucherSeq | null>;
export declare function acquireDeviceSeriesLock(tx: Prisma.TransactionClient, scope: {
    vchrTypeId: number;
    companyId: string;
    accYear: string;
    deviceCode: string;
    periodKey: string;
}): Promise<void>;
export declare function longestLiveDeviceCode(client: Pick<Prisma.TransactionClient, '$queryRaw'>, companyId: string | null): Promise<string | null>;
export declare function fillVoucherFormatTokens(text: string | null, values: Record<FormatToken, string>): string | null;
export declare function voucherStartNo(voucherType: Partial<Pick<AccVoucherType, 'vchrStartNo'>>): number;
export declare function firstVoucherNumber(format: VoucherFormat, startNo?: number): string;
export declare function formatHasBranchToken(prefix: string | null, suffix: string | null): boolean;
export type CounterRuleSubject = Pick<AccVoucherType, 'vchrNoPrefix' | 'vchrNoSuffix'> & Partial<Pick<AccVoucherType, 'vchrGstSide' | 'vchrParentId' | 'vchrGstDocNo'>>;
export declare function assertCounterRules(tx: Prisma.TransactionClient, scope: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
}, voucherType: CounterRuleSubject, format: VoucherFormat, startNo: number): Promise<void>;
export declare function assertGstDocNumber(sample: string, vchrTypeId: number, when: 'counter' | 'draw'): void;
export declare function acquireVoucherScopeLock(tx: Prisma.TransactionClient, scope: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceCode: string;
    periodKey: string;
}): Promise<void>;
