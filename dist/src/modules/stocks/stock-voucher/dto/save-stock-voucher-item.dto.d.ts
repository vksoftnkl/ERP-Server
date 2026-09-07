import { type StockBucket } from '../types/stock-voucher.types';
export declare class SaveStockVoucherItemDto {
    lineNo: number;
    splitNo?: number;
    itemId: string;
    uomId: string;
    baseUomId?: string | null;
    godownId: string;
    bucket?: StockBucket;
    batchNo?: string | null;
    mfgDate?: string | null;
    expiryDate?: string | null;
    mrp?: string | number | null;
    salePrice?: string | number | null;
    serialNo?: string | null;
    supplierId?: string | null;
    qty: string | number;
    freeQty?: string | number;
    costRate: string | number;
    costRateWot?: string | number;
    taxPerc?: string | number;
    remarks?: string | null;
}
