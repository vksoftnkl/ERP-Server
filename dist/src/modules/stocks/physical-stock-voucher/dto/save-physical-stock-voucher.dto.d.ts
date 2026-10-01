import { type SaveableStockVoucherStatus, type StockBucket, type StockRateSource } from '../../stock-voucher/types/stock-voucher.types';
export declare class SavePhysicalStockVoucherItemDto {
    lineNo: number;
    splitNo?: number;
    itemId: string;
    godownId: string;
    bucket?: StockBucket;
    lotId: string;
    countedQty?: string | number | null;
    reasonId?: string | null;
    remarks?: string | null;
}
export declare class SavePhysicalStockVoucherHeaderDto {
    svhId?: string;
    voucherType?: 'PHYSICAL';
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
    reasonId?: string | null;
    freezeStock?: boolean;
    freezeFrom?: string | null;
    freezeTo?: string | null;
    syncDate?: string | null;
    lineCount?: number;
    totalQty?: number;
    totalValue?: number;
    totalValueWot?: number;
    rateSource?: StockRateSource | null;
    status?: SaveableStockVoucherStatus;
    remarks?: string | null;
    userId?: string;
    createdBy?: string | null;
    modifiedBy?: string | null;
}
export declare class SavePhysicalStockVoucherDto {
    header: SavePhysicalStockVoucherHeaderDto;
    lines: SavePhysicalStockVoucherItemDto[];
}
