export declare class LedgerStatementYearDto {
    companyId: string;
    accYear: string;
    branchId?: string;
}
export declare class LedgerStatementScopeDto extends LedgerStatementYearDto {
    ledgerId: string;
}
export declare class LedgerStatementRangeDto extends LedgerStatementScopeDto {
    fromDate: string;
    toDate: string;
}
export declare class LedgerStatementExportDto extends LedgerStatementRangeDto {
    includeCancelled?: boolean;
    withBillRefs?: boolean;
    withLegs?: boolean;
}
export declare class LedgerStatementVouchersDto extends LedgerStatementExportDto {
    page?: number;
    pageSize?: number;
}
export declare class LedgerStatementLedgersDto {
    companyId: string;
    search?: string;
    groupId?: string;
    limit?: number;
}
export declare class LedgerStatementVoucherLegsDto {
    companyId: string;
    accYear: string;
    voucherId: string;
    ledgerId: string;
}
