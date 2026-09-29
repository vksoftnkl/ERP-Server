import type { StockVoucherCancelResult, StockVoucherDeleteResult, StockVoucherLineProblem, StockVoucherPostResult, StockVoucherSaveResult, StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { SaveStockAdjustmentDto } from './dto/save-stock-adjustment.dto';
import { CancelStockAdjustmentDto, PickStockQueryDto, StockAdjustmentRefDto, StockAdjustmentRefQueryDto } from './dto/stock-adjustment-query.dto';
import { StockAdjustmentService, type PickStockRow, type StockAdjustmentPayload } from './stock-adjustment.service';
export declare class StockAdjustmentController {
    private readonly service;
    constructor(service: StockAdjustmentService);
    save(dto: SaveStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherSaveResult>>;
    load(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockAdjustmentPayload>>;
    validate(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    post(dto: StockAdjustmentRefDto): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>>;
    cancel(dto: CancelStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    remove(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
    pickStock(query: PickStockQueryDto): Promise<StockVoucherSuccessResponse<PickStockRow[]>>;
}
