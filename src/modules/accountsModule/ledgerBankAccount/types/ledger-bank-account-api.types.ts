export interface LedgerBankAccountErrorDetail {
  field: string;
  message: string;
}

export interface LedgerBankAccountErrorResponse {
  success: false;
  message: string;
  errors: LedgerBankAccountErrorDetail[];
}

export interface LedgerBankAccountSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface LedgerBankAccountPayload {
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

export type LedgerBankAccountListItem = LedgerBankAccountPayload | Record<string, unknown>;

export interface LedgerBankAccountListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
