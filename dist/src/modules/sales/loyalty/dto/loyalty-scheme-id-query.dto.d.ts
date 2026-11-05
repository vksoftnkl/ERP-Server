export declare class LoyaltySchemeIdQueryDto {
    lsc_id: string;
}
export declare class DeleteLoyaltySchemeQueryDto extends LoyaltySchemeIdQueryDto {
    lsc_modified_by?: string;
}
export declare class LoyaltySchemeEligibilityQueryDto extends LoyaltySchemeIdQueryDto {
    cus_id: string;
}
