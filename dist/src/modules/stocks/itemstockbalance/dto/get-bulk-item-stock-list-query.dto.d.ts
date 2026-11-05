export declare class GetBulkItemStockListQueryDto {
    isb_acc_year: string;
    isb_company_id: string;
    isb_branch_id: string;
    isb_godown_id?: string;
    item_group_id?: string;
    item_brand_id?: string;
    item_section_id?: string;
    item_category_id?: string;
    stock_type?: 'ALL' | 'NEGATIVE' | 'ZERO';
    isb_stock_bucket?: string;
    limit?: string;
}
