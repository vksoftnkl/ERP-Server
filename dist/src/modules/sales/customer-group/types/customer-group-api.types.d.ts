import type { SalesErrorDetail, SalesErrorResponse } from "../../../../common/types/module-api.types";
import type { CustomerGroupErrorCode } from './customer-group-error-codes';
export interface CustomerGroupErrorDetail extends SalesErrorDetail {
    code: CustomerGroupErrorCode;
}
export type CustomerGroupErrorResponse = SalesErrorResponse<CustomerGroupErrorDetail>;
export type { SalesSuccessResponse as CustomerGroupSuccessResponse } from "../../../../common/types/module-api.types";
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
