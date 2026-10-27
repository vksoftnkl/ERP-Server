import type { Prisma } from '@prisma/client';
import type { StockErrorDetail, StockErrorResponse } from "../../../../common/utils/module-service.utils";
import type { TxnStatusDocType } from "../../../../common/txn-status-log/txn-status-log.helper";
export interface StockPostHooks {
    beforePost?: (tx: Prisma.TransactionClient, svhId: string) => Promise<void>;
    afterPost?: (tx: Prisma.TransactionClient, rowsPosted: number, svhId: string) => Promise<void>;
}
export type { StockErrorDetail, StockErrorResponse };
export declare const STOCK_VOUCHER_TYPES: readonly ["OPENING", "RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER_OUT", "TRANSFER_IN", "DAMAGE", "EXPIRY_WRITEOFF", "PHYSICAL", "REPACK_IN", "REPACK_OUT"];
export type StockVoucherType = (typeof STOCK_VOUCHER_TYPES)[number];
export declare const STOCK_VOUCHER_STATUSES: readonly ["DRAFT", "POSTED", "IN_TRANSIT", "RECEIVED", "CANCELLED"];
export type StockVoucherStatus = (typeof STOCK_VOUCHER_STATUSES)[number];
export declare const SAVEABLE_STOCK_VOUCHER_STATUSES: readonly ["DRAFT", "POSTED"];
export type SaveableStockVoucherStatus = (typeof SAVEABLE_STOCK_VOUCHER_STATUSES)[number];
export declare const STOCK_BUCKETS: readonly ["SALEABLE", "DAMAGED", "QUARANTINE", "EXPIRED", "SAMPLE"];
export type StockBucket = (typeof STOCK_BUCKETS)[number];
export declare const STOCK_RATE_SOURCES: readonly ["AVG_COST", "LAST_PURCHASE", "LOT_COST", "MRP", "MANUAL"];
export type StockRateSource = (typeof STOCK_RATE_SOURCES)[number];
export declare const RELOT_REASON_CODES: {
    readonly out: "RELOT_OUT";
    readonly in: "RELOT_IN";
};
export declare const DERIVABLE_RATE_SOURCES: readonly ["AVG_COST", "LAST_PURCHASE", "LOT_COST", "MRP"];
export declare const STOCK_POST_SHAPES: readonly ["SIMPLE", "COUNT", "TRANSFER_OUT", "TRANSFER_IN", "BUCKET_MOVE"];
export type StockPostShape = (typeof STOCK_POST_SHAPES)[number];
export declare const STOCK_SRC_MODULE = "STOCK";
export declare const STOCK_QUANTITY_MODES: readonly ["QTY", "COUNT"];
export type StockQuantityMode = (typeof STOCK_QUANTITY_MODES)[number];
export declare const PHYSICAL_TXN_TYPES: readonly ["PHYSICAL_PLUS", "PHYSICAL_MINUS"];
export declare const PHYSICAL_DEFAULT_RATE_SOURCE: StockRateSource;
export interface StockVoucherTypeRules {
    voucherType: StockVoucherType;
    typeCode: string;
    refnoVchrTypeId?: number;
    displayName: string;
    requiresToGodown: boolean;
    requiresFromGodown: boolean;
    isInward: boolean;
    ledgerTxnTypes: readonly string[];
    quantityMode: StockQuantityMode;
    defaultRateSource?: StockRateSource;
    allowsRepeatHolding?: boolean;
    allowsCount: boolean;
    allowsToBranch: boolean;
    allowsLoading?: boolean;
    postShape: StockPostShape;
    lineDirection?: 'DOCUMENT' | 'REASON';
    allowsLot?: boolean;
    blockNegative?: boolean;
    requiresLot?: boolean;
    zeroesLineCost?: boolean;
    autoBatchNo?: boolean;
    auditScreenName: string;
    statusDocType: TxnStatusDocType;
    refuseTypes?: readonly StockVoucherType[];
}
export interface StockVoucherLineProblem {
    sviId: string;
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    problem: string | null;
}
export interface StockVoucherLoadingPayload {
    loadEnabled: boolean;
    loadDatetime: string | null;
    loadmanIds: string[];
    loadmanNames: (string | null)[];
    driverId: string | null;
    driverName: string | null;
    supervisorId: string | null;
    supervisorName: string | null;
    vehicleId: string | null;
    vehicleNo: string | null;
    loadingCharge: number;
    unloadEnabled: boolean;
    unloadDatetime: string | null;
    unloadmanIds: string[];
    unloadmanNames: (string | null)[];
    unloadSupervisorId: string | null;
    unloadSupervisorName: string | null;
    unloadingCharge: number;
}
export interface StockVoucherHeaderPayload extends Partial<StockVoucherLoadingPayload> {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    deviceId: string;
    sessionId: string | null;
    voucherType: StockVoucherType;
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
    toBranchName: string | null;
    partyRef: string | null;
    linkSrcModule: string | null;
    linkSrcDocType: string | null;
    linkSrcDocId: string | null;
    linkSrcAccYear: string | null;
    syncDate: string | null;
    status: StockVoucherStatus;
    lineCount: number;
    totalQty: number;
    totalValue: number;
    totalValueWot: number;
    postedOn: string | null;
    postedBy: string | null;
    postedByName: string | null;
    cancelledOn: string | null;
    cancelReason: string | null;
    createdOn: string;
    createdBy: string | null;
    createdByName: string | null;
    modifiedOn: string | null;
    rateSource: StockRateSource | null;
    reasonId: string | null;
    reasonName: string | null;
    freezeStock: boolean;
    freezeFrom: string | null;
    freezeTo: string | null;
    remarks: string | null;
    isDeleted: boolean;
}
export interface StockVoucherLinePayload {
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
    bucket: StockBucket;
    barcode: string | null;
    batchNo: string | null;
    mfgDate: string | null;
    expiryDate: string | null;
    mrp: number | null;
    salePrice: number | null;
    serialNo: string | null;
    supplierId: string | null;
    supplierName: string | null;
    toBucket: StockBucket | null;
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
    direction: number | null;
    remarks: string | null;
    trackSignature: string;
    sizeId: string | null;
    sizeName: string | null;
    colourId: string | null;
    colourName: string | null;
    model: string | null;
    loadRate?: number;
    unloadRate?: number;
}
export interface StockVoucherPayload {
    header: StockVoucherHeaderPayload;
    lines: StockVoucherLinePayload[];
}
export interface StockVoucherListItem {
    svhId: string;
    accYear: string;
    refno: string;
    usrRefno: string | null;
    docDate: string;
    godownId: string | null;
    godownName: string | null;
    status: StockVoucherStatus;
    lineCount: number;
    totalQty: number;
    totalValue: number;
    totalValueWot: number;
    postedOn: string | null;
    rateSource: StockRateSource | null;
    remarks: string | null;
}
export interface StockVoucherListResult {
    items: StockVoucherListItem[];
    meta: {
        limit: number;
        offset: number;
        count: number;
    };
}
export interface StockVoucherSaveResult extends StockVoucherPayload {
    lines: StockVoucherSavedLine[];
    rowsPosted: number | null;
    bookChanges: StockBookChange[];
}
export interface StockVoucherSavedLine extends StockVoucherLinePayload {
    bookChanged: boolean;
    previousBookQty: number | null;
}
export interface StockBookChange {
    sviId: string;
    lineNo: number;
    previousBookQty: number;
    bookQty: number;
}
export interface StockVoucherPostResult extends StockVoucherPayload {
    rowsPosted: number;
    status: StockVoucherStatus;
    postedOn: string | null;
}
export interface StockVoucherCancelResult extends StockVoucherPayload {
    rowsReversed: number;
    status: StockVoucherStatus;
    cancelledOn: string | null;
}
export interface StockTransferRecallResult extends StockVoucherCancelResult {
    transitRowsClosed: number;
}
export interface StockVoucherImportResult extends StockVoucherPayload {
    rowsRead: number;
    linesImported: number;
    problems: StockVoucherLineProblem[];
}
export interface StockVoucherDeleteResult {
    svhId: string;
    accYear: string;
    deleted: true;
}
export interface StockVoucherSuccessResponse<TData> {
    success: true;
    message: string;
    data: TData;
}
export interface PendingOpeningItem {
    itemId: string;
    itemCode: string | null;
    itemName: string;
    baseUomId: string | null;
    unitName: string | null;
    trackSignature: string | null;
}
export interface OpeningReconcileRow {
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
export interface StockCountSheetRow {
    lineNo: number;
    splitNo: number;
    itemId: string;
    itemCode: string | null;
    itemName: string;
    lotId: string;
    godownId: string;
    godownName: string | null;
    bucket: StockBucket;
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
    sizeId: string | null;
    sizeName: string | null;
    colourId: string | null;
    colourName: string | null;
    model: string | null;
}
export interface StockVarianceRow {
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
export interface PagedResult<TRow> {
    items: TRow[];
    meta: {
        limit: number;
        offset: number;
        count: number;
    };
}
export declare const STOCK_ENGINE_SQLSTATE_STATUS: Readonly<Record<string, number>>;
export declare const NEGATIVE_STOCK_MESSAGE_FRAGMENT = "would go negative";
