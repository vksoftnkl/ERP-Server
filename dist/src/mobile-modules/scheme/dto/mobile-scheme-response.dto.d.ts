export declare class MobileSchemeBranchDto {
    prb_id: string;
    prb_branch_id: string;
    prb_branch_name: string | null;
    prb_is_exclude: boolean;
}
export declare class MobileSchemePartyDto {
    prp_id: string;
    prp_kind: string;
    prp_scope_id: string;
    prp_scope_name: string | null;
    prp_is_exclude: boolean;
    prp_match_priority: number;
}
export declare class MobileSchemeItemDto {
    pri_id: string;
    pri_kind: string;
    pri_scope_id: string;
    pri_scope_name: string | null;
    pri_unit_id: string | null;
    pri_unit_name: string | null;
    pri_is_exclude: boolean;
    pri_disc_perc: string;
    pri_disc_qty: string;
    pri_disc_amt: string;
    pri_min_qty: string;
    pri_factor: string;
    pri_max_benefit: string;
    pri_match_priority: number;
}
export declare class MobileSchemeSlabDto {
    prs_id: string;
    prs_slno: number;
    prs_benefit: string;
    prs_exceeds: string;
    prs_upto: string | null;
    prs_each: string;
    prs_is_repeat: boolean;
    prs_max_repeats: number;
    prs_free_item_id: string | null;
    prs_free_item_name: string | null;
    prs_free_unit_id: string | null;
    prs_free_unit_name: string | null;
    prs_free_unit_factor: string | null;
    prs_free_qty: string;
    prs_free_stock_check: boolean;
    prs_disc_perc: string;
    prs_disc_qty: string;
    prs_disc_amt: string;
    prs_fixed_price: string | null;
    prs_max_benefit_amt: string;
}
export declare class MobileSchemeDto {
    prm_id: string;
    prm_comp_id: string;
    prm_branch_id: string | null;
    prm_code: string;
    prm_name: string;
    prm_status: string;
    prm_apply_on: string;
    prm_benefit: string;
    prm_priority: number;
    prm_stack_mode: string;
    prm_auto_apply: boolean;
    prm_allow_with_manual_disc: boolean;
    prm_calc_on_amount_type: string;
    prm_include_tax: boolean;
    prm_bill_type: string;
    prm_min_bill_amount: string;
    prm_min_qty: string;
    prm_branch_scope: string;
    prm_cust_scope: string;
    prm_item_scope: string;
    prm_price_level_id: number | null;
    prm_max_benefit_per_bill: string;
    prm_coupon_batch_id: string | null;
    prm_start_date: string;
    prm_end_date: string;
    prm_valid_from_time: string | null;
    prm_valid_to_time: string | null;
    prm_valid_weekdays: string | null;
    prm_remarks: string | null;
    prm_modified_on: string | null;
    branches: MobileSchemeBranchDto[];
    parties: MobileSchemePartyDto[];
    items: MobileSchemeItemDto[];
    slabs: MobileSchemeSlabDto[];
}
export declare class MobileSchemesPayloadDto {
    companyId: string;
    asOf: string;
    schemes: MobileSchemeDto[];
}
export declare class MobileSchemesSuccessDto {
    success: true;
    message: string;
    data: MobileSchemesPayloadDto;
}
