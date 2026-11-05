export declare const SETTABLE_STATUSES: readonly ["ACTIVE", "SUSPENDED", "CLOSED"];
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];
export declare class LoyaltyMemberStatusDto {
    companyId: string;
    memberId: string;
    status: SettableStatus;
    reason?: string;
    force?: boolean;
    approvedBy?: string;
    branchId?: string;
}
export declare class LoyaltyMemberAdjustDto {
    companyId: string;
    branchId: string;
    memberId: string;
    points: number;
    reason: string;
    approvedBy: string;
    txnDate?: string;
    expiresOn?: string;
    lscId?: string;
}
export declare class LoyaltyMemberHistoryDto {
    companyId: string;
    memberId: string;
}
