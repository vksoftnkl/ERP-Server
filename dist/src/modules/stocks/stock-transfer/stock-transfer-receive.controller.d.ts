import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { StockVoucherDeleteResult, StockVoucherPayload, StockVoucherSuccessResponse, StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import { StockTransferService } from './stock-transfer.service';
import { SaveStockTransferReceiveDto } from './dto/save-stock-transfer-receive.dto';
import { StockTransferInboundQueryDto, StockTransferPrefillQueryDto, StockTransferRefQueryDto } from './dto/list-stock-transfer-query.dto';
import { StockTransferRefDto } from './dto/post-stock-transfer.dto';
import type { StockTransferPrefill, StockTransferReceiveResult } from './types/stock-transfer.types';
declare const TRANSFER_IN_RULES: StockVoucherTypeRules;
export declare class StockTransferReceiveController {
    private readonly stockTransferService;
    private readonly stockVoucherService;
    constructor(stockTransferService: StockTransferService, stockVoucherService: StockVoucherService);
    inbound(query: StockTransferInboundQueryDto): Promise<{
        success: true;
        message: string;
        data: {
            items: Array<import("./types/stock-transfer.types").StockTransitRow & {
                outRefno: string | null;
                fromBranchId: string;
                daysInFlight: number;
            }>;
            meta: {
                limit: number;
                offset: number;
                count: number;
            };
        };
    }>;
    prefill(query: StockTransferPrefillQueryDto): Promise<StockVoucherSuccessResponse<StockTransferPrefill>>;
    save(dto: SaveStockTransferReceiveDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    post(dto: StockTransferRefDto): Promise<StockVoucherSuccessResponse<StockTransferReceiveResult>>;
    remove(query: StockTransferRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
}
export { TRANSFER_IN_RULES };
