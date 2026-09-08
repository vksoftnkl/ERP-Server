export declare class OpeningStockErrorFieldDto {
    field: string;
    message: string;
}
export declare class OpeningStockErrorResponseDto {
    success: false;
    message: string;
    errors: OpeningStockErrorFieldDto[];
}
export declare class OpeningStockHeaderDto {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    deviceId: string;
    sessionId: string | null;
    voucherType: string;
    slno: string;
    refno: string;
    usrRefno: string | null;
    docDate: string;
    docDatetime: string;
    fromGodownId: string | null;
    fromGodownName: string | null;
    godownId: string | null;
    godownName: string | null;
    supplierId: string | null;
    toBranchId: string | null;
    partyRef: string | null;
    reasonId: string | null;
    reasonName: string | null;
    linkSrcModule: string | null;
    linkSrcDocType: string | null;
    linkSrcDocId: string | null;
    linkSrcAccYear: string | null;
    freezeStock: boolean;
    freezeFrom: string | null;
    freezeTo: string | null;
    syncDate: string | null;
    status: string;
    lineCount: number;
    totalQty: number;
    totalValue: number;
    totalValueWot: number;
    postedOn: string | null;
    postedBy: string | null;
    postedByName: string | null;
    cancelledOn: string | null;
    cancelReason: string | null;
    rateSource: string | null;
    remarks: string | null;
    isDeleted: boolean;
}
export declare class OpeningStockLineDto {
    sviId: string;
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitName: string | null;
    uomId: string;
    baseUomId: string;
    toBaseFactor: number;
    godownId: string;
    godownName: string | null;
    bucket: string;
    barcode: string | null;
    batchNo: string | null;
    mfgDate: string | null;
    expiryDate: string | null;
    mrp: number | null;
    salePrice: number | null;
    serialNo: string | null;
    supplierId: string | null;
    qty: number;
    baseQty: number;
    freeQty: number;
    freeBaseQty: number;
    weightQty: number;
    costRate: number;
    costRateWot: number;
    landedRate: number;
    taxPerc: number;
    reasonId: string | null;
    reasonName: string | null;
    syncDate: string | null;
    value: number;
    valueWot: number;
    lotId: string | null;
    remarks: string | null;
}
export declare class OpeningStockDocumentDto {
    header: OpeningStockHeaderDto;
    lines: OpeningStockLineDto[];
}
export declare class OpeningStockListItemDto {
    svhId: string;
    accYear: string;
    refno: string;
    usrRefno: string | null;
    docDate: string;
    godownId: string | null;
    godownName: string | null;
    status: string;
    lineCount: number;
    totalQty: number;
    totalValue: number;
    totalValueWot: number;
    postedOn: string | null;
    rateSource: string | null;
    remarks: string | null;
}
export declare class PagedMetaDto {
    limit: number;
    offset: number;
    count: number;
}
export declare class OpeningStockListDto {
    items: OpeningStockListItemDto[];
    meta: PagedMetaDto;
}
export declare class OpeningStockLineProblemDto {
    sviId: string;
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    problem: string | null;
}
export declare class OpeningStockPostResultDto extends OpeningStockDocumentDto {
    rowsPosted: number;
    status: string;
    postedOn: string | null;
}
export declare class OpeningStockCancelResultDto extends OpeningStockDocumentDto {
    rowsReversed: number;
    status: string;
    cancelledOn: string | null;
}
export declare class OpeningStockImportResultDto extends OpeningStockDocumentDto {
    rowsRead: number;
    linesImported: number;
    problems: OpeningStockLineProblemDto[];
}
export declare class OpeningStockImportSuccessDto {
    success: true;
    message: string;
    data: OpeningStockImportResultDto;
}
export declare class OpeningStockDeleteResultDto {
    svhId: string;
    accYear: string;
    deleted: true;
}
export declare class PendingOpeningItemDto {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    baseUomId: string | null;
    unitName: string | null;
    trackSignature: string | null;
}
export declare class PendingOpeningItemsDto {
    items: PendingOpeningItemDto[];
    meta: PagedMetaDto;
}
export declare class OpeningReconcileRowDto {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    unitName: string | null;
    openingQty: number;
    openingValue: number;
    currentQty: number;
    currentValue: number;
    diffQty: number;
    diffValue: number;
}
export declare class OpeningReconcileDto {
    items: OpeningReconcileRowDto[];
    meta: PagedMetaDto;
}
export declare class OpeningStockDocumentSuccessDto {
    success: true;
    message: string;
    data: OpeningStockDocumentDto;
}
export declare class OpeningStockListSuccessDto {
    success: true;
    message: string;
    data: OpeningStockListDto;
}
export declare class OpeningStockValidateSuccessDto {
    success: true;
    message: string;
    data: OpeningStockLineProblemDto[];
}
export declare class OpeningStockPostSuccessDto {
    success: true;
    message: string;
    data: OpeningStockPostResultDto;
}
export declare class OpeningStockCancelSuccessDto {
    success: true;
    message: string;
    data: OpeningStockCancelResultDto;
}
export declare class OpeningStockDeleteSuccessDto {
    success: true;
    message: string;
    data: OpeningStockDeleteResultDto;
}
export declare class PendingOpeningItemsSuccessDto {
    success: true;
    message: string;
    data: PendingOpeningItemsDto;
}
export declare class OpeningReconcileSuccessDto {
    success: true;
    message: string;
    data: OpeningReconcileDto;
}
