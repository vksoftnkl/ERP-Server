export declare class BatchPrefixErrorFieldDto {
    field: string;
    message: string;
}
export declare class BatchPrefixErrorResponseDto {
    success: false;
    message: string;
    errors: BatchPrefixErrorFieldDto[];
}
export declare class BatchPrefixPayloadDto {
    id: string;
    prefixUsed: string | null;
    syncDate: string | null;
    createdBy: string | null;
    createdOn: string | null;
    modifiedBy: string | null;
    modifiedOn: string | null;
}
export declare class BatchPrefixListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class BatchPrefixDeleteResultDto {
    id: string;
    deleted: true;
}
export declare class BatchPrefixSuccessSingleDto {
    success: true;
    message: string;
    data: BatchPrefixPayloadDto;
}
export declare class BatchPrefixSuccessListDto {
    success: true;
    message: string;
    data: BatchPrefixPayloadDto[];
    meta: BatchPrefixListMetaDto;
}
export declare class BatchPrefixSuccessDeleteDto {
    success: true;
    message: string;
    data: BatchPrefixDeleteResultDto;
}
