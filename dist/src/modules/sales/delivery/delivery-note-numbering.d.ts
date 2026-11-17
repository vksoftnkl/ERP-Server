import { Prisma } from '@prisma/client';
export declare function allocateDeliveryNoteNumber(tx: Prisma.TransactionClient, q: {
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string;
}): Promise<{
    lastNo: bigint;
    refno: string;
    deviceCode: string;
}>;
export declare function deliveryNoteRefno(accYear: string, deviceCode: string, slno: bigint | number): string;
