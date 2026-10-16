export type { FixedErrorDetail as BankListErrorDetail } from "../../../../common/types/module-api.types";
export type { FixedErrorResponse as BankListErrorResponse } from "../../../../common/types/module-api.types";
export type { FixedSuccessResponse as BankListSuccessResponse } from "../../../../common/types/module-api.types";
export type { FixedListMeta as BankListMeta } from "../../../../common/types/module-list.types";
export interface BankListPayload {
    bnkId: string;
    bnkName: string;
    bnkShortName: string | null;
    bnkAlias: string | null;
    bnkRbiCode: string | null;
    bnkIbanSupported: boolean;
    bnkIsActive: boolean;
    bnkIsDeleted: boolean;
    bnkSyncDate: string | null;
    bnkCreatedOn: string;
    bnkCreatedBy: string | null;
    bnkModifiedOn: string;
    bnkModifiedBy: string | null;
}
export type BankListItem = BankListPayload | Record<string, unknown>;
