export declare class SaveItemReorderDto {
    ir_id?: string;
    ir_branch_id?: string | null;
    ir_item_id: string;
    ir_unit_id?: string | null;
    ir_godown_id?: string | null;
    ir_sl_no?: number;
    ir_min_level?: number;
    ir_max_level?: number;
    ir_reorder_level?: number;
    ir_reorder_qty?: number;
    ir_lead_time_days?: number;
    ir_review_cycle_days?: number;
    ir_reorder_days?: number;
    ir_expiry_buffer_days?: number;
    ir_reorder_type?: string;
    ir_is_active?: boolean;
    ir_created_by?: string | null;
    ir_modified_by?: string | null;
    ir_remarks?: string | null;
}
