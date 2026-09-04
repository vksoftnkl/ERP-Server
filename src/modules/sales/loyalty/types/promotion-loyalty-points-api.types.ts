import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';

export type PromotionLoyaltyPointsErrorDetail = ModuleApiErrorDetail;
export type PromotionLoyaltyPointsErrorResponse =
  ModuleApiErrorResponse<PromotionLoyaltyPointsErrorDetail>;
export type PromotionLoyaltyPointsSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
> = ModuleApiSuccessResponse<T, TMeta, never>;

export interface LoyaltySchemeBranchPayload {
  lsb_id: string;
  lsb_lsc_id: string;
  lsb_slno: number;
  lsb_branch_id: string;
  // Display only — joined from branch_master, never written back.
  lsb_branch_name: string | null;
  lsb_branch_code: string | null;
  lsb_is_exclude: boolean;
  lsb_notes: string | null;
  lsb_is_active: boolean;
  lsb_is_deleted: boolean;
  lsb_sync_date: string | null;
  lsb_created_on: string;
  lsb_created_by: string | null;
  lsb_modified_on: string | null;
  lsb_modified_by: string | null;
}

export interface LoyaltySchemePartyPayload {
  lsp_id: string;
  lsp_lsc_id: string;
  lsp_slno: number;
  lsp_kind: string;
  lsp_scope_id: string;
  // Generated columns — read-only mirrors of lsp_scope_id, one per kind.
  lsp_cust_id: string | null;
  lsp_cust_group_id: string | null;
  // Display only — the name behind lsp_scope_id, from whichever master
  // lsp_kind names. Never written back.
  lsp_scope_name: string | null;
  lsp_scope_code: string | null;
  lsp_is_exclude: boolean;
  lsp_match_priority: number;
  lsp_notes: string | null;
  lsp_is_active: boolean;
  lsp_is_deleted: boolean;
  lsp_sync_date: string | null;
  lsp_created_on: string;
  lsp_created_by: string | null;
  lsp_modified_on: string | null;
  lsp_modified_by: string | null;
}

export interface LoyaltySchemeItemPayload {
  lsi_id: string;
  lsi_lsc_id: string;
  lsi_slno: number;
  lsi_kind: string;
  lsi_scope_id: string;
  // Generated columns — read-only mirrors of lsi_scope_id, one per kind.
  lsi_item_id: string | null;
  lsi_group_id: string | null;
  lsi_category_id: string | null;
  lsi_brand_id: string | null;
  lsi_section_id: string | null;
  // Display only.
  lsi_scope_name: string | null;
  lsi_is_exclude: boolean;
  lsi_factor: number;
  lsi_points: number;
  lsi_max_points: number;
  lsi_match_priority: number;
  lsi_notes: string | null;
  lsi_is_active: boolean;
  lsi_is_deleted: boolean;
  lsi_sync_date: string | null;
  lsi_created_on: string;
  lsi_created_by: string | null;
  lsi_modified_on: string | null;
  lsi_modified_by: string | null;
}

export interface LoyaltySchemeSlabPayload {
  lss_id: string;
  lss_lsc_id: string;
  lss_slno: number;
  lss_item_id: string | null;
  lss_unit_id: string | null;
  // Display only.
  lss_item_name: string | null;
  lss_unit_name: string | null;
  lss_exceeds: number;
  lss_upto: number | null;
  lss_each: number;
  lss_points: number;
  lss_factor: number;
  lss_max_points: number;
  lss_notes: string | null;
  lss_is_active: boolean;
  lss_is_deleted: boolean;
  lss_sync_date: string | null;
  lss_created_on: string;
  lss_created_by: string | null;
  lss_modified_on: string | null;
  lss_modified_by: string | null;
}

export interface LoyaltySchemeGiftPayload {
  lsg_id: string;
  lsg_lsc_id: string;
  lsg_slno: number;
  lsg_item_id: string;
  lsg_unit_id: string;
  // Display only.
  lsg_item_name: string | null;
  lsg_unit_name: string | null;
  lsg_item_qty: number;
  lsg_redeem_points: number;
  lsg_repeat: boolean;
  lsg_max_qty_per_bill: number;
  lsg_stock_check: boolean;
  lsg_valid_from: string | null;
  lsg_valid_upto: string | null;
  lsg_notes: string | null;
  lsg_is_active: boolean;
  lsg_is_deleted: boolean;
  lsg_sync_date: string | null;
  lsg_created_on: string;
  lsg_created_by: string | null;
  lsg_modified_on: string | null;
  lsg_modified_by: string | null;
}

export interface LoyaltySchemeSummaryPayload {
  lsc_id: string;
  lsc_comp_id: string;
  lsc_branch_id: string | null;
  // Display only — the names behind the two ids, from company and
  // branch_master. Never written back; null on the audit snapshots, which are
  // built from unjoined rows.
  lsc_comp_name: string | null;
  lsc_branch_name: string | null;
  lsc_tenant_id: string | null;
  lsc_code: string;
  lsc_name: string;
  lsc_type: string;
  lsc_status: string;
  lsc_priority: number;
  lsc_auto_apply: boolean;
  lsc_apply_on: string;
  lsc_calc_on_amount_type: string;
  lsc_include_tax: boolean;
  lsc_bill_type: string;
  lsc_min_bill_amount: number;
  lsc_max_earn_points: number;
  lsc_earn_on_discounted: boolean;
  lsc_earn_on_charges: boolean;
  lsc_earn_with_redeem: boolean;
  lsc_rounding_method: string;
  lsc_points_decimals: number;
  lsc_branch_scope: string;
  lsc_cust_scope: string;
  lsc_item_scope: string;
  lsc_price_level_id: number | null;
  lsc_pool_mode: string;
  lsc_allow_cross_branch_redeem: boolean;
  lsc_allow_point_redeem: boolean;
  lsc_allow_gift_redeem: boolean;
  lsc_redeem_tender_id: string | null;
  lsc_redeem_value_per_point: number;
  lsc_min_redeem_points: number;
  lsc_max_redeem_points: number;
  lsc_max_redeem_perc: number;
  lsc_redeem_min_bill_amount: number;
  lsc_redeem_multiple: number;
  lsc_expiry_basis: string;
  lsc_points_valid_days: number;
  lsc_activation_days: number;
  lsc_return_mode: string;
  lsc_start_date: string;
  lsc_end_date: string;
  lsc_valid_from_time: string | null;
  lsc_valid_to_time: string | null;
  lsc_valid_weekdays: string | null;
  lsc_remarks: string | null;
  lsc_is_active: boolean;
  lsc_is_deleted: boolean;
  lsc_sync_date: string | null;
  lsc_created_on: string;
  lsc_created_by: string | null;
  lsc_modified_on: string | null;
  lsc_modified_by: string | null;
  lsc_approved_on: string | null;
  lsc_approved_by: string | null;
}

export interface LoyaltySchemePayload extends LoyaltySchemeSummaryPayload {
  branches: LoyaltySchemeBranchPayload[];
  parties: LoyaltySchemePartyPayload[];
  items: LoyaltySchemeItemPayload[];
  slabs: LoyaltySchemeSlabPayload[];
  gifts: LoyaltySchemeGiftPayload[];
}

export interface LoyaltySchemeDeleteResult {
  deleted: true;
  lsc_id: string;
}

/**
 * "Does THIS customer earn on THIS scheme?" — the question the till asks, as
 * opposed to the grid, which asks who a scheme covers.
 *
 * A customer can be reached by two rows at once: by name and by their group.
 * `matched_by` names the row that actually decided it — highest
 * lsp_match_priority, with an EXCLUDE beating an INCLUDE at equal priority.
 */
export interface LoyaltySchemeEligibilityPayload {
  lsc_id: string;
  cus_id: string;
  qualifies: boolean;
  /** 'ALL' when the scheme covers everyone and no party row was consulted. */
  decided_by: 'ALL' | 'RULE' | 'NO_RULE';
  matched_by: string | null;
  matched_row_id: string | null;
  match_priority: number | null;
  is_exclude: boolean | null;
  reason: string;
}
