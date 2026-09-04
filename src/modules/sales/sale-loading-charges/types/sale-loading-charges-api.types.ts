export type { SalesErrorDetail as SaleLoadingChargeErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as SaleLoadingChargeErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as SaleLoadingChargeSuccessResponse } from 'src/common/types/module-api.types';
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