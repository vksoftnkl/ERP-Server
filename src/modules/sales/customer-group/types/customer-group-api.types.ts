export type { SalesErrorDetail as CustomerGroupErrorDetail } from '../../utils/sales-api.types';
export type { SalesErrorResponse as CustomerGroupErrorResponse } from '../../utils/sales-api.types';
export type { SalesSuccessResponse as CustomerGroupSuccessResponse } from '../../utils/sales-api.types';
export type { SalesListMeta as CustomerGroupListMeta } from '../../utils/sales-list.utils';

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
