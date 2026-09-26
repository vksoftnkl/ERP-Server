export declare class PhysicalStockErrorFieldDto {
    field: string;
    message: string;
}
export declare class PhysicalStockErrorResponseDto {
    success: false;
    message: string;
    errors: PhysicalStockErrorFieldDto[];
}
export declare class PhysicalStockHeaderDto {
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
    supplierName: string | null;
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
export declare class PhysicalStockLineDto {
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
    supplierName: string | null;
    bookQty: number | null;
    countedQty: number | null;
    diffQty: number | null;
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
export declare class PhysicalStockDocumentDto {
    header: PhysicalStockHeaderDto;
    lines: PhysicalStockLineDto[];
}
export declare class PhysicalStockListItemDto {
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
export declare class PhysicalStockListDto {
    items: PhysicalStockListItemDto[];
    meta: PagedMetaDto;
}
export declare class PhysicalStockLineProblemDto {
    sviId: string;
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    problem: string | null;
}
export declare class PhysicalStockPostResultDto extends PhysicalStockDocumentDto {
    rowsPosted: number;
    status: string;
    postedOn: string | null;
}
export declare class PhysicalStockCancelResultDto extends PhysicalStockDocumentDto {
    rowsReversed: number;
    status: string;
    cancelledOn: string | null;
}
export declare class CountSheetRowDto {
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    lotId: string;
    godownId: string;
    godownName: string | null;
    bucket: string;
    baseUomId: string;
    unitName: string | null;
    batchNo: string | null;
    mfgDate: string | null;
    expiryDate: string | null;
    mrp: number | null;
    salePrice: number | null;
    serialNo: string | null;
    supplierId: string | null;
    bookQty: number;
    avgCostRate: number;
    stockValue: number;
    countedQty: null;
}
export declare class CountSheetDto {
    items: CountSheetRowDto[];
    meta: PagedMetaDto;
}
export declare class StockVarianceRowDto {
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    batchNo: string | null;
    txnType: string;
    direction: number;
    qty: number;
    signedBaseQty: number;
    costRate: number;
    costValue: number;
    reasonId: string | null;
    reasonName: string | null;
}
export declare class StockVarianceDto {
    items: StockVarianceRowDto[];
    meta: PagedMetaDto;
}
export declare class PhysicalStockDocumentSuccessDto {
    success: true;
    message: string;
    data: PhysicalStockDocumentDto;
}
export declare class PhysicalStockListSuccessDto {
    success: true;
    message: string;
    data: PhysicalStockListDto;
}
export declare class PhysicalStockValidateSuccessDto {
    success: true;
    message: string;
    data: PhysicalStockLineProblemDto[];
}
export declare class PhysicalStockPostSuccessDto {
    success: true;
    message: string;
    data: PhysicalStockPostResultDto;
}
export declare class PhysicalStockCancelSuccessDto {
    success: true;
    message: string;
    data: PhysicalStockCancelResultDto;
}
export declare class CountSheetSuccessDto {
    success: true;
    message: string;
    data: CountSheetDto;
}
export declare class StockVarianceSuccessDto {
    success: true;
    message: string;
    data: StockVarianceDto;
}
