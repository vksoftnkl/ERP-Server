import { type CheckCode, type GroupLevel, type MoneyKind, type VoucherNature } from '../types/day-summary.types';
export declare class DaySummaryScopeDto {
    companyId: string;
    accYear: string;
    branchId?: string;
    fromDate: string;
    toDate?: string;
    voucherTypeId?: number;
    clearingAsBank?: boolean;
    groupLevel?: GroupLevel;
    zeroRows?: boolean;
}
export declare class DaySummaryExportDto extends DaySummaryScopeDto {
    includeCancelledPairs?: boolean;
    natureFilter?: VoucherNature;
    moneyKind?: MoneyKind;
    withLegs?: boolean;
}
export declare class DaySummaryVouchersDto extends DaySummaryExportDto {
    page?: number;
    pageSize?: number;
    draftsOnly?: boolean;
}
export declare class DaySummaryGroupLedgersDto extends DaySummaryScopeDto {
    groupId: string;
}
export declare class DaySummaryCheckDetailDto extends DaySummaryScopeDto {
    code: CheckCode;
}
