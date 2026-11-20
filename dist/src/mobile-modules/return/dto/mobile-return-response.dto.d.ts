declare class MobileReturnReasonDto {
    reasonId: string;
    code: string;
    name: string;
    defaultCondition: string | null;
    refundCharges: boolean | null;
    isClaim: boolean;
    sortOrder: number;
}
declare class MobileReturnGodownDto {
    godownId: string;
    name: string;
    isDefault: boolean;
}
declare class MobileReturnSettingsDto {
    returnWindowDays: number;
    freeReturnAllowed: boolean;
    settleDefault: string | null;
    expiredLotDays: number | null;
    billDays: number;
}
declare class MobileReturnRightsDto {
    create: boolean;
    post: boolean;
}
export declare class MobileReturnOptionsDto {
    companyId: string;
    branchId: string;
    reasons: MobileReturnReasonDto[];
    godowns: MobileReturnGodownDto[];
    settings: MobileReturnSettingsDto;
    rights: MobileReturnRightsDto | null;
}
export declare class MobileReturnOptionsSuccessDto {
    success: true;
    message: string;
    data: MobileReturnOptionsDto;
}
declare class MobileReturnBillLineDto {
    billItemId: string;
    accYear: string;
    lineNo: number;
    itemId: string;
    itemName: string | null;
    itemUnitId: string;
    unitName: string | null;
    toBaseFactor: number | null;
    billQty: number | null;
    billQtyBase: number | null;
    returnedQtyBase: number | null;
    qtyLeftBase: number | null;
    onOtherDraftsBase: number | null;
    ratePreTaxBase: string | null;
    rate: string | null;
    taxPerc: string;
    cgstPerc: string;
    sgstPerc: string;
    igstPerc: string;
    lotId: string | null;
    batchNo: string | null;
    expiryDate: string | null;
    godownId: string;
    isFree: boolean;
    allowReturn: boolean;
}
declare class MobileReturnBillDto {
    sbId: string;
    accYear: string;
    refno: string | null;
    date: string;
    custId: string | null;
    branchId: string;
    billAmount: string;
    due: string;
    payMode: string | null;
    returnedAmt: string;
    returnStatus: string;
    lines: MobileReturnBillLineDto[];
}
export declare class MobileReturnBillLinesDto {
    asOf: string;
    billDays: number;
    since: string;
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
    companyId: string;
    branchId: string;
    bills: MobileReturnBillDto[];
}
export declare class MobileReturnBillLinesSuccessDto {
    success: true;
    message: string;
    data: MobileReturnBillLinesDto;
}
declare class MobileReturnUserWordingDto {
    title: string;
    line: string;
    todo: string;
}
declare class MobileReturnNoteDto {
    code: string;
    message: string;
    field: string | null;
    line: number | null;
    user?: MobileReturnUserWordingDto;
}
declare class MobileReturnTotalsDto {
    goods: string;
    tax: string;
    chargesNet: string;
    roundOff: string;
    creditNote: string;
}
declare class MobileReturnAdjustedDto {
    billId: string;
    billAccYear: string;
    refno: string | null;
    amount: string;
}
declare class MobileReturnSettlementDto {
    mode: string | null;
    credited: string;
    settleStatus: string | null;
    adjusted: MobileReturnAdjustedDto[];
}
declare class MobileReturnLineResultDto {
    sriLineNo: number;
    sriSplitNo: number;
    sriId: string;
    rateSource: string | null;
    taxableAmt: string;
    taxAmt: string;
    netAmt: string;
    bucket: string | null;
}
declare class MobileReturnReplannedDto {
    billId: string;
    billAccYear: string;
    refno: string | null;
    from: string;
    to: string;
    reason: string;
}
declare class MobileReturnApprovalDto {
    status: string;
    note: string | null;
}
export declare class MobileReturnCreateResultDto {
    duplicate: boolean;
    srId: string;
    srClientUuid: string;
    srReturnRefno: string | null;
    srMobileRefno: string | null;
    srAccYear: string;
    srBranchId: string;
    srStatus: string;
    status: string;
    srReturnAmt: string;
    totals: MobileReturnTotalsDto;
    settlement: MobileReturnSettlementDto;
    lines: MobileReturnLineResultDto[];
    held: MobileReturnNoteDto | null;
    refusal: MobileReturnNoteDto | null;
    refusals: MobileReturnNoteDto[];
    warnings: MobileReturnNoteDto[];
    replanned: MobileReturnReplannedDto[];
    approval: MobileReturnApprovalDto | null;
}
export declare class MobileReturnCreateSuccessDto {
    success: true;
    message: string;
    data: MobileReturnCreateResultDto;
}
export declare class MobileReturnDeleteResultDto {
    deleted: boolean;
    srClientUuid: string;
    srId: string | null;
    srReturnRefno: string | null;
    duplicate: boolean;
}
export declare class MobileReturnDeleteSuccessDto {
    success: true;
    message: string;
    data: MobileReturnDeleteResultDto;
}
declare class MobileReturnStatusDto {
    srClientUuid: string;
    srId: string;
    srAccYear: string;
    srReturnRefno: string | null;
    status: string;
    approval: MobileReturnApprovalDto | null;
    revisionNo: number;
    srReturnAmt: string;
    settleStatus: string | null;
    adjusted: MobileReturnAdjustedDto[];
    cancelledOn: string | null;
    cancelReason: string | null;
    updatedOn: string;
}
export declare class MobileReturnStatusPayloadDto {
    asOf: string;
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
    companyId: string;
    returns: MobileReturnStatusDto[];
}
export declare class MobileReturnStatusSuccessDto {
    success: true;
    message: string;
    data: MobileReturnStatusPayloadDto;
}
export {};
