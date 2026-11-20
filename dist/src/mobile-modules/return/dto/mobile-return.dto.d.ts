export declare const MOBILE_RETURN_CONDITIONS: readonly ["RESTOCK", "DAMAGED", "EXPIRED", "SCRAP"];
export declare const MOBILE_RETURN_SETTLE_MODES: readonly ["ADJUST", "ADVANCE"];
export declare class MobileReturnLineDto {
    sriLineNo: number;
    sriSplitNo?: number;
    sriBillItemId?: string | null;
    sriBillAccYear?: string | null;
    sriItemId: string;
    sriItemUnitId: string;
    sriReturnQty: number;
    sriCondition: string;
    sriRemarks?: string | null;
    sriBatchNo?: string | null;
    sriExpiryDate?: string | null;
}
export declare class MobileReturnAdjustmentDto {
    billId: string;
    billAccYear: string;
    amount: number;
}
export declare class CreateMobileReturnDto {
    srClientUuid: string;
    deviceUid: string;
    srCompanyId: string;
    srBranchId?: string;
    srCustId: string;
    srIsAgainstBill: boolean;
    srBillId?: string | null;
    srBillAccYear?: string | null;
    srReasonId: string;
    srSettleMode: string;
    srReturnDate?: string;
    srMobileRefno: string;
    srUsrRefno?: string | null;
    srUsrRefdate?: string | null;
    srRemarks?: string | null;
    godownId?: string;
    adjustments?: MobileReturnAdjustmentDto[];
    phoneEstimate?: unknown;
    lines: MobileReturnLineDto[];
}
export declare class DeleteMobileReturnDto {
    srClientUuid: string;
    deviceUid: string;
    srCompanyId: string;
}
export declare class MobileReturnOptionsQueryDto {
    companyId: string;
    deviceUid: string;
    branchId?: string;
}
export declare const MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE = 50;
export declare const MOBILE_RETURN_BILLS_MAX_PAGE_SIZE = 200;
export declare class MobileReturnBillLinesQueryDto extends MobileReturnOptionsQueryDto {
    since?: string;
    page?: number;
    pageSize?: number;
}
export declare const MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE = 200;
export declare const MOBILE_RETURN_STATUS_MAX_PAGE_SIZE = 500;
export declare class MobileReturnStatusQueryDto {
    companyId: string;
    deviceUid: string;
    since?: string;
    page?: number;
    pageSize?: number;
}
