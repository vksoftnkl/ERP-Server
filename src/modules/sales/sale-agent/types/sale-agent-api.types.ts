import type { SalesErrorDetail, SalesErrorResponse } from 'src/common/types/module-api.types';
import type { SaleAgentErrorCode } from './sale-agent-error-codes';

/** Notes 119: every refusal names its code — see sale-agent-error-codes.ts. */
export interface SaleAgentErrorDetail extends SalesErrorDetail {
  code: SaleAgentErrorCode;
}
export type SaleAgentErrorResponse = SalesErrorResponse<SaleAgentErrorDetail>;
export type { SalesSuccessResponse as SaleAgentSuccessResponse } from 'src/common/types/module-api.types';
export interface SaleAgentPayload {
  saId: string;
  saCompanyId: string;
  saCompanyName: string | null;
  saBranchId: string | null;
  saBranchName: string | null;
  saGroupId: string;
  saGroupName: string | null;
  saCode: string | null;
  saName: string;
  saAlias: string | null;
  saMobile1: string | null;
  saMobile2: string | null;
  saAddr1: string | null;
  saAddr2: string | null;
  saCity: string | null;
  saDistrict: string | null;
  saState: string | null;
  saPincode: string | null;
  saPanNo: string | null;
  saGstin: string | null;
  saRemarks: string | null;
  saIsActive: boolean;
  saIsDeleted: boolean;
  saSyncDate: string | null;
  saCreatedOn: string;
  saCreatedBy: string | null;
  saModifiedOn: string;
  saModifiedBy: string | null;
}
