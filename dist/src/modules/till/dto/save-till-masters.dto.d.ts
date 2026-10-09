export declare class SaveTillCounterDto {
    tcnId?: string;
    tcnCompanyId: string;
    tcnBranchId: string;
    tcnCode: string;
    tcnName: string;
    tcnKind?: string;
    tcnDrawerMode?: string;
    tcnDeviceId?: string | null;
    tcnSafeId?: string | null;
    tcnDefaultFloat?: number;
    tcnCashAlertLimit?: number;
    tcnCashBlockLimit?: number;
    tcnRequiresSession?: boolean;
    tcnSortOrder?: number;
    tcnRemarks?: string | null;
    tcnIsActive?: boolean;
}
export declare class SaveTillSafeDto {
    tsfId?: string;
    tsfCompanyId: string;
    tsfBranchId: string;
    tsfCode: string;
    tsfName: string;
    tsfLedgerId?: string;
    tsfInsuredLimit?: number;
    tsfIsDefault?: boolean;
    tsfRemarks?: string | null;
    tsfIsActive?: boolean;
}
export declare class SaveTillReasonDto {
    trsId?: string;
    trsCompanyId: string;
    trsCategory: string;
    trsCode: string;
    trsName: string;
    trsLedgerId?: string | null;
    trsNeedsNote?: boolean;
    trsNeedsRef?: boolean;
    trsMaxAmount?: number;
    trsSortOrder?: number;
    trsIsActive?: boolean;
}
export declare class SaveTillDenominationDto {
    tdnId?: string;
    tdnCompanyId: string;
    tdnCurrency?: string;
    tdnValue: number;
    tdnKind: 'NOTE' | 'COIN';
    tdnLabel: string;
    tdnBundleQty?: number;
    tdnSortOrder?: number;
    tdnValidTo?: string | null;
    tdnIsActive?: boolean;
}
export declare class SaveTillApprovalRuleDto {
    tarId?: string;
    tarCompanyId: string;
    tarBranchId?: string | null;
    tarEventCode: string;
    tarMode: string;
    tarThresholdAmount?: number;
    tarThresholdCount?: number;
    tarThresholdPercent?: number;
    tarChannel?: string;
    tarMinRole?: string;
    tarTwoPerson?: boolean;
    tarAllowSelf?: boolean;
    tarBlocksTill?: boolean;
    tarExpireMinutes?: number;
    tarEffectiveFrom?: string;
    tarRemarks?: string | null;
    tarIsActive?: boolean;
}
export declare class SaveTillApprovalAuthorityDto {
    taaId?: string;
    taaUserId: string;
    taaCompanyId?: string | null;
    taaBranchId?: string | null;
    taaRole: string;
    taaEventCode?: string | null;
    taaMaxAmount?: number | null;
    taaCanRemote?: boolean;
    taaValidFrom?: string;
    taaValidTo?: string | null;
    taaRemarks?: string | null;
    taaIsActive?: boolean;
}
export declare class TillMasterKeyQueryDto {
    id: string;
    companyId: string;
}
export declare class TillDenominationListQueryDto {
    companyId: string;
}
