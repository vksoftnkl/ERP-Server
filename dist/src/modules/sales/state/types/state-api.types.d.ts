import type { SalesErrorDetail, SalesErrorResponse } from "../../../../common/types/module-api.types";
import type { StateErrorCode } from './state-error-codes';
export interface StateErrorDetail extends SalesErrorDetail {
    code: StateErrorCode;
}
export type StateErrorResponse = SalesErrorResponse<StateErrorDetail>;
export type { SalesSuccessResponse as StateSuccessResponse } from "../../../../common/types/module-api.types";
export interface StatePayload {
    stmId: string;
    stmName: string;
    stmAlias: string | null;
    stmShort: string | null;
    stmOrder: number;
    stmDescription: string | null;
    stmIsActive: boolean;
    stmIsDeleted: boolean;
    stmSyncDate: string | null;
    stmCreatedOn: string;
    stmCreatedBy: string | null;
    stmModifiedOn: string;
    stmModifiedBy: string | null;
}
export interface StateMasterCreateResult {
    stateMaster: StatePayload;
    accGroupId: string;
}
