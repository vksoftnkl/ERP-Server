import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemQtyPriceErrorFieldDto };
export { InventoryErrorResponseDto as ItemQtyPriceErrorResponseDto };
export { InventoryListMetaDto as ItemQtyPriceListMetaDto };
export declare class ItemQtyPricePayloadDto {
    iqp_id: string;
    iqp_company_id: string | null;
    iqp_branch_id: string | null;
    iqp_party_id: string | null;
    iqp_price_level: number | null;
    iqp_item_id: string;
    iqp_item_unit_id: string;
    iqp_from_qty: number;
    iqp_to_qty: number | null;
    iqp_price_mode: string;
    iqp_disc_pct: number | null;
    iqp_flat_off: number | null;
    iqp_price: number | null;
    iqp_is_tax_incl: boolean;
    iqp_effective_from: string;
    iqp_effective_to: string | null;
    iqp_is_active: boolean;
    iqp_is_deleted: boolean;
    iqp_sync_date: string | null;
    iqp_created_on: string;
    iqp_created_by: string | null;
    iqp_modified_on: string;
    iqp_modified_by: string | null;
    iqp_item_name: string | null;
    iqp_unit_name: string | null;
    iqp_company_name: string | null;
    iqp_branch_name: string | null;
    iqp_price_level_name: string | null;
    iqp_party_name: string | null;
}
export declare class ItemQtyPriceDeleteResultDto {
    iqp_id: string;
    deleted: boolean;
}
export declare class ItemQtyPriceSuccessSingleDto {
    success: true;
    message: string;
    data: ItemQtyPricePayloadDto;
}
export declare class ItemQtyPriceSuccessSaveDto {
    success: true;
    message: string;
    data: ItemQtyPricePayloadDto[];
}
export declare class ItemQtyPriceSuccessListDto {
    success: true;
    message: string;
    data: ItemQtyPricePayloadDto[];
    meta: InventoryListMetaDto;
}
export declare class ItemQtyPriceSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemQtyPriceDeleteResultDto | ItemQtyPriceDeleteResultDto[];
}
