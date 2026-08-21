export declare class PromotionSchemeSlabRowDto {
    prs_id?: string;
    prs_slno?: number;
    prs_benefit?: string;
    prs_exceeds?: number;
    prs_upto?: number | null;
    prs_each?: number;
    prs_is_repeat?: boolean;
    prs_max_repeats?: number;
    prs_free_item_id?: string | null;
    prs_free_unit_id?: string | null;
    prs_free_qty?: number;
    prs_free_stock_check?: boolean;
    prs_disc_perc?: number;
    prs_disc_qty?: number;
    prs_disc_amt?: number;
    prs_fixed_price?: number | null;
    prs_max_benefit_amt?: number;
    prs_notes?: string | null;
    prs_is_active?: boolean;
    prs_created_by?: string;
    prs_modified_by?: string;
}
export declare class SavePromotionSchemeSlabsDto {
    prm_id: string;
    slabs: PromotionSchemeSlabRowDto[];
}
