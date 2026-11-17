declare class MobileReceiptTenderOptionDto {
    tenderId: string;
    typeId: number;
    typeCode: string;
    name: string;
    shortName: string | null;
    needsRef: boolean;
    refLabel: string | null;
    isDefault: boolean;
    surchargePerc: string;
    surchargeAmount: string;
}
export declare class MobileReceiptOptionsDto {
    companyId: string;
    branchId: string;
    tenders: MobileReceiptTenderOptionDto[];
}
export declare class MobileReceiptOptionsSuccessDto {
    success: true;
    message: string;
    data: MobileReceiptOptionsDto;
}
declare class MobileReceiptAllocationDto {
    billId: string;
    billAccYear: string;
    docRefno: string;
    amount: string;
    pendingAmount: string | null;
}
export declare class MobileReceiptCreateResultDto {
    avhVoucherId: string;
    avhCompanyId: string;
    avhBranchId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    avhUsrRefno: string | null;
    avhVoucherDate: string;
    avhDocAmount: string;
    avhVoucherStatus: string;
    allocations: MobileReceiptAllocationDto[];
    onAccount: string;
    duplicate: boolean;
    avhIsDeleted: boolean;
}
export declare class MobileReceiptCreateSuccessDto {
    success: true;
    message: string;
    data: MobileReceiptCreateResultDto;
}
declare class MobileOpenBillDto {
    partyId: string;
    billId: string;
    billAccYear: string;
    billType: string;
    docRefno: string;
    docDate: string;
    dueDate: string | null;
    billAmount: string;
    pendingAmount: string;
    daysOverdue: number;
}
export declare class MobileOpenBillsDto {
    items: MobileOpenBillDto[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    companyId: string;
    onDate: string;
}
export declare class MobileOpenBillsSuccessDto {
    success: true;
    message: string;
    data: MobileOpenBillsDto;
}
export {};
