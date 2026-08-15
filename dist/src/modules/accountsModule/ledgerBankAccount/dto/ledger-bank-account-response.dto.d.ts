export declare class LedgerBankAccountErrorFieldDto {
    field: string;
    message: string;
}
export declare class LedgerBankAccountErrorResponseDto {
    success: false;
    message: string;
    errors: LedgerBankAccountErrorFieldDto[];
}
export declare class LedgerBankAccountPayloadDto {
    lbaId: string;
    lbaCompanyId: string | null;
    lbaLedgerId: string;
    lbaAccountHolder: string;
    lbaBankName: string;
    lbaBranchName: string | null;
    lbaAccountNo: string;
    lbaIfscCode: string | null;
    lbaMicrCode: string | null;
    lbaAccountType: string | null;
    lbaUpiId: string | null;
    lbaChequeName: string | null;
    lbaIsDefault: boolean;
    lbaIsActive: boolean;
    lbaIsDeleted: boolean;
    lbaSyncDate: string | null;
    lbaCreatedOn: string;
    lbaCreatedBy: string | null;
    lbaModifiedOn: string;
    lbaModifiedBy: string | null;
    lbaRemarks: string | null;
}
export declare class LedgerBankAccountDeleteResultDto {
    lbaId: string;
    deleted: true;
}
export declare class LedgerBankAccountSuccessSingleDto {
    success: true;
    message: string;
    data: LedgerBankAccountPayloadDto;
}
export declare class LedgerBankAccountSuccessDeleteDto {
    success: true;
    message: string;
    data: LedgerBankAccountDeleteResultDto;
}
