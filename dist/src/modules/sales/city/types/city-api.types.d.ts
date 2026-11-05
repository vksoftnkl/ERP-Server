import type { SalesErrorDetail, SalesErrorResponse } from "../../../../common/types/module-api.types";
import type { CityErrorCode } from './city-error-codes';
export interface CityErrorDetail extends SalesErrorDetail {
    code: CityErrorCode;
}
export type CityErrorResponse = SalesErrorResponse<CityErrorDetail>;
export type { SalesSuccessResponse as CitySuccessResponse } from "../../../../common/types/module-api.types";
export interface CityPayload {
    ctmId: string;
    ctmName: string;
    ctmAlias: string | null;
    ctmShort: string | null;
    ctmStateId: string;
    ctmStateName?: string | null;
    ctmOrder: number;
    ctmDescription: string | null;
    ctmIsActive: boolean;
    ctmIsDeleted: boolean;
    ctmSyncDate: string | null;
    ctmCreatedOn: string;
    ctmCreatedBy: string | null;
    ctmModifiedOn: string;
    ctmModifiedBy: string | null;
}
export interface CityMasterCreateResult {
    cityMaster: CityPayload;
    accGroupId: string;
}
