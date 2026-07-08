export type { SalesErrorDetail as FreightChargesErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as FreightChargesErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as FreightChargesSuccessResponse } from 'src/common/types/module-api.types';

export interface FreightChargesPayload {
  frId: string;
  frFromKm: number | null;
  frToKm: number | null;
  frFreightChrg: number | null;
  frFromWeight: number | null;
  frToWeight: number | null;
  frLoadChrg: number | null;
  frUnloadChrg: number | null;
  frIsActive: boolean;
  frIsDeleted: boolean;
  frSyncDate: string | null;
  frCreatedOn: string;
  frCreatedBy: string | null;
  frModifiedOn: string;
  frModifiedBy: string | null;
}
