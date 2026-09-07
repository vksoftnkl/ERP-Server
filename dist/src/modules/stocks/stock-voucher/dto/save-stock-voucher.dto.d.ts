import { type StockRateSource } from '../types/stock-voucher.types';
import { SaveStockVoucherItemDto } from './save-stock-voucher-item.dto';
export declare class SaveStockVoucherHeaderDto {
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
    fromGodownId?: string | null;
    toGodownId?: string | null;
    supplierId?: string | null;
    rateSource?: StockRateSource | null;
    remarks?: string | null;
    userId?: string;
}
export declare class SaveStockVoucherDto {
    header: SaveStockVoucherHeaderDto;
    lines: SaveStockVoucherItemDto[];
}
