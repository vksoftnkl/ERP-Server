export declare class SaveLedgerBankAccountDto {
    lbaId?: string;
    lbaCompanyId?: string | null;
    lbaLedgerId: string;
    lbaAccountHolder: string;
    lbaBankName: string;
    lbaBranchName?: string | null;
    lbaAccountNo: string;
    lbaIfscCode?: string | null;
    lbaMicrCode?: string | null;
    lbaAccountType?: string | null;
    lbaUpiId?: string | null;
    lbaChequeName?: string | null;
    lbaIsDefault?: boolean;
    lbaIsActive?: boolean;
    lbaRemarks?: string | null;
}
