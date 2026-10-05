export declare const MEMBER_STATUSES: readonly ["ACTIVE", "SUSPENDED", "CLOSED", "MERGED"];
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export declare const SORT_ORDERS: readonly ["asc", "desc"];
export type SortOrder = (typeof SORT_ORDERS)[number];
export declare class LoyaltyStatusScopeDto {
    companyId: string;
    branchId?: string;
}
export declare class LoyaltyStatusListDto extends LoyaltyStatusScopeDto {
    page?: number;
    limit?: number;
    sort?: string;
    order?: SortOrder;
    search?: string;
}
export declare class LoyaltyStatusMembersDto extends LoyaltyStatusListDto {
    lscId?: string;
    status?: MemberStatus;
    balanceGtZero?: boolean;
    eligibleOnly?: boolean;
    pointsMin?: number;
    pointsMax?: number;
    includeMergedClosed?: boolean;
    earnedFrom?: string;
    earnedTo?: string;
}
export declare class LoyaltyStatusStatementDto {
    companyId: string;
    memberId: string;
    from?: string;
    to?: string;
    showReversals?: boolean;
}
export declare class LoyaltyStatusMemberDto {
    companyId: string;
    memberId: string;
}
export declare class LoyaltyStatusExpiringDto extends LoyaltyStatusListDto {
    lscId?: string;
    withinDays?: number;
    hasMobile?: boolean;
    activeOnly?: boolean;
}
export declare class LoyaltyStatusCalendarDto extends LoyaltyStatusScopeDto {
    lscId?: string;
    days?: number;
}
export declare const SCHEME_SPLITS: readonly ["scheme", "scheme_branch", "scheme_month"];
export type SchemeSplit = (typeof SCHEME_SPLITS)[number];
export declare class LoyaltyStatusPeriodDto extends LoyaltyStatusScopeDto {
    from: string;
    to: string;
}
export declare class LoyaltyStatusSchemesDto extends LoyaltyStatusPeriodDto {
    lscId?: string;
    includeClosedHolding?: boolean;
    splitBy?: SchemeSplit;
    sort?: string;
    order?: SortOrder;
}
export declare class LoyaltyStatusMonthlyDto extends LoyaltyStatusPeriodDto {
    lscId: string;
}
export declare class LoyaltyStatusGiftsDto extends LoyaltyStatusPeriodDto {
    lscId: string;
}
export declare const EXPORT_TABS: readonly ["members", "expiring", "schemes", "statement"];
export type ExportTab = (typeof EXPORT_TABS)[number];
export declare const EXPORT_FORMATS: readonly ["pdf", "xlsx"];
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export declare class LoyaltyStatusExportDto extends LoyaltyStatusScopeDto {
    tab: ExportTab;
    format?: ExportFormat;
    sort?: string;
    order?: SortOrder;
    search?: string;
    lscId?: string;
    status?: MemberStatus;
    balanceGtZero?: boolean;
    eligibleOnly?: boolean;
    pointsMin?: number;
    pointsMax?: number;
    includeMergedClosed?: boolean;
    earnedFrom?: string;
    earnedTo?: string;
    withinDays?: number;
    hasMobile?: boolean;
    activeOnly?: boolean;
    from?: string;
    to?: string;
    includeClosedHolding?: boolean;
    splitBy?: SchemeSplit;
    memberId?: string;
    showReversals?: boolean;
}
