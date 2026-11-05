import { SavePrintTemplateVersionDto } from './save-print-template-version.dto';
export declare class SavePrintTemplateDto {
    ptlId?: string;
    ptlCompanyId?: string | null;
    ptlPurposeId?: string;
    ptlCode?: string;
    ptlName?: string;
    ptlDescription?: string | null;
    ptlPublishedRevId?: string | null;
    ptlForkedFromId?: string | null;
    ptlForkedFromRev?: number | null;
    ptlSortOrder?: number;
    ptlIsActive?: boolean;
    ptlCreatedBy?: string | null;
    ptlModifiedBy?: string | null;
    versions?: SavePrintTemplateVersionDto[];
}
