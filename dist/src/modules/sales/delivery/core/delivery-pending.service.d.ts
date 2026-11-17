import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import type { BillKey, BillLineKey } from './delivery.constants';
type Client = Prisma.TransactionClient | PrismaService;
export interface BillLineFacts {
    billItemId: string;
    billAccYear: string;
    billId: string;
    billRefno: string | null;
    billDate: string | null;
    companyId: string;
    branchId: string;
    billStatus: string;
    billDeleted: boolean;
    billMode: string | null;
    deliveryMode: string;
    deliveryStatus: string;
    custId: string | null;
    custName: string | null;
    lineNo: number;
    splitNo: number;
    lineDeleted: boolean;
    isService: boolean;
    srcDocType: string | null;
    srcDocRefno: string | null;
    itemId: string;
    unitId: string;
    godownId: string;
    lotId: string | null;
    bucket: string;
    billedQty: Prisma.Decimal;
    factor: Prisma.Decimal;
    unitKg: Prisma.Decimal;
    settledQty: Prisma.Decimal;
    givenQty: Prisma.Decimal;
    pendingQty: Prisma.Decimal;
    settledBase: Prisma.Decimal;
    givenBase: Prisma.Decimal;
    pendingBase: Prisma.Decimal;
    eligible: boolean;
}
export interface HoldingBnd {
    godownId: string;
    itemId: string;
    lotId: string | null;
    bucket: string;
    bndBase: Prisma.Decimal;
}
export interface HoldingBndBill {
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    billDate: string | null;
    custId: string | null;
    custName: string | null;
    deliveryMode: string;
    billItemId: string;
    lineNo: number;
    godownId: string;
    itemId: string;
    lotId: string | null;
    bucket: string;
    unitId: string;
    billedQty: Prisma.Decimal;
    givenQty: Prisma.Decimal;
    pendingQty: Prisma.Decimal;
    pendingBase: Prisma.Decimal;
    factor: Prisma.Decimal;
    unitKg: Prisma.Decimal;
}
export declare class DeliveryPendingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    linesByKeys(client: Client | null, keys: readonly BillLineKey[]): Promise<BillLineFacts[]>;
    linesOfBills(client: Client | null, bills: readonly BillKey[]): Promise<BillLineFacts[]>;
    private facts;
    bndByHolding(client: Client | null, scope: {
        companyId: string;
        branchId: string;
        godownIds?: readonly string[] | null;
        itemIds?: readonly string[] | null;
        lotIds?: readonly string[] | null;
        bucket?: string | null;
    }): Promise<HoldingBnd[]>;
    bndBills(client: Client | null, scope: {
        companyId: string;
        branchId: string;
        godownIds?: readonly string[] | null;
        itemIds?: readonly string[] | null;
        lotIds?: readonly string[] | null;
        bucket?: string | null;
    }): Promise<HoldingBndBill[]>;
}
export declare function dec(v: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal;
export declare function ymd(d: Date | string | null | undefined): string | null;
export {};
