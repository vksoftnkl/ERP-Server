import { MobileReceiptAdjustReason } from '../mobile-receipt-plan';
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
    requiresBank: boolean;
}
declare class MobileReceiptSettingsDto {
    receiptBillSort: string;
    salesmanMandatory: boolean;
    pdcPostingMode: string;
    ppdEnabled: boolean;
}
export declare class MobileReceiptOptionsDto {
    companyId: string;
    branchId: string;
    tenders: MobileReceiptTenderOptionDto[];
    settings: MobileReceiptSettingsDto;
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
    discount: string;
    roundoff: string;
    pendingAmount: string | null;
}
declare class MobileReceiptCreditAppliedDto {
    billId: string;
    billAccYear: string;
    docRefno: string;
    amount: string;
    pendingAmount: string | null;
}
declare class MobileReceiptPdcVoucherDto {
    voucherId: string;
    voucherRefno: string | null;
    chequeDate: string;
    amount: string;
}
declare class MobileReceiptAdjustedDto {
    billId: string;
    billAccYear: string;
    docRefno: string;
    planned: string;
    applied: string;
    reason: MobileReceiptAdjustReason;
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
    creditsApplied: MobileReceiptCreditAppliedDto[];
    pdcVouchers: MobileReceiptPdcVoucherDto[];
    adjusted: MobileReceiptAdjustedDto[];
    employeeId: string | null;
}
export declare class MobileReceiptCreateSuccessDto {
    success: true;
    message: string;
    data: MobileReceiptCreateResultDto;
}
declare class MobilePpdStepDto {
    tillDate: string;
    perc: string;
    amount: string;
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
    kind: string;
    paidAmount: string;
    pdcHeld: string;
    ppdSchedule: MobilePpdStepDto[];
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
declare class MobileReceiptChequeDto {
    voucherId: string | null;
    voucherRefno: string | null;
    instrumentNo: string;
    chequeDate: string;
    amount: string;
    status: string;
    houseStatus: string;
    isPostDated: boolean;
}
declare class MobileReceiptStatusDto {
    avhClientUuid: string;
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    avhVoucherStatus: string;
    cancelledOn: string | null;
    cancelReason: string | null;
    pdc: MobileReceiptChequeDto[];
    updatedOn: string;
}
export declare class MobileReceiptStatusPayloadDto {
    items: MobileReceiptStatusDto[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    companyId: string;
    asOf: string;
}
export declare class MobileReceiptStatusSuccessDto {
    success: true;
    message: string;
    data: MobileReceiptStatusPayloadDto;
}
export {};
