import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { StockVoucherDeleteResult, StockVoucherPayload, StockVoucherSuccessResponse, StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import { StockTransferService } from './stock-transfer.service';
import { SaveStockTransferReceiveDto } from './dto/save-stock-transfer-receive.dto';
import { StockTransferInboundQueryDto, StockTransferPrefillQueryDto, StockTransferRefQueryDto } from './dto/list-stock-transfer-query.dto';
import { SettleShortStockTransferDto, StockTransferRefDto } from './dto/post-stock-transfer.dto';
import type { StockTransferPrefill, StockTransferReceiptPayload, StockTransferReceiveResult, StockTransferSettleShortResult } from './types/stock-transfer.types';
declare const TRANSFER_IN_RULES: StockVoucherTypeRules;
export declare class StockTransferReceiveController {
    private readonly stockTransferService;
    private readonly stockVoucherService;
    constructor(stockTransferService: StockTransferService, stockVoucherService: StockVoucherService);
    inbound(query: StockTransferInboundQueryDto): Promise<{
        success: true;
        message: string;
        data: {
            items: import("./types/stock-transfer.types").StockTransferInboundRow[];
            meta: {
                limit: number;
                offset: number;
                count: number;
            };
        };
    }>;
    load(query: StockTransferRefQueryDto): Promise<StockVoucherSuccessResponse<StockTransferReceiptPayload>>;
    prefill(query: StockTransferPrefillQueryDto): Promise<StockVoucherSuccessResponse<StockTransferPrefill>>;
    save(dto: SaveStockTransferReceiveDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    post(dto: StockTransferRefDto): Promise<StockVoucherSuccessResponse<StockTransferReceiveResult>>;
    settleShort(dto: SettleShortStockTransferDto): Promise<StockVoucherSuccessResponse<StockTransferSettleShortResult>>;
    remove(query: StockTransferRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
}
export { TRANSFER_IN_RULES };
