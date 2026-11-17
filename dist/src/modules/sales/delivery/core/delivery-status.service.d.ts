import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import type { BillKey, DeliveryStatus } from './delivery.constants';
export interface DeliveryStatusChange {
    billId: string;
    billAccYear: string;
    billRefno: string | null;
    statusBefore: string;
    statusAfter: DeliveryStatus;
    changed: boolean;
}
export declare class DeliveryStatusService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    recompute(tx: Prisma.TransactionClient, bills: readonly BillKey[]): Promise<DeliveryStatusChange[]>;
    preview(client: Prisma.TransactionClient | null, bills: readonly BillKey[]): Promise<Map<string, string>>;
}
export interface DeliveryStatusInput {
    billStatus: string;
    deleted: boolean;
    mode: string;
    lines: number;
    openLines: number;
    anySettled: boolean;
    given: Prisma.Decimal;
}
export declare function deliveryStatusOf(a: DeliveryStatusInput): DeliveryStatus;
