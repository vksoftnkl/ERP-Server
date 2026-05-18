export type { PurchaseErrorDetail as SupplierGroupErrorDetail } from '../../utils/purchase-api.types';
export type { PurchaseErrorResponse as SupplierGroupErrorResponse } from '../../utils/purchase-api.types';
export type { PurchaseSuccessResponse as SupplierGroupSuccessResponse } from '../../utils/purchase-api.types';
export type { PurchaseListMeta as SupplierGroupListMeta } from '../../utils/purchase-list.utils';

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
export type SupplierGroupListItem = SupplierGroupPayload | Record<string, unknown>;
