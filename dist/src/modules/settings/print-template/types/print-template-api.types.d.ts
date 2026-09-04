export type { SettingsErrorDetail as PrintTemplateErrorDetail } from "../../../../common/types/module-api.types";
export type { SettingsErrorResponse as PrintTemplateErrorResponse } from "../../../../common/types/module-api.types";
export type { SettingsSuccessResponse as PrintTemplateSuccessResponse } from "../../../../common/types/module-api.types";
export interface PrintTemplateDatasetPayload {
    ptdId: string;
    ptdVersionId: string;
    ptdRole: string;
    ptdDatasetNo: number;
    ptdSortOrder: number;
    ptdName: string;
    ptdLabel: string | null;
    ptdSourceKind: string;
    ptdProviderCode: string | null;
    ptdSql: string | null;
    ptdSqlNorm: string | null;
    ptdRequiresCompany: boolean;
    ptdParentNo: number | null;
    ptdLinkFields: string | null;
    ptdRowLimit: number;
    ptdTimeoutMs: number;
    ptdRemarks: string | null;
    ptdIsDeleted: boolean;
    ptdSyncDate: string | null;
    ptdCreatedOn: string;
    ptdCreatedBy: string | null;
    ptdModifiedOn: string | null;
    ptdModifiedBy: string | null;
}
export interface PrintTemplateVersionPayload {
    ptvId: string;
    ptvTemplateId: string;
    ptvRevNo: number;
    ptvStatus: string;
    ptvEngine: string;
    ptvBody: string;
    ptvSchemaVer: number;
    ptvPaperCode: string;
    ptvOrientation: string;
    ptvWidthMm: number | null;
    ptvHeightMm: number | null;
    ptvMarginTopMm: number;
    ptvMarginBottomMm: number;
    ptvMarginLeftMm: number;
    ptvMarginRightMm: number;
    ptvColumns: number | null;
    ptvLang: string;
    ptvFontFamily: string | null;
    ptvParams: unknown;
    ptvNote: string | null;
    ptvApprovedOn: string | null;
    ptvApprovedBy: string | null;
    ptvIsDeleted: boolean;
    ptvSyncDate: string | null;
    ptvCreatedOn: string;
    ptvCreatedBy: string | null;
    ptvModifiedOn: string | null;
    ptvModifiedBy: string | null;
    ptvIsPublishedRev: boolean;
    ptvIsEditable: boolean;
    datasets: PrintTemplateDatasetPayload[];
}
export interface PrintTemplatePayload {
    ptlId: string;
    ptlCompanyId: string | null;
    ptlCompanyName: string | null;
    ptlPurposeId: string;
    ptlPurposeCode: string | null;
    ptlPurposeName: string | null;
    ptlCode: string;
    ptlName: string;
    ptlDescription: string | null;
    ptlPublishedRevId: string | null;
    ptlPublishedRevNo: number | null;
    ptlForkedFromId: string | null;
    ptlForkedFromCode: string | null;
    ptlForkedFromRev: number | null;
    ptlSortOrder: number;
    ptlCompanyKey: string | null;
    ptlIsActive: boolean;
    ptlIsDeleted: boolean;
    ptlSyncDate: string | null;
    ptlCreatedOn: string;
    ptlCreatedBy: string | null;
    ptlModifiedOn: string | null;
    ptlModifiedBy: string | null;
    versions: PrintTemplateVersionPayload[];
}
export interface PrintTemplateListResult {
    items: PrintTemplatePayload[];
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export interface PrintTemplateDeleteResult {
    deleted: true;
    ptlId: string;
}
