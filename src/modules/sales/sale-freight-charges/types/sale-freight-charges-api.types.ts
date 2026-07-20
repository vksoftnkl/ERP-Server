export type { SalesErrorDetail as SaleFreightChargeErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as SaleFreightChargeErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as SaleFreightChargeSuccessResponse } from 'src/common/types/module-api.types';

export interface SaleFreightChargePayload {
  frId: string;
  frCompanyId: string | null;
  frBranchId: string | null;
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
