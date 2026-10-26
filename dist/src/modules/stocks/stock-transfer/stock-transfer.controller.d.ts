import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { StockVoucherCancelResult, StockVoucherDeleteResult, StockVoucherLineProblem, StockVoucherListResult, StockVoucherPayload, StockVoucherSuccessResponse, StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import { StockTransferService } from './stock-transfer.service';
import { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import { GetStockTransferQueryDto, StockTransferRefQueryDto } from './dto/list-stock-transfer-query.dto';
import { CancelStockTransferDto, DespatchStockTransferDto } from './dto/post-stock-transfer.dto';
import type { StockTransferDespatchResult, StockTransitRow } from './types/stock-transfer.types';
declare const TRANSFER_OUT_RULES: StockVoucherTypeRules;
export declare const STOCK_TRANSFER_MENU_ID = 41;
export declare class StockTransferController {
    private readonly stockTransferService;
    private readonly stockVoucherService;
    private readonly prisma;
    private readonly requestContext;
    constructor(stockTransferService: StockTransferService, stockVoucherService: StockVoucherService, prisma: PrismaService, requestContext: RequestContextService);
    save(dto: SaveStockTransferDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    listOrLoad(query: GetStockTransferQueryDto): Promise<StockVoucherSuccessResponse<(StockVoucherPayload & {
        transit: StockTransitRow[];
    }) | StockVoucherListResult>>;
    validate(query: StockTransferRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    despatch(dto: DespatchStockTransferDto): Promise<StockVoucherSuccessResponse<StockTransferDespatchResult>>;
    cancel(dto: CancelStockTransferDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    remove(query: StockTransferRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
    private requireRight;
}
export { TRANSFER_OUT_RULES };
