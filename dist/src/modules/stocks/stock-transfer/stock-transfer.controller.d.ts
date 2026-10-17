import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { StockVoucherCancelResult, StockVoucherDeleteResult, StockVoucherLineProblem, StockVoucherListResult, StockVoucherPayload, StockVoucherSuccessResponse, StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import { StockTransferService } from './stock-transfer.service';
import { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import { GetStockTransferQueryDto, StockTransferRefQueryDto } from './dto/list-stock-transfer-query.dto';
import { CancelStockTransferDto, DespatchStockTransferDto } from './dto/post-stock-transfer.dto';
import type { StockTransferDespatchResult, StockTransitRow } from './types/stock-transfer.types';
declare const TRANSFER_OUT_RULES: StockVoucherTypeRules;
export declare class StockTransferController {
    private readonly stockTransferService;
    private readonly stockVoucherService;
    constructor(stockTransferService: StockTransferService, stockVoucherService: StockVoucherService);
    save(dto: SaveStockTransferDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    listOrLoad(query: GetStockTransferQueryDto): Promise<StockVoucherSuccessResponse<(StockVoucherPayload & {
        transit: StockTransitRow[];
    }) | StockVoucherListResult>>;
    validate(query: StockTransferRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    despatch(dto: DespatchStockTransferDto): Promise<StockVoucherSuccessResponse<StockTransferDespatchResult>>;
    cancel(dto: CancelStockTransferDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    remove(query: StockTransferRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
}
export { TRANSFER_OUT_RULES };
