import type { SalesErrorDetail, SalesErrorResponse } from 'src/common/types/module-api.types';
import type { SaleFreightChargeErrorCode } from './sale-freight-charges-error-codes';

/** Notes 119: every refusal names its code — see sale-freight-charges-error-codes.ts. */
export interface SaleFreightChargeErrorDetail extends SalesErrorDetail {
  code: SaleFreightChargeErrorCode;
}
export type SaleFreightChargeErrorResponse = SalesErrorResponse<SaleFreightChargeErrorDetail>;
export type { SalesSuccessResponse as SaleFreightChargeSuccessResponse } from 'src/common/types/module-api.types';
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
