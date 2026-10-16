import type { PurchaseErrorDetail, PurchaseErrorResponse } from 'src/common/types/module-api.types';
import type { SupplierGroupErrorCode } from './supplier-group-error-codes';

/** Notes 119: every refusal names its code — see supplier-group-error-codes.ts. */
export interface SupplierGroupErrorDetail extends PurchaseErrorDetail {
  code: SupplierGroupErrorCode;
}
export type SupplierGroupErrorResponse = PurchaseErrorResponse<SupplierGroupErrorDetail>;
export type { PurchaseSuccessResponse as SupplierGroupSuccessResponse } from 'src/common/types/module-api.types';
export interface SupplierGroupPayload {
  spgId: string;
  spgName: string;
  spgAlias: string | null;
  spgShort: string | null;
  spgDesc: string | null;
  spgIsActive: boolean;
  spgIsDeleted: boolean;
  spgSyncDate: string | null;
  spgCreatedOn: string;
  spgCreatedBy: string | null;
  spgModifiedOn: string;
  spgModifiedBy: string | null;
}
