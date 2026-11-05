import { Prisma } from '@prisma/client';
export declare const MONEY_LINE_SRC_DOC_TYPE = "VOUCHER";
type Tx = Prisma.TransactionClient;
type Side = 'DR' | 'CR';
export interface MoneyLineScope {
    voucherId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    voucherDate: string;
    srcModule?: string | null;
    srcDocType?: string | null;
    srcDocId?: string | null;
    partyId?: string | null;
    sessionId?: string | null;
    deviceId?: string | null;
    userId: string;
    createdBy?: string | null;
    bankTender?: 'BANK' | 'CHEQUE' | null;
    tenders?: readonly {
        ledgerId: string;
        drCr: Side;
        tenderId: string;
    }[];
    docLabel?: string | null;
}
export interface MoneyLeg {
    ledgerId: string;
    drCr: Side;
    amount: Prisma.Decimal | number | string;
}
export interface MoneyLineGap {
    ledgerId: string;
    ledgerName: string;
    ledgerType: 'CASH' | 'BANK';
    drCr: Side;
    amount: number;
    code: string;
    message: string;
}
export declare function coverMoneyLines(tx: Tx, scope: MoneyLineScope, legs: readonly MoneyLeg[]): Promise<{
    written: number;
    gaps: MoneyLineGap[];
}>;
export declare function coverPostedVoucher(tx: Tx, voucher: {
    voucherId: string;
    accYear: string;
}, opts?: {
    bankTender?: 'BANK' | 'CHEQUE' | null;
    createdBy?: string | null;
    tenders?: MoneyLineScope['tenders'];
}): Promise<{
    written: number;
    gaps: MoneyLineGap[];
}>;
export declare function retireMoneyLineRows(tx: Tx, voucherId: string, actor: string): Promise<void>;
export {};
