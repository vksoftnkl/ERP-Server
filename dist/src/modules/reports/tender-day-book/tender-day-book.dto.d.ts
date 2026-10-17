export declare class TenderBooksScopeDto {
    companyId: string;
    accYear: string;
    branchId?: string;
    fromDate?: string;
    toDate?: string;
    sessionId?: string;
}
export declare class TenderDayBookQueryDto extends TenderBooksScopeDto {
    groupBy?: 'TENDER' | 'TYPE';
    tenderIds?: string[];
    tenderTypeIds?: string[];
    withRows?: boolean;
    limit?: number;
}
export declare class NoTenderQueryDto extends TenderBooksScopeDto {
    limit?: number;
}
