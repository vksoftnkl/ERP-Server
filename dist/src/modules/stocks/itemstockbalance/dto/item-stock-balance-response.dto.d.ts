export declare class ItemStockBalanceErrorFieldDto {
    field: string;
    message: string;
}
export declare class ItemStockBalanceErrorResponseDto {
    success: false;
    message: string;
    errors: ItemStockBalanceErrorFieldDto[];
}
export declare class ItemStockBalancePayloadDto {
    isb_id: string;
    isb_acc_year: string;
    isb_company_id: string;
    isb_branch_id: string;
    isb_godown_id: string;
    isb_item_id: string;
    isb_unit_id: string;
    isb_tracking_type: string;
    isb_stock_bucket: string;
    isb_opening_qty: number;
    isb_in_qty: number;
    isb_out_qty: number;
    isb_closing_qty: number;
    isb_opening_free_qty: number;
    isb_free_in_qty: number;
    isb_free_out_qty: number;
    isb_free_closing_qty: number;
    isb_reserved_qty: number;
    isb_transit_qty: number;
    isb_available_qty: number;
    book_qty: number;
    book_base_qty: number;
    isb_opening_avg_rate: number;
    isb_avg_stock_rate: number;
    isb_opening_value: number;
    isb_stock_value: number;
    isb_opening_avg_rate_wot: number;
    isb_avg_stock_rate_wot: number;
    isb_opening_value_wot: number;
    isb_stock_value_wot: number;
    isb_last_in_date: string | null;
    isb_last_out_date: string | null;
    isb_sync_date: string | null;
    isb_created_on: string;
    isb_created_by: string | null;
    isb_updated_on: string | null;
    isb_updated_by: string | null;
}
export declare class ItemStockBalanceSuccessListDto {
    success: true;
    message: string;
    data: ItemStockBalancePayloadDto[];
}
export declare class ItemBatchStockOptionPayloadDto {
    ibs_id: string;
    ibs_acc_year: string;
    ibs_company_id: string;
    ibs_branch_id: string;
    ibs_godown_id: string;
    ibs_item_id: string;
    ibs_unit_id: string;
    ibs_batch_id: string;
    ibs_batch_no: string | null;
    ibs_mfg_batch_no: string | null;
    ibs_batch_date: string | null;
    ibs_mfg_date: string | null;
    ibs_expiry_date: string | null;
    ibs_mrp: number;
    ibs_barcode: string | null;
    ibs_serial_no: string | null;
    ibs_stock_bucket: string;
    ibs_closing_qty: number;
    ibs_free_closing_qty: number;
    book_qty: number;
    book_base_qty: number;
    book_free_qty: number;
    book_free_base_qty: number;
    ibs_avg_stock_rate: number;
    ibs_avg_stock_rate_wot: number;
}
export declare class ItemBatchStockOptionSuccessListDto {
    success: true;
    message: string;
    data: ItemBatchStockOptionPayloadDto[];
}
