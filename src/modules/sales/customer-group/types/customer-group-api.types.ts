export interface CustomerGroupErrorDetail {
  field: string;
  message: string;
}

export interface CustomerGroupErrorResponse {
  success: false;
  message: string;
  errors: CustomerGroupErrorDetail[];
}

export interface CustomerGroupSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface CustomerGroupPayload {
  cgrId: string;
  cgrCompanyId: string | null;
  cgrBranchId: string | null;
  cgrName: string;
  cgrAlias: string | null;
  cgrShort: string | null;
  cgrNarration: string | null;
  cgrOrder: number;
  cgrDiscPerc: number;
  cgrCollectionDays: number[];
  cgrDebitAllowed: boolean;
  cgrDebitDays: number;
  cgrDebitLimit: number;
  cgrBillsLimit: number;
  cgrOverdueBilling: boolean;
  cgrIsActive: boolean;
  cgrIsDeleted: boolean;
  cgrCreatedOn: string;
  cgrModifiedOn: string;
}

export type CustomerGroupListItem = CustomerGroupPayload | Record<string, unknown>;

export interface CustomerGroupListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
