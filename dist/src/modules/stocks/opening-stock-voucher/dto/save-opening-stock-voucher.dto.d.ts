import { type SaveableStockVoucherStatus, type StockBucket, type StockRateSource } from '../../stock-voucher/types/stock-voucher.types';
export declare class SaveOpeningStockVoucherHeaderDto {
    svhId?: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    deviceId: string;
    sessionId?: string | null;
    slno?: string;
    refno?: string;
    usrRefno?: string | null;
    docDate: string;
    docDatetime?: string | null;
    toGodownId: string;
    lineCount?: number;
    totalQty?: number;
    totalValue?: number;
    totalValueWot?: number;
    rateSource?: StockRateSource | null;
    remarks?: string | null;
    userId?: string;
    voucherType?: 'OPENING';
    status?: SaveableStockVoucherStatus;
    createdBy?: string | null;
    modifiedBy?: string | null;
}
export declare class SaveOpeningStockVoucherItemDto {
    lineNo: number;
    splitNo?: number;
    itemId: string;
    uomId: string;
    baseUomId: string;
    toBaseFactor: number;
    godownId: string;
    bucket?: StockBucket;
    barcode?: string | null;
    batchNo?: string | null;
    mfgDate?: string | null;
    expiryDate?: string | null;
    mrp?: string | number | null;
    salePrice?: string | number | null;
    serialNo?: string | null;
    supplierId?: string | null;
    qty?: string | number;
    baseQty: number;
    freeQty?: string | number;
    freeBaseQty?: number;
    weightQty?: string | number;
    costRate?: string | number;
    costRateWot?: string | number;
    landedRate?: string | number;
    taxPerc?: string | number;
    remarks?: string | null;
    createdBy?: string | null;
    modifiedBy?: string | null;
}
export declare class SaveOpeningStockVoucherDto {
    header: SaveOpeningStockVoucherHeaderDto;
    lines: SaveOpeningStockVoucherItemDto[];
}
