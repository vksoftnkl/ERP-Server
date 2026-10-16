import type { SalesErrorDetail, SalesErrorResponse } from "../../../../common/types/module-api.types";
import type { SaleLoadingChargeErrorCode } from './sale-loading-charges-error-codes';
export interface SaleLoadingChargeErrorDetail extends SalesErrorDetail {
    code: SaleLoadingChargeErrorCode;
}
export type SaleLoadingChargeErrorResponse = SalesErrorResponse<SaleLoadingChargeErrorDetail>;
export type { SalesSuccessResponse as SaleLoadingChargeSuccessResponse } from "../../../../common/types/module-api.types";
export interface SaleLoadingChargePayload {
    ilcId: string;
    ilcCompId: string | null;
    ilcCompanyName: string | null;
    ilcBranchId: string | null;
    ilcBranchName: string | null;
    ilcFromWeight: number | null;
    ilcToWeight: number | null;
    ilcLoadChrg: number | null;
    ilcUnloadChrg: number | null;
    ilcIsActive: boolean;
    ilcIsDeleted: boolean;
    ilcSyncDate: string | null;
    ilcCreatedOn: string;
    ilcCreatedBy: string | null;
    ilcModifiedOn: string;
    ilcModifiedBy: string | null;
}
