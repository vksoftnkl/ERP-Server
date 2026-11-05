export declare class StockAdjReasonsErrorFieldDto {
    field: string;
    message: string;
}
export declare class StockAdjReasonsErrorResponseDto {
    success: false;
    message: string;
    errors: StockAdjReasonsErrorFieldDto[];
}
export declare class StockAdjReasonsPayloadDto {
    sarId: string;
    sarCode: string;
    sarName: string;
    sarReasonKind: string;
    sarDefaultResolution: string;
    sarAffectsAccounts: boolean;
    sarIsActive: boolean;
    sarIsDeleted: boolean;
    sarCreatedOn: string;
    sarCreatedBy: string | null;
    sarModifiedOn: string | null;
    sarModifiedBy: string | null;
}
export declare class StockAdjReasonsGetMetaDto {
    sarId?: string;
    sarCode?: string;
    sarReasonKind?: string;
    activeOnly: boolean;
    includeDeleted: boolean;
    count: number;
}
export declare class StockAdjReasonsSuccessGetDto {
    success: true;
    message: string;
    data: StockAdjReasonsPayloadDto[];
    meta: StockAdjReasonsGetMetaDto;
}
