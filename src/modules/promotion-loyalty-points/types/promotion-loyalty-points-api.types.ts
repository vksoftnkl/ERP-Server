export interface PromotionLoyaltyPointsErrorDetail {
  field: string;
  message: string;
}

export interface PromotionLoyaltyPointsErrorResponse {
  success: false;
  message: string;
  errors: PromotionLoyaltyPointsErrorDetail[];
}

export interface PromotionLoyaltyPointsSuccessResponse<T, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
}

export interface PromotionLoyaltyPointsListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface LoyaltyPointPayload {
  lspt_id: number;
  lspt_ls_id: number;
  lspt_slno: number;
  lspt_item_id: number | null;
  lspt_unit_id: number | null;
  lspt_exceeds: number;
  lspt_each: number;
  lspt_factor: number;
  lspt_points: number;
  lspt_is_active: boolean;
  lspt_is_deleted: boolean;
  created_on: string;
  created_by: number | null;
  modified_on: string | null;
  modified_by: number | null;
}

export interface LoyaltyGiftPayload {
  gift_ls_id: number;
  gift_slno: number;
  gift_item_id: number;
  gift_unit_id: number;
  gift_qty: number;
  gift_points: number;
  gift_repeat: boolean;
  gift_is_active: boolean;
  gift_is_deleted: boolean;
  created_on: string;
  created_by: number | null;
  modified_on: string | null;
  modified_by: number | null;
}

export interface LoyaltySchemeSummaryPayload {
  ls_id: number;
  ls_code: string | null;
  ls_name: string;
  ls_type: string;
  ls_apply_on: string;
  ls_bill_type: string;
  ls_cust_type: string;
  ls_item_type: string;
  ls_start_date: string;
  ls_end_date: string;
  ls_comp_id: number;
  ls_branch_id: number | null;
  ls_points_per_inr: number;
  ls_points_per_qty: number;
  ls_min_bill_amount: number;
  ls_max_points_per_bill: number;
  ls_recur_apl: boolean;
  ls_bal_apl: boolean;
  ls_allow_point_earn: boolean;
  ls_allow_point_redeem: boolean;
  ls_allow_gift_redeem: boolean;
  ls_is_active: boolean;
  ls_is_deleted: boolean;
  created_on: string;
  created_by: number | null;
  modified_on: string | null;
  modified_by: number | null;
}

export interface LoyaltySchemePayload extends LoyaltySchemeSummaryPayload {
  points: LoyaltyPointPayload[];
  gifts: LoyaltyGiftPayload[];
}

export interface LoyaltyDeleteResult {
  deleted: true;
}

export interface LoyaltySchemeDeleteResult extends LoyaltyDeleteResult {
  ls_id: number;
}

export interface LoyaltyPointDeleteResult extends LoyaltyDeleteResult {
  lspt_id: number;
}

export interface LoyaltyGiftDeleteResult extends LoyaltyDeleteResult {
  gift_ls_id: number;
  gift_slno: number;
}
