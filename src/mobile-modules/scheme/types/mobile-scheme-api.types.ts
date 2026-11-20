/**
 * GET /mobile/schemes/active: the promotion schemes a phone can apply offline
 * for one company (plan-item-schemes-offers §6.1). Keys copy the VK Nex column
 * names (snake_case), so the phone's tables mirror the server's.
 *
 * Numbers: integer columns are JSON numbers; every numeric column is exact
 * text at its column scale ('5.000', '0.00'); a NULL numeric stays null.
 */
export interface MobileSchemesPayload {
  companyId: string;
  /** The database's today (IST) that the end-date filter used, YYYY-MM-DD. */
  asOf: string;
  schemes: MobileScheme[];
}

export interface MobileScheme {
  prm_id: string;
  prm_comp_id: string;
  /** NULL = every branch of the company. */
  prm_branch_id: string | null;
  prm_code: string;
  prm_name: string;
  /** Always APPROVED here. */
  prm_status: string;
  /** BILL_AMOUNT | BILL_QTY | ITEM_AMOUNT | ITEM_QTY */
  prm_apply_on: string;
  /** FREE_ITEM | DISC_PERC | DISC_AMT | FIXED_PRICE | DISC_PER_ITEM */
  prm_benefit: string;
  prm_priority: number;
  /** EXCLUSIVE | STACKABLE */
  prm_stack_mode: string;
  /** Always true here. */
  prm_auto_apply: boolean;
  prm_allow_with_manual_disc: boolean;
  /** GROSS_AMOUNT | NET_AMOUNT | TAXABLE_AMOUNT */
  prm_calc_on_amount_type: string;
  prm_include_tax: boolean;
  /** ALL | CASH | CREDIT */
  prm_bill_type: string;
  /** numeric(18,2) */
  prm_min_bill_amount: string;
  /** numeric(18,3) */
  prm_min_qty: string;
  /** ALL | LIST */
  prm_branch_scope: string;
  prm_cust_scope: string;
  prm_item_scope: string;
  prm_price_level_id: number | null;
  /** numeric(18,2) */
  prm_max_benefit_per_bill: string;
  /** Always null here (coupon schemes are not sent). */
  prm_coupon_batch_id: string | null;
  /** YYYY-MM-DD */
  prm_start_date: string;
  prm_end_date: string;
  /** HH:MM:SS, null = all day. */
  prm_valid_from_time: string | null;
  prm_valid_to_time: string | null;
  /** "MON,TUE,…", null = every day. */
  prm_valid_weekdays: string | null;
  prm_remarks: string | null;
  /** IST with offset (2026-08-24T15:20:31.123+05:30), null when never modified. */
  prm_modified_on: string | null;
  branches: MobileSchemeBranch[];
  parties: MobileSchemeParty[];
  items: MobileSchemeItem[];
  slabs: MobileSchemeSlab[];
}

export interface MobileSchemeBranch {
  prb_id: string;
  prb_branch_id: string;
  /** branch_master.br_name (display only). */
  prb_branch_name: string | null;
  prb_is_exclude: boolean;
}

export interface MobileSchemeParty {
  prp_id: string;
  /** CUSTOMER | CUSTOMER_GROUP | AREA | CITY */
  prp_kind: string;
  prp_scope_id: string;
  /** cus_name / cgr_name / arm_name / ctm_name, as /promotion-scheme/list (display only). */
  prp_scope_name: string | null;
  prp_is_exclude: boolean;
  prp_match_priority: number;
}

export interface MobileSchemeItem {
  pri_id: string;
  /** ITEM | ITEM_GROUP | ITEM_CATEGORY | ITEM_BRAND | ITEM_SECTION */
  pri_kind: string;
  pri_scope_id: string;
  /** item_name_en / itg_name / category_name / brand_name / sec_name (display only). */
  pri_scope_name: string | null;
  /** item_unit_conversion.iuc_id (an order line's soiItemUnitId); set on ITEM rows only. */
  pri_unit_id: string | null;
  /** unit_name through item_unit_conversion (display only). */
  pri_unit_name: string | null;
  pri_is_exclude: boolean;
  /** numeric(18,4) */
  pri_disc_perc: string;
  /** numeric(18,4) */
  pri_disc_qty: string;
  /** numeric(18,2) */
  pri_disc_amt: string;
  /** numeric(18,3) */
  pri_min_qty: string;
  /** numeric(18,4) */
  pri_factor: string;
  /** numeric(18,2) */
  pri_max_benefit: string;
  pri_match_priority: number;
}

export interface MobileSchemeSlab {
  prs_id: string;
  prs_slno: number;
  prs_benefit: string;
  /** numeric(18,3) */
  prs_exceeds: string;
  /** numeric(18,3), null = open-ended. */
  prs_upto: string | null;
  /** numeric(18,3) */
  prs_each: string;
  prs_is_repeat: boolean;
  /** 0 = no limit. */
  prs_max_repeats: number;
  prs_free_item_id: string | null;
  /** item_name_en (display only). */
  prs_free_item_name: string | null;
  /** item_unit_conversion.iuc_id of the free unit. */
  prs_free_unit_id: string | null;
  /** unit_name through item_unit_conversion (display only). */
  prs_free_unit_name: string | null;
  /** iuc_to_base_factor of the free unit, numeric(18,6); null when no free unit. */
  prs_free_unit_factor: string | null;
  /** numeric(18,3) */
  prs_free_qty: string;
  prs_free_stock_check: boolean;
  /** numeric(18,4) */
  prs_disc_perc: string;
  /** numeric(18,4): rupees off per unit. */
  prs_disc_qty: string;
  /** numeric(18,2): rupees flat. */
  prs_disc_amt: string;
  /** numeric(18,4), null = not a fixed-price band. */
  prs_fixed_price: string | null;
  /** numeric(18,2) */
  prs_max_benefit_amt: string;
}
