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
    docDatetime?: string | null;
    fromGodownId?: string | null;
    toGodownId?: string | null;
    supplierId?: string | null;
    toBranchId?: string | null;
    partyRef?: string | null;
    reasonId?: string | null;
    linkSrcModule?: string | null;
    linkSrcDocType?: string | null;
    linkSrcDocId?: string | null;
    linkSrcAccYear?: string | null;
    freezeStock?: boolean;
    freezeFrom?: string | null;
    freezeTo?: string | null;
    syncDate?: string | null;
    lineCount?: number;
    totalQty?: number;
    totalValue?: number;
    totalValueWot?: number;
    rateSource?: StockRateSource | null;
    remarks?: string | null;
    lrNo?: string | null;
    vehicleNo?: string | null;
    expectedOn?: string | null;
    userId?: string;
}
export declare class SaveStockVoucherDto {
    header: SaveStockVoucherHeaderDto;
    lines: SaveStockVoucherItemDto[];
}
