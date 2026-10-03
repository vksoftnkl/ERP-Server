import { FixedListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class ListUserLoginSessionsQueryDto extends FixedListQueryBaseDto {
    ulsCompanyId?: string;
    ulsBranchId?: string;
    ulsUserId?: string;
    ulsDeviceId?: string;
    ulsLoginStatus?: string;
    ulsIsActiveSession?: boolean;
    ulsIsActive?: boolean;
}
