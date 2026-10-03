export declare class SaveItemQtyPriceDto {
    iqp_id?: string;
    iqp_company_id?: string | null;
    iqp_branch_id?: string | null;
    iqp_party_id?: string | null;
    iqp_price_level?: number | null;
    iqp_item_id: string;
    iqp_item_unit_id: string;
    iqp_from_qty?: number;
    iqp_to_qty?: number | null;
    iqp_price_mode?: string;
    iqp_disc_pct?: number | null;
    iqp_flat_off?: number | null;
    iqp_price?: number | null;
    iqp_is_tax_incl?: boolean;
    iqp_effective_from: string;
    iqp_effective_to?: string | null;
    iqp_is_active?: boolean;
    iqp_sync_date?: string | null;
    iqp_created_by?: string | null;
    iqp_modified_by?: string | null;
}
