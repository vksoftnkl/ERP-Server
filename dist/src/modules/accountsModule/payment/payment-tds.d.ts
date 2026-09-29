import { Prisma } from '@prisma/client';
import { type TdsRateFacts } from '../vouchers/voucher-facts';
import type { PaymentParty } from './payment.guards';
export interface PaymentTdsFacts {
    rate: TdsRateFacts | null;
    annualBaseSoFar: Prisma.Decimal;
}
export interface PaymentTdsComputed {
    section: string;
    sectionName: string;
    deducteeType: string;
    registerDeductee: 'COMPANY' | 'NON_COMPANY';
    rate: Prisma.Decimal;
    rateSource: 'MASTER' | 'NO_PAN' | 'BELOW_THRESHOLD';
    base: Prisma.Decimal;
    tax: Prisma.Decimal;
    deducted: boolean;
    reason: string | null;
}
export declare function loadPaymentTdsFacts(tx: Prisma.TransactionClient, params: {
    companyId: string;
    party: PaymentParty;
    accYear: string;
    date: string;
}): Promise<PaymentTdsFacts | null>;
export declare function computePaymentTds(party: PaymentParty, facts: PaymentTdsFacts, net: Prisma.Decimal): PaymentTdsComputed | null;
