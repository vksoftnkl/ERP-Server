export interface BankListErrorDetail {
  field: string;
  message: string;
}

export interface BankListErrorResponse {
  success: false;
  message: string;
  errors: BankListErrorDetail[];
}

export interface BankListSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface BankListPayload {
  bnkId: string;
  bnkName: string;
  bnkShortName: string | null;
  bnkAlias: string | null;
  bnkRbiCode: string | null;
  bnkIbanSupported: boolean;
  bnkIsActive: boolean;
  bnkIsDeleted: boolean;
  bnkSyncDate: string | null;
  bnkCreatedOn: string;
  bnkCreatedBy: string | null;
  bnkModifiedOn: string;
  bnkModifiedBy: string | null;
}

export type BankListItem = BankListPayload | Record<string, unknown>;

export interface BankListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
