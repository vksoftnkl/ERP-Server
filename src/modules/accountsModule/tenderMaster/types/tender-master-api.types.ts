export type { AccountsErrorDetail as TenderMasterErrorDetail } from 'src/common/utils/module-api.types';
export type { AccountsErrorResponse as TenderMasterErrorResponse } from 'src/common/utils/module-api.types';
export type { AccountsSuccessResponse as TenderMasterSuccessResponse } from 'src/common/utils/module-api.types';
export type { AccountsListMeta as TenderMasterListMeta } from 'src/common/utils/module-list.utils';
export interface TenderMasterPayload {
  tndId: string;
  tndTypeId: string;
  tndName: string;
  tndLedgerId: string;
  tndMinAmount: number;
  tndMaxAmount: number | null;
  tndDisplayPosition: number;
  tndSurchargePerc: number;
  tndIsActive: boolean;
  tndIsDeleted: boolean;
  tndRemarks: string | null;
  tndEditSurcharge: boolean;
  tndEditLedger: boolean;
  tndSyncDate: string | null;
  tndCreatedOn: string;
  tndCreatedBy: string | null;
  tndModifiedOn: string;
  tndModifiedBy: string | null;
}
export type TenderMasterListItem = TenderMasterPayload | Record<string, unknown>;