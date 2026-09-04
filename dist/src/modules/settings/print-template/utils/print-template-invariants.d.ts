import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
export interface EffectiveTemplate {
    ptlId: string | null;
    ptlCode: string;
    ptlSortOrder: number;
    ptlForkedFromId: string | null;
    ptlForkedFromRev: number | null;
}
export declare function collectTemplateInvariantErrors(template: EffectiveTemplate): ModuleErrorDetail[];
export interface EffectiveVersion {
    ptvRevNo: number;
    ptvStatus: string;
    ptvEngine: string;
    ptvBody: string;
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
    ptvParams: unknown;
    ptvApprovedBy: string | null;
}
export declare function collectVersionInvariantErrors(version: EffectiveVersion, path?: string): ModuleErrorDetail[];
export interface EffectiveDataset {
    ptdRole: string;
    ptdDatasetNo: number;
    ptdName: string;
    ptdSourceKind: string;
    ptdProviderCode: string | null;
    ptdSql: string | null;
    ptdRequiresCompany: boolean;
    ptdParentNo: number | null;
    ptdLinkFields: string | null;
    ptdRowLimit: number;
    ptdTimeoutMs: number;
}
export declare function collectDatasetInvariantErrors(dataset: EffectiveDataset, path?: string): ModuleErrorDetail[];
export declare function collectDatasetSetInvariantErrors(datasets: Array<{
    dataset: EffectiveDataset;
    path: string;
}>): ModuleErrorDetail[];
