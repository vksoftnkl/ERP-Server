import { ModuleListQueryBaseDto } from "../../../../common/utils/module-list-query.base.dto";
export declare class ListPrintTemplateQueryDto extends ModuleListQueryBaseDto {
    ptlCompanyId?: string;
    onlyOwned?: boolean;
    ptlPurposeId?: string;
    engine?: string;
    isPublished?: boolean;
    ptlIsActive?: boolean;
    includeVersions?: boolean;
}
