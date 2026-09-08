export declare class StockTransferErrorFieldDto {
    field: string;
    message: string;
}
export declare class StockTransferErrorResponseDto {
    success: false;
    message: string;
    errors: StockTransferErrorFieldDto[];
}
export declare class StockTransferHeaderDto {
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
export declare class StockTransferLineDto {
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
    syncDate: string | null;
    value: number;
    valueWot: number;
    lotId: string | null;
    bookQty: number | null;
    countedQty: number | null;
    diffQty: number | null;
    reasonId: string | null;
    reasonName: string | null;
    remarks: string | null;
}
export declare class StockTransferDocumentDto {
    header: StockTransferHeaderDto;
    lines: StockTransferLineDto[];
}
export declare class StockTransitRowDto {
    sttId: string;
    status: string;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    lotId: string;
    batchNo: string | null;
    expiryDate: string | null;
    toGodownId: string;
    toGodownName: string | null;
    bucket: string;
    baseUomId: string;
    unitName: string | null;
    sentQty: number;
    receivedQty: number;
    damageQty: number;
    remainingQty: number;
    costRate: number;
    transitValue: number;
    lrNo: string | null;
    vehicleNo: string | null;
    expectedOn: string | null;
    sentOn: string | null;
    receivedOn: string | null;
}
export declare class StockTransferDocumentWithTransitDto extends StockTransferDocumentDto {
    transit: StockTransitRowDto[];
}
export declare class StockTransferListItemDto {
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
export declare class StockTransferListMetaDto {
    limit: number;
    offset: number;
    count: number;
}
export declare class StockTransferListDto {
    items: StockTransferListItemDto[];
    meta: StockTransferListMetaDto;
}
export declare class StockTransferInboundRowDto extends StockTransitRowDto {
    outRefno: string | null;
    fromBranchId: string;
    daysInFlight: number;
}
export declare class StockTransferInboundDto {
    items: StockTransferInboundRowDto[];
    meta: StockTransferListMetaDto;
}
export declare class StockTransferLineProblemDto {
    sviId: string;
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    problem: string | null;
}
export declare class StockTransferDespatchDataDto extends StockTransferDocumentDto {
    sameBranch: boolean;
    status: string;
    ledgerRows: number;
    transitRows: number;
    transit: StockTransitRowDto[];
}
export declare class StockTransferPrefillOutDto {
    svhId: string;
    accYear: string;
    refno: string;
    docDate: string;
    status: string;
    fromBranchId: string;
    fromGodownId: string | null;
    toBranchId: string | null;
    toGodownId: string | null;
}
export declare class StockTransferPrefillRowDto extends StockTransitRowDto {
    lineNo: number;
}
export declare class StockTransferPrefillDto {
    outVoucher: StockTransferPrefillOutDto;
    rows: StockTransferPrefillRowDto[];
}
export declare class StockTransferReceiveInDto extends StockTransferDocumentDto {
    ledgerRows: number;
    status: string;
}
export declare class StockTransferReceiveOutDto {
    svhId: string;
    accYear: string;
    refno: string;
    status: string;
    closed: boolean;
}
export declare class StockTransferReceiveDataDto {
    inVoucher: StockTransferReceiveInDto;
    outVoucher: StockTransferReceiveOutDto;
    transit: StockTransitRowDto[];
}
export declare class StockTransferCancelDataDto extends StockTransferDocumentDto {
    rowsReversed: number;
    status: string;
    cancelledOn: string | null;
}
export declare class StockTransferDeleteDataDto {
    svhId: string;
    accYear: string;
    deleted: true;
}
export declare class StockTransferDocumentSuccessDto {
    success: true;
    message: string;
    data: StockTransferDocumentDto;
}
export declare class StockTransferLoadSuccessDto {
    success: true;
    message: string;
    data: StockTransferDocumentWithTransitDto;
}
export declare class StockTransferListSuccessDto {
    success: true;
    message: string;
    data: StockTransferListDto;
}
export declare class StockTransferValidateSuccessDto {
    success: true;
    message: string;
    data: StockTransferLineProblemDto[];
}
export declare class StockTransferDespatchSuccessDto {
    success: true;
    message: string;
    data: StockTransferDespatchDataDto;
}
export declare class StockTransferInboundSuccessDto {
    success: true;
    message: string;
    data: StockTransferInboundDto;
}
export declare class StockTransferPrefillSuccessDto {
    success: true;
    message: string;
    data: StockTransferPrefillDto;
}
export declare class StockTransferReceiveSuccessDto {
    success: true;
    message: string;
    data: StockTransferReceiveDataDto;
}
export declare class StockTransferCancelSuccessDto {
    success: true;
    message: string;
    data: StockTransferCancelDataDto;
}
export declare class StockTransferDeleteSuccessDto {
    success: true;
    message: string;
    data: StockTransferDeleteDataDto;
}
