export declare class InventoryErrorFieldDto {
    field: string;
    message: string;
}
export declare class InventoryErrorResponseDto {
    success: false;
    message: string;
    errors: InventoryErrorFieldDto[];
}
