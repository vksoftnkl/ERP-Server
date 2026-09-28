import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
import { type StockBucket } from '../../stock-voucher/types/stock-voucher.types';
import { type StockAdjustmentKind } from '../stock-adjustment.rules';
export declare class SaveStockAdjustmentHeaderDto extends SaveStockVoucherHeaderDto {
    voucherType: StockAdjustmentKind;
}
export declare class SaveStockAdjustmentItemDto {
    lineNo: number;
    itemId: string;
    uomId: string;
    baseUomId: string;
    toBaseFactor: number;
    qty: number;
    baseQty: number;
    freeQty?: number;
    freeBaseQty?: number;
    godownId: string;
    lotId?: string | null;
    bucket?: StockBucket;
    batchNo?: string | null;
    mfgDate?: string | null;
    expiryDate?: string | null;
    mrp?: number | null;
    salePrice?: number | null;
    serialNo?: string | null;
    supplierId?: string | null;
    costRate?: number;
    costRateWot?: number;
    taxPerc?: number;
    reasonId?: string | null;
    remarks?: string | null;
    barcode?: string | null;
}
export declare class SaveStockAdjustmentDto {
    header: SaveStockAdjustmentHeaderDto;
    lines: SaveStockAdjustmentItemDto[];
}
