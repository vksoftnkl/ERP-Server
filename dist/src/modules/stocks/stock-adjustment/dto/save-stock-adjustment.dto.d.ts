import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
import { type StockBucket } from '../../stock-voucher/types/stock-voucher.types';
import { type StockAdjustmentSaveKind } from '../stock-adjustment.rules';
declare const SaveStockAdjustmentHeaderDto_base: import("@nestjs/common").Type<Omit<SaveStockVoucherHeaderDto, "totalQty" | "totalValue" | "totalValueWot">>;
export declare class SaveStockAdjustmentHeaderDto extends SaveStockAdjustmentHeaderDto_base {
    voucherType: StockAdjustmentSaveKind;
    totalQty?: number;
    totalValue?: number;
    totalValueWot?: number;
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
    toBucket?: StockBucket | null;
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
export {};
