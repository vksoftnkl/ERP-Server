import { Prisma } from '@prisma/client';
import { TxnStatusEvent } from './txn-status-log.helper';
export interface TempCreditStatusRow {
    atcId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    billRefno: string | null;
}
export interface TempCreditStatusStep {
    credit: TempCreditStatusRow;
    event: TxnStatusEvent;
    fromStatus: string | null;
    toStatus: string;
    changedBy: string;
    changedOn: Date;
    remarks: string | null;
    deviceId?: string | null;
    sessionId?: string | null;
}
export declare function appendTempCreditStatus(tx: Prisma.TransactionClient, step: TempCreditStatusStep): Promise<void>;
export declare function settlementEventOf(toStatus: string, fromStatus: string): TxnStatusEvent;
export declare function movementRemark(before: Prisma.Decimal, after: Prisma.Decimal, toStatus: string, refno: string | null): string;
