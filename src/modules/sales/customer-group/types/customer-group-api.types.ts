import type { SalesErrorDetail, SalesErrorResponse } from 'src/common/types/module-api.types';
import type { CustomerGroupErrorCode } from './customer-group-error-codes';

/** Notes 119: every refusal names its code — see customer-group-error-codes.ts. */
export interface CustomerGroupErrorDetail extends SalesErrorDetail {
  code: CustomerGroupErrorCode;
}
export type CustomerGroupErrorResponse = SalesErrorResponse<CustomerGroupErrorDetail>;
export type { SalesSuccessResponse as CustomerGroupSuccessResponse } from 'src/common/types/module-api.types';

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
