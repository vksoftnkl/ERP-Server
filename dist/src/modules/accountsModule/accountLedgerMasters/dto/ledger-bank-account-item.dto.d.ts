import { BankAccountType } from '../types/account-ledger-master-enum';
export declare class LedgerBankAccountItemDto {
    lbaId?: string;
    lbaLedgerId?: string;
    lbaAccountHolder: string;
    lbaBankName: string;
    lbaBranchName?: string | null;
    lbaAccountNo: string;
    lbaIfscCode?: string | null;
    lbaMicrCode?: string | null;
    lbaAccountType?: BankAccountType | null;
    lbaUpiId?: string | null;
    lbaChequeName?: string | null;
    lbaIsDefault?: boolean;
    lbaIsActive?: boolean;
    lbaRemarks?: string | null;
}
