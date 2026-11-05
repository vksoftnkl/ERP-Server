import { Prisma } from '@prisma/client';
import { type StatutoryEnforce } from "../../../common/posting/statutory.types";
export declare const STATUTORY_40A3 = "STATUTORY_40A3";
export interface CashPaymentLimitFinding {
    code: typeof STATUTORY_40A3;
    enforce: StatutoryEnforce;
    message: string;
    field: string;
    statutory: {
        code: string;
        value: number;
        effectiveFrom: string;
        isCompanyOverride: boolean;
        date: string;
        payeeLedgerId: string | null;
        thisDocument: number;
        earlierToday: number;
    };
}
export declare function checkCashPaymentLimit(tx: Prisma.TransactionClient, input: {
    companyId: string;
    accYear: string;
    onDate: string;
    payeeLedgerId: string | null;
    cash: Prisma.Decimal;
    excludeDocId: string | null;
    field: string;
}): Promise<CashPaymentLimitFinding | null>;
