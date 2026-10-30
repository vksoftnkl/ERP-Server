import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import type { StockVoucherCancelResult, StockVoucherDeleteResult, StockVoucherLineProblem, StockVoucherPostResult, StockVoucherSaveResult, StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { SaveStockAdjustmentDto } from './dto/save-stock-adjustment.dto';
import { CancelStockAdjustmentDto, PickStockQueryDto, StockAdjustmentRefDto, StockAdjustmentRefQueryDto } from './dto/stock-adjustment-query.dto';
import { StockAdjustmentService, type PickStockRow, type StockAdjustmentPayload } from './stock-adjustment.service';
export declare const STOCK_ADJUSTMENT_MENU_ID = 264;
export declare class StockAdjustmentController {
    private readonly service;
    private readonly prisma;
    private readonly requestContext;
    constructor(service: StockAdjustmentService, prisma: PrismaService, requestContext: RequestContextService);
    save(dto: SaveStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherSaveResult>>;
    load(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockAdjustmentPayload>>;
    validate(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    post(dto: StockAdjustmentRefDto): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>>;
    cancel(dto: CancelStockAdjustmentDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    remove(query: StockAdjustmentRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
    pickStock(query: PickStockQueryDto): Promise<StockVoucherSuccessResponse<PickStockRow[]>>;
    private requireRight;
}
