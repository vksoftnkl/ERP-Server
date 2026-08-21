import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';

export type PromotionSchemeErrorDetail = ModuleApiErrorDetail;
export type PromotionSchemeErrorResponse = ModuleApiErrorResponse<PromotionSchemeErrorDetail>;
export type PromotionSchemeSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
> = ModuleApiSuccessResponse<T, TMeta, never>;

export interface PromotionSchemeBranchPayload {
  prb_id: string;
  prb_prm_id: string;
  prb_slno: number;
  prb_branch_id: string;
  prb_is_exclude: boolean;
  prb_notes: string | null;
  prb_is_active: boolean;
  prb_is_deleted: boolean;
  prb_sync_date: string | null;
  prb_created_on: string;
  prb_created_by: string | null;
  prb_modified_on: string | null;
  prb_modified_by: string | null;
}

export interface PromotionSchemePartyPayload {
  prp_id: string;
  prp_prm_id: string;
  prp_slno: number;
  prp_kind: string;
  prp_scope_id: string;
  // Generated columns — read-only mirrors of prp_scope_id, one per kind.
  prp_cust_id: string | null;
  prp_cust_group_id: string | null;
  prp_area_id: string | null;
  prp_city_id: string | null;
  prp_is_exclude: boolean;
  prp_match_priority: number;
  prp_notes: string | null;
  prp_is_active: boolean;
  prp_is_deleted: boolean;
  prp_sync_date: string | null;
  prp_created_on: string;
  prp_created_by: string | null;
  prp_modified_on: string | null;
  prp_modified_by: string | null;
}

export interface PromotionSchemeItemPayload {
  pri_id: string;
  pri_prm_id: string;
  pri_slno: number;
  pri_kind: string;
  pri_scope_id: string;
  // Generated columns — read-only mirrors of pri_scope_id, one per kind.
  pri_item_id: string | null;
  pri_group_id: string | null;
  pri_category_id: string | null;
  pri_brand_id: string | null;
  pri_section_id: string | null;
  pri_unit_id: string | null;
  pri_is_exclude: boolean;
  pri_disc_perc: number;
  pri_disc_qty: number;
  pri_disc_amt: number;
  pri_min_qty: number;
  pri_factor: number;
  pri_max_benefit: number;
  pri_match_priority: number;
  pri_notes: string | null;
  pri_is_active: boolean;
  pri_is_deleted: boolean;
  pri_sync_date: string | null;
  pri_created_on: string;
  pri_created_by: string | null;
  pri_modified_on: string | null;
  pri_modified_by: string | null;
}

export interface PromotionSchemeSlabPayload {
  prs_id: string;
  prs_prm_id: string;
  prs_slno: number;
  prs_benefit: string;
  prs_exceeds: number;
  prs_upto: number | null;
  prs_each: number;
  prs_is_repeat: boolean;
  prs_max_repeats: number;
  prs_free_item_id: string | null;
  prs_free_unit_id: string | null;
  prs_free_qty: number;
  prs_free_stock_check: boolean;
  prs_disc_perc: number;
  prs_disc_qty: number;
  prs_disc_amt: number;
  prs_fixed_price: number | null;
  prs_max_benefit_amt: number;
  prs_notes: string | null;
  prs_is_active: boolean;
  prs_is_deleted: boolean;
  prs_sync_date: string | null;
  prs_created_on: string;
  prs_created_by: string | null;
  prs_modified_on: string | null;
  prs_modified_by: string | null;
}

export interface PromotionSchemeSummaryPayload {
  prm_id: string;
  prm_comp_id: string;
  prm_branch_id: string | null;
  prm_tenant_id: string | null;
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
  prm_min_bill_amount: number;
  prm_min_qty: number;
  prm_branch_scope: string;
  prm_cust_scope: string;
  prm_item_scope: string;
  prm_price_level_id: number | null;
  prm_max_benefit_per_bill: number;
  prm_max_uses_total: number;
  prm_max_uses_per_cust: number;
  prm_budget_amount: number;
  prm_coupon_batch_id: string | null;
  prm_start_date: string;
  prm_end_date: string;
  prm_valid_from_time: string | null;
  prm_valid_to_time: string | null;
  prm_valid_weekdays: string | null;
  prm_remarks: string | null;
  prm_is_active: boolean;
  prm_is_deleted: boolean;
  prm_sync_date: string | null;
  prm_created_on: string;
  prm_created_by: string | null;
  prm_modified_on: string | null;
  prm_modified_by: string | null;
  prm_approved_on: string | null;
  prm_approved_by: string | null;
}

export interface PromotionSchemePayload extends PromotionSchemeSummaryPayload {
  branches: PromotionSchemeBranchPayload[];
  parties: PromotionSchemePartyPayload[];
  items: PromotionSchemeItemPayload[];
  slabs: PromotionSchemeSlabPayload[];
}

export interface PromotionSchemeDeleteResult {
  deleted: true;
  prm_id: string;
}

/** Every child delete answers the same shape: the row that went, and its parent. */
export interface PromotionSchemeChildDeleteResult {
  deleted: true;
  prm_id: string;
  row_id: string;
}
