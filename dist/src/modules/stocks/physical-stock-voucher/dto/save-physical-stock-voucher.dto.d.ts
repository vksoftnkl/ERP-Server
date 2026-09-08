import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
import { type StockBucket } from '../../stock-voucher/types/stock-voucher.types';
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
export declare class SavePhysicalStockVoucherHeaderDto extends SaveStockVoucherHeaderDto {
    voucherType?: 'PHYSICAL';
    lineCount?: undefined;
    totalQty?: undefined;
    totalValue?: undefined;
    totalValueWot?: undefined;
}
export declare class SavePhysicalStockVoucherDto {
    header: SavePhysicalStockVoucherHeaderDto;
    lines: SavePhysicalStockVoucherItemDto[];
}
