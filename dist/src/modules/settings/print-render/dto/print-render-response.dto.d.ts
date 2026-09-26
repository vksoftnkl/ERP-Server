export declare class PrintRenderErrorDetailDto {
    field: string;
    message: string;
}
export declare class PrintRenderErrorResponseDto {
    success: false;
    message: string;
    errors: PrintRenderErrorDetailDto[];
}
export declare class ResolvedDatasetDto {
    name: string;
    datasetNo: number;
    role: string;
    sourceKind: string;
    rowCount: number;
    durationMs: number;
    truncated: boolean;
}
export declare class RenderWarningDto {
    kind: string;
    message: string;
}
export declare class RenderInspectionDto {
    outputMode: string;
    contentType: string;
    pageCount: number;
    pagesPerCopy: number[];
    copies: number;
    copyLabels: string[];
    templateId: string;
    templateName: string | null;
    versionId: string;
    revNo: number;
    status: string;
    engine: string;
    paperCode: string;
    layoutMs: number;
    renderMs: number;
    detailRows: number;
    byteCount: number;
    datasets: ResolvedDatasetDto[];
    warnings: RenderWarningDto[];
    printLogIds?: string[];
}
export declare class PrintRenderInspectSuccessDto {
    success: true;
    message: string;
    data: RenderInspectionDto;
}
export declare class PrintDataProviderDto {
    code: string;
    label: string;
    cardinality: string;
}
export declare class PrintRenderProvidersSuccessDto {
    success: true;
    message: string;
    data: PrintDataProviderDto[];
}
