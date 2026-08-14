import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as PromotionLoyaltyPointsErrorFieldDto };
export { SalesErrorResponseDto as PromotionLoyaltyPointsErrorResponseDto };
export declare class LoyaltyPointPayloadDto {
    lspt_id: string;
    lspt_ls_id: string;
    lspt_slno: number;
    lspt_item_id: string | null;
    lspt_unit_id: string | null;
    lspt_exceeds: number;
    lspt_each: number;
    lspt_factor: number;
    lspt_points: number;
    lspt_notes: string | null;
    lspt_is_active: boolean;
    lspt_is_deleted: boolean;
    lspt_sync_date: string | null;
    lspt_created_on: string;
    lspt_created_by: string | null;
    lspt_updated_on: string | null;
    lspt_updated_by: string | null;
}
export declare class LoyaltyGiftPayloadDto {
    lsg_id: string;
    lsg_ls_id: string;
    lsg_slno: number;
    lsg_item_id: string;
    lsg_unit_id: string;
    lsg_item_qty: number;
    lsg_redeem_points: number;
    lsg_repeat: boolean;
    lsg_notes: string | null;
    lsg_is_active: boolean;
    lsg_is_deleted: boolean;
    lsg_sync_date: string | null;
    lsg_created_on: string;
    lsg_created_by: string | null;
    lsg_updated_on: string | null;
    lsg_updated_by: string | null;
}
export declare class LoyaltyPartyPayloadDto {
    lps_id: string;
    lps_ls_id: string;
    lps_slno: number;
    lps_scope_type: string;
    lps_scope_id: string;
    lps_is_exclude: boolean;
    lps_notes: string | null;
    lps_is_active: boolean;
    lps_is_deleted: boolean;
    lps_sync_date: string | null;
    lps_created_on: string;
    lps_created_by: string | null;
    lps_updated_on: string | null;
    lps_updated_by: string | null;
}
export declare class LoyaltySchemeSummaryPayloadDto {
    ls_id: string;
    ls_code: string | null;
    ls_name: string;
    ls_type: string;
    ls_status: string;
    ls_auto_apply: boolean;
    ls_apply_on: string;
    ls_calc_on_amount_type: string;
    ls_bill_type: string;
    ls_cust_type: string;
    ls_item_type: string;
    ls_start_date: string;
    ls_end_date: string;
    ls_valid_from_time: string | null;
    ls_valid_to_time: string | null;
    ls_valid_weekdays: string | null;
    ls_comp_id: string;
    ls_branch_id: string | null;
    ls_include_tax_for_points: boolean;
    ls_rounding_method: string;
    ls_recur_apl: boolean;
    ls_bal_apl: boolean;
    ls_allow_point_redeem: boolean;
    ls_allow_gift_redeem: boolean;
    ls_redeem_value_per_point: number;
    ls_min_redeem_points: number;
    ls_max_redeem_points_per_bill: number;
    ls_max_redeem_percent_per_bill: number;
    ls_redeem_min_bill_amount: number;
    ls_points_valid_days: number;
    ls_expiry_basis: string;
    ls_remarks: string | null;
    ls_is_active: boolean;
    ls_is_deleted: boolean;
    ls_sync_date: string | null;
    ls_created_on: string;
    ls_created_by: string | null;
    ls_updated_on: string | null;
    ls_updated_by: string | null;
    ls_approved_on: string | null;
    ls_approved_by: string | null;
}
export declare class LoyaltySchemePayloadDto extends LoyaltySchemeSummaryPayloadDto {
    parties: LoyaltyPartyPayloadDto[];
    points: LoyaltyPointPayloadDto[];
    gifts: LoyaltyGiftPayloadDto[];
}
export declare class LoyaltySchemeDeleteResultDto {
    ls_id: string;
    deleted: true;
}
export declare class LoyaltyPointDeleteResultDto {
    lspt_id: string;
    deleted: true;
}
export declare class LoyaltyGiftDeleteResultDto {
    lsg_id: string;
    deleted: true;
}
export declare class LoyaltySchemeSuccessSingleDto {
    success: true;
    message: string;
    data: LoyaltySchemePayloadDto;
}
export declare class LoyaltySchemeSuccessDeleteDto {
    success: true;
    message: string;
    data: LoyaltySchemeDeleteResultDto;
}
export declare class LoyaltyPointSuccessSingleDto {
    success: true;
    message: string;
    data: LoyaltyPointPayloadDto;
}
export declare class LoyaltyPointSuccessDeleteDto {
    success: true;
    message: string;
    data: LoyaltyPointDeleteResultDto;
}
export declare class LoyaltyGiftSuccessSingleDto {
    success: true;
    message: string;
    data: LoyaltyGiftPayloadDto;
}
export declare class LoyaltyGiftSuccessDeleteDto {
    success: true;
    message: string;
    data: LoyaltyGiftDeleteResultDto;
}
