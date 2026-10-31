import { Prisma } from '@prisma/client';
import { PdcPostingMode, PdcStatus } from '../receipt/types/receipt-enum';
import { ChequeDueBucket } from './types/cheque-enum';
export interface LockedCheque {
    apdId: string;
    apdAccYear: string;
    apdCompanyId: string;
    apdBranchId: string;
    apdTenantId: string | null;
    apdTraType: string;
    apdPartyId: string;
    apdSalesmanId: string | null;
    apdInstrumentType: string;
    apdInstrumentNo: string;
    apdInstrumentDate: Date;
    apdAmount: Prisma.Decimal;
    apdBankName: string | null;
    apdBankBranch: string | null;
    apdIfsc: string | null;
    apdMicr: string | null;
    apdDrawerName: string | null;
    apdReceivedOn: Date;
    apdBankLedgerId: string | null;
    apdPostingMode: PdcPostingMode;
    apdVoucherId: string | null;
    apdVoucherAccYear: string | null;
    apdTenderId: string | null;
    apdStatus: PdcStatus;
    apdPresentCount: number;
    apdDepositDate: Date | null;
    apdDepositSlipNo: string | null;
    apdClearDate: Date | null;
    apdClearVoucherId: string | null;
    apdClearAccYear: string | null;
    apdBounceDate: Date | null;
    apdBounceReason: string | null;
    apdBounceCharges: Prisma.Decimal;
    apdBounceVoucherId: string | null;
    apdBounceAccYear: string | null;
    apdChargeVoucherId: string | null;
    apdChargeAccYear: string | null;
    apdReplacedById: string | null;
    apdReplacedByAccYear: string | null;
    apdRemarks: string | null;
    apdIsDeleted: boolean;
}
export declare function lockCheques(tx: Prisma.TransactionClient, keys: readonly {
    apdId: string;
    apdAccYear: string;
}[]): Promise<Map<string, LockedCheque>>;
export declare function chequeKey(apdId: string, apdAccYear: string): string;
export declare function lockChequeOrThrow(tx: Prisma.TransactionClient, keys: {
    apdId: string;
    apdAccYear: string;
    apdCompanyId: string;
    apdBranchId: string;
}, field?: string): Promise<LockedCheque>;
export declare function assertStatus(cheque: LockedCheque, allowed: readonly PdcStatus[], action: string, field?: string): void;
export declare function assertDateOnOrAfter(date: Date, earliest: Date, what: string, earliestLabel: string, field: string): void;
export declare function assertNotInFuture(date: Date, what: string, field: string): void;
export declare function formatDate(date: Date): string;
export declare function dueBucketOf(instrumentDate: Date, status: PdcStatus, asOf?: Date): ChequeDueBucket | null;
export interface ChequesInHandLedger {
    ledgerId: string;
    ledgerName: string;
    tenderId: string;
    tenderAccYear: string;
}
export declare function resolveChequesInHand(tx: Prisma.TransactionClient, cheque: LockedCheque, field?: string): Promise<ChequesInHandLedger>;
export interface ChequeBankLedger {
    ledgerId: string;
    ledgerName: string;
}
export declare function loadBankLedger(tx: Prisma.TransactionClient, companyId: string, bankLedgerId: string, field?: string): Promise<ChequeBankLedger>;
