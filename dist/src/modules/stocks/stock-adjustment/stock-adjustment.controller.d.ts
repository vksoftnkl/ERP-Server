import type { StockVoucherCancelResult, StockVoucherDeleteResult, StockVoucherLineProblem, StockVoucherPayload, StockVoucherPostResult, StockVoucherSaveResult, StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { SaveStockAdjustmentDto } from './dto/save-stock-adjustment.dto';
import { CancelStockAdjustmentDto, PickStockQueryDto, StockAdjustmentRefDto, StockAdjustmentRefQueryDto } from './dto/stock-adjustment-query.dto';
import { StockAdjustmentService, type PickStockRow } from './stock-adjustment.service';
export declare class StockAdjustmentController {
    private readonly service;
    constructor(service: StockAdjustmentService);
    save(dto: SaveStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherSaveResult>>;
    load(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    validate(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    post(dto: StockAdjustmentRefDto): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>>;
    cancel(dto: CancelStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    remove(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
    pickStock(query: PickStockQueryDto): Promise<StockVoucherSuccessResponse<PickStockRow[]>>;
}
