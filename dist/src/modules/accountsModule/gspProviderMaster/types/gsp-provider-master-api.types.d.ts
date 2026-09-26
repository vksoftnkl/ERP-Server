export type { AccountsErrorDetail as GspProviderMasterErrorDetail } from "../../../../common/types/module-api.types";
export type { AccountsErrorResponse as GspProviderMasterErrorResponse } from "../../../../common/types/module-api.types";
export type { AccountsSuccessResponse as GspProviderMasterSuccessResponse } from "../../../../common/types/module-api.types";
export interface GspProviderMasterPayload {
    gspProviderId: string;
    gspProviderCode: string;
    gspProviderName: string;
    gspBaseUrl: string;
    gspRoute: string;
    gspIpAddress: string;
    gspUserName: string;
    gspUserPassword: string;
    gspIsActive: boolean;
    gspIsDeleted: boolean;
    gspCreatedOn: string;
    gspCreatedBy: string | null;
    gspModifiedOn: string;
    gspModifiedBy: string | null;
}
