export type { AccountsErrorDetail as TenderTypeMasterErrorDetail } from "../../../../common/types/module-api.types";
export type { AccountsErrorResponse as TenderTypeMasterErrorResponse } from "../../../../common/types/module-api.types";
export type { AccountsSuccessResponse as TenderTypeMasterSuccessResponse } from "../../../../common/types/module-api.types";
export interface TenderTypeMasterPayload {
    ttmTypeId: string;
    ttmTypeName: string;
    ttmDisplayName: string;
    ttmIsActive: boolean;
    ttmIsDeleted: boolean;
    ttmSyncDate: string | null;
    ttmCreatedOn: string;
    ttmCreatedBy: string | null;
    ttmModifiedOn: string | null;
    ttmModifiedBy: string | null;
}
