import { AccVoucherSeq, Prisma } from '@prisma/client';
export interface VoucherNumberScope {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceCode?: string | null;
    documentDate?: Date | null;
}
export interface AllocatedVoucherNumber {
    lastNo: bigint;
    refno: string;
    periodKey: string;
}
export declare function allocateVoucherNumber(tx: Prisma.TransactionClient, scope: VoucherNumberScope): Promise<AllocatedVoucherNumber>;
export declare function allocateVoucherSlno(tx: Prisma.TransactionClient, companyId: string, accYear: string): Promise<bigint>;
export declare function buildRefno(sequence: AccVoucherSeq): string;
