import { type AccountsWriteClient } from "../../../common/utils/module-service.utils";
import { accYearOf, assertAccYearWritable, assertVoucherPartitionExists, lockBills, type LockedBill } from '../receipt/receipt.guards';
export type PaymentWriteClient = AccountsWriteClient;
export { accYearOf, assertAccYearWritable, assertVoucherPartitionExists, lockBills };
export type { LockedBill };
export interface PaymentParty {
    ledId: string;
    ledName: string;
    ledIsBillByBill: boolean;
    ledIsTdsApplicable: boolean;
    ledTdsSection: string | null;
    ledTdsDeducteeType: string | null;
    ledPanNo: string | null;
    groupName: string | null;
    isMoneyLedger: boolean;
}
export declare function loadPayee(client: PaymentWriteClient, companyId: string, partyId: string, field?: string, options?: {
    allowMoneyLedger?: boolean;
}): Promise<PaymentParty>;
export interface PaymentVoucherType {
    vchrTypeId: number;
    vchrTypeCode: string;
    vchrTypeName: string;
}
export declare function loadPaymentVoucherType(client: PaymentWriteClient): Promise<PaymentVoucherType>;
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
export declare function assertPayableUsable(bill: LockedBill | undefined, expect: {
    billId: string;
    partyId: string;
    companyId: string;
    kind: 'PAYABLE' | 'DEBIT';
    field: string;
}): LockedBill;
