import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as ItemReorderErrorFieldDto };
export { InventoryErrorResponseDto as ItemReorderErrorResponseDto };
export { InventoryListMetaDto as ItemReorderListMetaDto };
export declare class ItemReorderPayloadDto {
    ir_id: string;
    ir_branch_id: string | null;
    ir_item_id: string;
    ir_unit_id: string | null;
    ir_godown_id: string | null;
    ir_sl_no: number;
    ir_min_level: number;
    ir_max_level: number;
    ir_reorder_level: number;
    ir_reorder_qty: number;
    ir_lead_time_days: number;
    ir_review_cycle_days: number;
    ir_reorder_days: number;
    ir_expiry_buffer_days: number;
    ir_reorder_type: string;
    ir_is_active: boolean;
    ir_is_deleted: boolean;
    ir_remarks: string | null;
    ir_created_on: string;
    ir_created_by: string | null;
    ir_modified_on: string;
    ir_modified_by: string | null;
    ir_branch_name?: string | null;
    ir_unit_name?: string | null;
    ir_godown_name?: string | null;
}
export declare class ItemReorderDeleteResultDto {
    ir_id: string;
    deleted: boolean;
}
export declare class ItemReorderSuccessSingleDto {
    success: true;
    message: string;
    data: ItemReorderPayloadDto;
}
export declare class ItemReorderSuccessSaveDto {
    success: true;
    message: string;
    data: ItemReorderPayloadDto | ItemReorderPayloadDto[];
}
export declare class ItemReorderSuccessListDto {
    success: true;
    message: string;
    data: ItemReorderPayloadDto[];
    meta: InventoryListMetaDto;
}
export declare class ItemReorderSuccessDeleteDto {
    success: true;
    message: string;
    data: ItemReorderDeleteResultDto | ItemReorderDeleteResultDto[];
}
