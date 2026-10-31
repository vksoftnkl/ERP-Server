import { Prisma } from '@prisma/client';
import { BillSettlementMode, DrCr } from './types/receipt-enum';
import type { SaveReceiptOtherLineDto, SaveReceiptTenderDto } from './dto/save-receipt.dto';
import type { ReceiptParty, ReceiptWriteClient } from './receipt.guards';
import type { ReceiptSettings } from './receipt.settings';
export interface NormalisedTender {
    rowNo: number;
    tenderId: string;
    tenderName: string;
    tenderTypeId: number;
    tenderTypeName: string;
    tenderLedgerId: string;
    clearingLedgerId: string | null;
    surchargeLedgerId: string | null;
    amount: Prisma.Decimal;
    receivedAmt: Prisma.Decimal;
    changeAmt: Prisma.Decimal;
    mdrAmt: Prisma.Decimal;
    surchargePerc: Prisma.Decimal;
    surchargeAmt: Prisma.Decimal;
    refNo: string | null;
    authCode: string | null;
    cardLast4: string | null;
    bankName: string | null;
    payerVpa: string | null;
    instrumentDate: Date | null;
    isCheque: boolean;
    isPdc: boolean;
    notes: string | null;
    settlementMode: BillSettlementMode;
    cheque: {
        bankBranch: string | null;
        ifsc: string | null;
        micr: string | null;
        drawerName: string | null;
        bankLedgerId: string | null;
    } | null;
    tdId: string | null;
}
export declare function normaliseTenders(client: ReceiptWriteClient, params: {
    tenders: readonly SaveReceiptTenderDto[];
    companyId: string;
    branchId: string;
    receiptDate: Date;
}): Promise<NormalisedTender[]>;
export interface NormalisedOtherLine {
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
}
export interface ExpectedRoles {
    missing: string[];
}
export declare function normaliseOtherLines(client: ReceiptWriteClient, params: {
    lines: readonly SaveReceiptOtherLineDto[];
    tenders: readonly NormalisedTender[];
    companyId: string;
    branchId: string;
    party: ReceiptParty;
    partyId: string;
    settings: ReceiptSettings;
    ledgerForRole: (role: string) => {
        ledgerId: string;
        ledgerName: string;
    } | null;
}): Promise<{
    lines: NormalisedOtherLine[];
    expected: ExpectedRoles;
}>;
