export declare class ModuleErrorFieldDto {
    field: string;
    message: string;
}
export declare class ModuleErrorResponseDto {
    success: false;
    message: string;
    errors: ModuleErrorFieldDto[];
}
export declare class ModuleListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export { ModuleErrorFieldDto as AccountsErrorFieldDto, ModuleErrorFieldDto as FixedErrorFieldDto, ModuleErrorFieldDto as InventoryErrorFieldDto, ModuleErrorFieldDto as PurchaseErrorFieldDto, ModuleErrorFieldDto as SalesErrorFieldDto, ModuleErrorResponseDto as AccountsErrorResponseDto, ModuleErrorResponseDto as FixedErrorResponseDto, ModuleErrorResponseDto as InventoryErrorResponseDto, ModuleErrorResponseDto as PurchaseErrorResponseDto, ModuleErrorResponseDto as SalesErrorResponseDto, ModuleListMetaDto as AccountsListMetaDto, ModuleListMetaDto as FixedListMetaDto, ModuleListMetaDto as InventoryListMetaDto, ModuleListMetaDto as PurchaseListMetaDto, ModuleListMetaDto as SalesListMetaDto, };
