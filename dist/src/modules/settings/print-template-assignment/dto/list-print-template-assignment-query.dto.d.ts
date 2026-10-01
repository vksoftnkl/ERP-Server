import { ModuleListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class ListPrintTemplateAssignmentQueryDto extends ModuleListQueryBaseDto {
    ptaCompanyId?: string;
    includeGlobal?: boolean;
    globalOnly?: boolean;
    ptaBranchId?: string;
    ptaDeviceId?: string;
    ptaPurposeId?: string;
    ptaTemplateId?: string;
    ptaOutputMode?: string;
    ptaIsActive?: boolean;
}
