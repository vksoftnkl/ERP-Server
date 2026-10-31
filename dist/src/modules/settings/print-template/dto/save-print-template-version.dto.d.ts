import { SavePrintTemplateDatasetDto } from './save-print-template-dataset.dto';
export declare class SavePrintTemplateVersionDto {
    ptvId?: string;
    ptvRevNo?: number;
    ptvStatus?: string;
    ptvEngine?: string;
    ptvBody?: string;
    ptvSchemaVer?: number;
    ptvPaperCode?: string;
    ptvOrientation?: string;
    ptvWidthMm?: number | null;
    ptvHeightMm?: number | null;
    ptvMarginTopMm?: number;
    ptvMarginBottomMm?: number;
    ptvMarginLeftMm?: number;
    ptvMarginRightMm?: number;
    ptvColumns?: number | null;
    ptvLang?: string;
    ptvFontFamily?: string | null;
    ptvParams?: unknown[] | null;
    ptvNote?: string | null;
    ptvApprovedBy?: string | null;
    ptvIsDeleted?: boolean;
    ptvCreatedBy?: string | null;
    ptvModifiedBy?: string | null;
    datasets?: SavePrintTemplateDatasetDto[];
}
