export type { SalesErrorDetail as StateErrorDetail } from 'src/common/types/module-api.types';
export type { SalesErrorResponse as StateErrorResponse } from 'src/common/types/module-api.types';
export type { SalesSuccessResponse as StateSuccessResponse } from 'src/common/types/module-api.types';
export interface StatePayload {
  stmId: string;
  stmName: string;
  stmAlias: string | null;
  stmShort: string | null;
  stmOrder: number;
  stmIsActive: boolean;
  stmIsDeleted: boolean;
  stmSyncDate: string | null;
  stmCreatedOn: string;
  stmCreatedBy: string | null;
  stmModifiedOn: string;
  stmModifiedBy: string | null;
}

