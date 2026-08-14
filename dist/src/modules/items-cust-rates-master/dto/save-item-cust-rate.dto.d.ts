export declare class SaveItemCustRateDto {
    csr_id?: string;
    csr_branch_id?: string | null;
    csr_customer_id: string;
    csr_unit_rate_id: string;
    csr_rate_type?: string;
    csr_item_rate?: number;
    csr_disc_perc?: number;
    csr_disc_qty?: number;
    csr_price_level?: string | null;
    csr_valid_from?: string | null;
    csr_valid_to?: string | null;
    csr_priority?: number;
    csr_is_active?: boolean;
    csr_created_by?: string | null;
    csr_modified_by?: string | null;
    csr_uploaded_at?: string | null;
    csr_uploaded_by?: string | null;
    csr_remarks?: string | null;
}
