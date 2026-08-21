export declare class PromotionSchemeItemRowDto {
    pri_id?: string;
    pri_slno?: number;
    pri_kind?: string;
    pri_scope_id?: string;
    pri_unit_id?: string | null;
    pri_is_exclude?: boolean;
    pri_disc_perc?: number;
    pri_disc_qty?: number;
    pri_disc_amt?: number;
    pri_min_qty?: number;
    pri_factor?: number;
    pri_max_benefit?: number;
    pri_match_priority?: number;
    pri_notes?: string | null;
    pri_is_active?: boolean;
    pri_created_by?: string;
    pri_modified_by?: string;
}
export declare class SavePromotionSchemeItemsDto {
    prm_id: string;
    items: PromotionSchemeItemRowDto[];
}
