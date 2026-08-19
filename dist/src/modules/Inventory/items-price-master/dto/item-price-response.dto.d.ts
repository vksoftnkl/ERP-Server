import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemPriceErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceErrorResponseDto };
export { InventoryListMetaDto as ItemPriceListMetaDto };
export declare class ItemPricePayloadDto {
    ipm_id: string;
    ipm_company_id: string | null;
    ipm_branch_id: string | null;
    ipm_item_id: string;
    ipm_uc_unit_id: string;
    ipm_godown_id: string | null;
    ipm_sl_no: number;
    ipm_cost_price: number;
    ipm_cost_wot: number;
    ipm_sales_price_a: number;
    ipm_sales_price_b: number;
    ipm_sales_price_c: number;
    ipm_sales_price_d: number;
    ipm_price_a_wot: number;
    ipm_price_b_wot: number;
    ipm_price_c_wot: number;
    ipm_price_d_wot: number;
    ipm_price_a_markup_perc: number;
    ipm_price_b_markup_perc: number;
    ipm_price_c_markup_perc: number;
    ipm_price_d_markup_perc: number;
    ipm_max_price: number;
    ipm_min_price: number;
    ipm_disc_perc: number;
    ipm_disc_qty: number;
    ipm_addl_cess: number;
    ipm_profit_type: string;
    ipm_round_off: number;
    ipm_loading_charge: number;
    ipm_freight_charge: number;
    ipm_loyalty_points: number;
    ipm_uom_remarks: string | null;
    ipm_cost_remarks: string | null;
    ipm_is_active: boolean;
    ipm_is_deleted: boolean;
    ipm_sync_date: string | null;
    ipm_created_on: string;
    ipm_created_by: string | null;
    ipm_updated_on: string | null;
    ipm_updated_by: string | null;
    ipm_company_name?: string | null;
    ipm_branch_name?: string | null;
    ipm_unit_name?: string | null;
    ipm_godown_name?: string | null;
}
export declare class ItemPriceDeleteResultDto {
    ipm_id: string;
    deleted: boolean;
}
export declare class ItemPriceSuccessSingleDto {
    success: true;
    message: string;
    data: ItemPricePayloadDto;
}
export declare class ItemPriceSuccessSaveDto {
    success: true;
    message: string;
    data: ItemPricePayloadDto | ItemPricePayloadDto[];
}
export declare class ItemPriceSuccessListDto {
    success: true;
    message: string;
    data: ItemPricePayloadDto[];
    meta: InventoryListMetaDto;
}
export declare class ItemPriceSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemPriceDeleteResultDto | ItemPriceDeleteResultDto[];
}
