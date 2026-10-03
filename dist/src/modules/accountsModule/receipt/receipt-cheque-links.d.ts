import { Prisma } from '@prisma/client';
export interface ReceiptChequeScope {
    receiptVoucherId: string;
    voucherIds: readonly string[];
}
export declare function receiptChequeFilter(tx: Prisma.TransactionClient, scope: ReceiptChequeScope): Promise<Prisma.AccPdcRegisterWhereInput>;
export declare function receiptPdcVoucherWhere(header: {
    avhVoucherId: string;
    avhVoucherTypeId: number;
}): Prisma.AccVoucherHeaderWhereInput;
