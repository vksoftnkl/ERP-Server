import { Prisma } from '@prisma/client';
export declare const SALE_RETURN_NUMBER_PREFIX = "SRT";
export declare function allocateSaleReturnNumber(tx: Prisma.TransactionClient, q: {
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
}): Promise<{
    lastNo: bigint;
    refno: string;
}>;
