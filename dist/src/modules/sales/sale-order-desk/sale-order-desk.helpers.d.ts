import { Prisma, SaleOrder } from '@prisma/client';
import { TxnStatusEvent } from "../../../common/txn-status-log/txn-status-log.helper";
export interface DeskOrderKeys {
    soId: string;
    soCompanyId: string;
    soBranchId: string;
    soAccYear: string;
}
export declare function requireReason(reason: string | null | undefined, field?: string): string;
export declare function clip(text: string, max: number): string;
export declare function lockDeskOrder(tx: Prisma.TransactionClient, keys: DeskOrderKeys): Promise<SaleOrder>;
export declare function countOpenLines(tx: Prisma.TransactionClient, order: Pick<SaleOrder, 'soId' | 'soAccYear'>): Promise<number>;
export declare function assertDeskOrderOpen(order: SaleOrder, openLines: number): void;
export declare function appendDeskStep(tx: Prisma.TransactionClient, order: SaleOrder, step: {
    event: TxnStatusEvent;
    fromStatus: string | null;
    toStatus: string;
    remarks: string | null;
}, actor: string, now: Date): Promise<void>;
export declare function money(value: Prisma.Decimal | null | undefined): number;
export declare function qty(value: Prisma.Decimal | null | undefined): number;
export declare function dec(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal;
