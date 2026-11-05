import { Prisma } from '@prisma/client';
import { BillSettlementMode, DrCr } from './types/payment-enum';
import type { SavePaymentOtherLineDto, SavePaymentTenderDto } from './dto/save-payment.dto';
import type { PaymentParty, PaymentWriteClient } from './payment.guards';
import type { PaymentSettings } from './payment.settings';
import { type PaymentTdsComputed, type PaymentTdsFacts } from './payment-tds';
export interface NormalisedPaymentCheque {
    chequeBookId: string;
    bookNo: string;
    bankLedgerId: string;
    bankName: string;
    favouring: string | null;
    acPayee: boolean;
    bankBranch: string | null;
    ifsc: string | null;
    micr: string | null;
    drawerName: string | null;
}
export interface NormalisedPaymentBeneficiary {
    name: string | null;
    accountNo: string | null;
    ifsc: string | null;
}
export interface NormalisedPaymentTender {
    rowNo: number;
    tenderId: string;
    tenderName: string;
    tenderTypeId: number;
    tenderTypeName: string;
    isCashType: boolean;
    tenderLedgerId: string;
    clearingLedgerId: string | null;
    amount: Prisma.Decimal;
    receivedAmt: Prisma.Decimal;
    changeAmt: Prisma.Decimal;
    mdrAmt: Prisma.Decimal;
    refNo: string | null;
    bankName: string | null;
    payerVpa: string | null;
    instrumentDate: Date | null;
    isCheque: boolean;
    isPdc: boolean;
    notes: string | null;
    settlementMode: BillSettlementMode;
    cheque: NormalisedPaymentCheque | null;
    beneficiary: NormalisedPaymentBeneficiary | null;
    tdId: string | null;
}
export type PaymentTenderInput = Omit<SavePaymentTenderDto, 'tdAmount' | 'tdReceivedAmt' | 'tdChangeAmt' | 'tdMdrAmt'> & {
    tdAmount: number | Prisma.Decimal;
    tdReceivedAmt?: number | Prisma.Decimal;
    tdChangeAmt?: number | Prisma.Decimal;
    tdMdrAmt?: number | Prisma.Decimal;
};
export declare function normalisePaymentTenders(client: PaymentWriteClient, params: {
    tenders: readonly PaymentTenderInput[];
    companyId: string;
    branchId: string;
    paymentDate: Date;
    partyName: string;
}): Promise<NormalisedPaymentTender[]>;
export interface NormalisedPaymentOtherLine {
    lineNo: number;
    role: string | null;
    ledgerId: string;
    ledgerName: string | null;
    drCr: DrCr;
    amount: Prisma.Decimal;
    settlesBill: boolean;
    narration: string | null;
    settlementMode: BillSettlementMode;
    isInstrumentSplit: boolean;
    approvedBy: string | null;
}
export declare function normalisePaymentOtherLines(client: PaymentWriteClient, params: {
    lines: readonly SavePaymentOtherLineDto[];
    tenders: readonly NormalisedPaymentTender[];
    companyId: string;
    branchId: string;
    party: PaymentParty;
    partyId: string;
    settings: PaymentSettings;
    tds: PaymentTdsFacts | null;
    ledgerForRole: (role: string) => {
        ledgerId: string;
        ledgerName: string;
    } | null;
}): Promise<{
    lines: NormalisedPaymentOtherLine[];
    tds: PaymentTdsComputed | null;
}>;
