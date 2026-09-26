export type { PurchaseErrorDetail as SupplierGroupErrorDetail } from 'src/common/types/module-api.types';
export type { PurchaseErrorResponse as SupplierGroupErrorResponse } from 'src/common/types/module-api.types';
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
