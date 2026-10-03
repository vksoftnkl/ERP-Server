import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemTaxHistoryErrorFieldDto };
export { InventoryErrorResponseDto as ItemTaxHistoryErrorResponseDto };
export declare class ItemTaxHistoryPayloadDto {
    ith_id: string;
    ith_item_id: string;
    ith_tax_id: string;
    ith_effective_from: string;
    ith_effective_to: string | null;
    ith_reason: string | null;
    ith_created_on: string;
    ith_created_by: string | null;
}
export declare class ItemTaxHistoryDeleteResultDto {
    ith_id: string;
    deleted: true;
}
export declare class ItemTaxHistorySuccessSingleDto {
    success: true;
    message: string;
    data: ItemTaxHistoryPayloadDto;
}
export declare class ItemTaxHistorySuccessDeleteDto {
    success: true;
    message: string;
    data: ItemTaxHistoryDeleteResultDto;
}
