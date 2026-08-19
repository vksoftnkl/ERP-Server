export declare class PurchaseErrorFieldDto {
    field: string;
    message: string;
}
export declare class PurchaseErrorResponseDto {
    success: false;
    message: string;
    errors: PurchaseErrorFieldDto[];
}
export declare class PurchaseListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
