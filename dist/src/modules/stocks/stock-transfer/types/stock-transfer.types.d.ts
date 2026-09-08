import type { StockBucket, StockVoucherCancelResult, StockVoucherPayload, StockVoucherStatus } from '../../stock-voucher/types/stock-voucher.types';
export declare const TRANSFER_LINK_SRC_MODULE = "STOCK";
export declare const TRANSFER_LINK_SRC_DOC_TYPE = "STOCK_VOUCHER";
export interface StockTransitRow {
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
    bucket: StockBucket;
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
export interface StockTransferDespatchResult extends StockVoucherPayload {
    sameBranch: boolean;
    status: StockVoucherStatus;
    ledgerRows: number;
    transitRows: number;
    transit: StockTransitRow[];
}
export interface StockTransferPrefillRow extends StockTransitRow {
    lineNo: number;
}
export interface StockTransferPrefill {
    outVoucher: {
        svhId: string;
        accYear: string;
        refno: string;
        docDate: string;
        status: StockVoucherStatus;
        fromBranchId: string;
        fromGodownId: string | null;
        toBranchId: string | null;
        toGodownId: string | null;
    };
    rows: StockTransferPrefillRow[];
}
export interface StockTransferReceiveResult {
    inVoucher: StockVoucherPayload & {
        ledgerRows: number;
        status: StockVoucherStatus;
    };
    outVoucher: {
        svhId: string;
        accYear: string;
        refno: string;
        status: StockVoucherStatus;
        closed: boolean;
    };
    transit: StockTransitRow[];
}
export interface StockTransferCancelResult extends StockVoucherCancelResult {
    sameBranch: boolean;
}
