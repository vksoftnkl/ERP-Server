import { Prisma } from '@prisma/client';
import { type AccountsWriteClient } from "../../../common/utils/module-service.utils";
export type ReceiptWriteClient = AccountsWriteClient;
export declare function assertAccYearWritable(client: ReceiptWriteClient, companyId: string, accYear: string, field: string): Promise<void>;
export declare function accYearOf(date: Date): string;
export declare function assertVoucherPartitionExists(tx: Prisma.TransactionClient, accYear: string, field: string): Promise<void>;
export interface ReceiptParty {
    ledId: string;
    ledName: string;
    ledIsBillByBill: boolean;
    ledIsTdsApplicable: boolean;
    ledTdsDeducteeType: string | null;
    ledIsTcsApplicable: boolean;
    ledTanNo: string | null;
    groupName: string | null;
    groupNature: string | null;
}
export declare function loadParty(client: ReceiptWriteClient, companyId: string, partyId: string, field?: string): Promise<ReceiptParty>;
export interface ReceiptVoucherType {
    vchrTypeId: number;
    vchrTypeCode: string;
    vchrTypeName: string;
}
export declare function loadReceiptVoucherType(client: ReceiptWriteClient): Promise<ReceiptVoucherType>;
export declare function assertHeaderScope(header: {
    avhVoucherId: string;
    avhCompanyId: string;
    avhBranchId: string;
    avhAccYear: string;
}, keys: {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherId: string;
}): void;
export interface LockedBill {
    ablId: string;
    ablAccYear: string;
    ablPartyId: string;
    ablBillType: string;
    ablDocRefno: string;
    ablDocDate: Date;
    ablDueDate: Date | null;
    ablBillAmount: Prisma.Decimal;
    ablPendingAmount: Prisma.Decimal;
    ablDrCr: string;
    ablIsDeleted: boolean;
    ablCompanyId: string;
    ablBranchId: string;
}
export declare function lockBills(tx: Prisma.TransactionClient, bills: readonly {
    billId: string;
    billAccYear: string;
}[]): Promise<Map<string, LockedBill>>;
export declare function assertBillUsable(bill: LockedBill | undefined, expect: {
    billId: string;
    partyId: string;
    companyId: string;
    kind: 'RECEIVABLE' | 'CREDIT';
    field: string;
}): LockedBill;
