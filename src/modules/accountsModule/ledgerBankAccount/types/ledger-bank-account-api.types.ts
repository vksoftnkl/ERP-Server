export type { AccountsErrorDetail as LedgerBankAccountErrorDetail } from 'src/common/types/module-api.types';
export type { AccountsErrorResponse as LedgerBankAccountErrorResponse } from 'src/common/types/module-api.types';
export type { AccountsSuccessResponse as LedgerBankAccountSuccessResponse } from 'src/common/types/module-api.types';
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
