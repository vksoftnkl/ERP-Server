import type { SalesErrorDetail, SalesErrorResponse } from "../../../../common/types/module-api.types";
import type { AreaErrorCode } from './area-error-codes';
export interface AreaErrorDetail extends SalesErrorDetail {
    code: AreaErrorCode;
}
export type AreaErrorResponse = SalesErrorResponse<AreaErrorDetail>;
export type { SalesSuccessResponse as AreaSuccessResponse } from "../../../../common/types/module-api.types";
export interface AreaPayload {
    armId: string;
    armName: string;
    armAlias: string | null;
    armShort: string | null;
    armCityId: string;
    armCityName?: string | null;
    armSort: number;
    armDistanceKm: number | null;
    armCollectionDays: number[];
    armDescription: string | null;
    armIsActive: boolean;
    armIsDeleted: boolean;
    armSyncDate: string | null;
    armCreatedOn: string;
    armCreatedBy: string | null;
    armModifiedOn: string;
    armModifiedBy: string | null;
}
export interface AreaMasterCreateResult {
    areaMaster: AreaPayload;
    accGroupId: string;
}
