export type { SalesErrorDetail as SaleFreightChargeErrorDetail } from "../../../../common/types/module-api.types";
export type { SalesErrorResponse as SaleFreightChargeErrorResponse } from "../../../../common/types/module-api.types";
export type { SalesSuccessResponse as SaleFreightChargeSuccessResponse } from "../../../../common/types/module-api.types";
export interface SaleFreightChargePayload {
    frId: string;
    frCompanyId: string | null;
    frCompanyName: string | null;
    frBranchId: string | null;
    frBranchName: string | null;
    frFromKm: number | null;
    frToKm: number | null;
    frFromWeight: number | null;
    frToWeight: number | null;
    frFreightChrg: number | null;
    frIsActive: boolean;
    frIsDeleted: boolean;
    frSyncDate: string | null;
    frCreatedOn: string;
    frCreatedBy: string | null;
    frModifiedOn: string;
    frModifiedBy: string | null;
}
