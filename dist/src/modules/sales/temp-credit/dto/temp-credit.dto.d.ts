export declare class OpenTempCreditsQueryDto {
    companyId: string;
    branchId?: string;
    status?: string;
    search?: string;
    overdueOnly?: boolean;
}
export declare class TempCreditFollowUpDto {
    atcId: string;
    atcAccYear: string;
    promiseDate?: string | null;
    remarks: string;
}
