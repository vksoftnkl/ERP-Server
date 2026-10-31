export declare class BatchDetailModelsQueryDto {
    companyId: string;
    itemId: string;
    q?: string;
}
export declare class UpdateBatchDetailDto {
    companyId: string;
    batchNo: string;
    sizeId?: string | null;
    colourId?: string | null;
    model?: string | null;
    reason: string;
}
