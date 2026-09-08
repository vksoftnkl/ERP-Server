import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { OpeningReconcileRow, PagedResult, PendingOpeningItem, StockVoucherCancelResult, StockVoucherDeleteResult, StockVoucherImportResult, StockVoucherLineProblem, StockVoucherListResult, StockVoucherPayload, StockVoucherPostResult, StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { SaveOpeningStockVoucherDto } from './dto/save-opening-stock-voucher.dto';
import { GetOpeningStockVoucherQueryDto, OpeningStockReportQueryDto, OpeningStockVoucherRefQueryDto } from './dto/list-opening-stock-voucher-query.dto';
import { CancelOpeningStockVoucherDto, PostOpeningStockVoucherDto } from './dto/post-opening-stock-voucher.dto';
import { ImportOpeningStockVoucherDto } from './dto/import-opening-stock-voucher.dto';
type UploadedCsvFile = {
    buffer: Buffer;
    originalname?: string;
    size?: number;
};
export declare class OpeningStockVoucherController {
    private readonly stockVoucherService;
    constructor(stockVoucherService: StockVoucherService);
    save(dto: SaveOpeningStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    listOrLoad(query: GetOpeningStockVoucherQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload | StockVoucherListResult>>;
    validate(query: OpeningStockVoucherRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    post(dto: PostOpeningStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>>;
    cancel(dto: CancelOpeningStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    remove(query: OpeningStockVoucherRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherDeleteResult>>;
    import(dto: ImportOpeningStockVoucherDto, file?: UploadedCsvFile): Promise<StockVoucherSuccessResponse<StockVoucherImportResult>>;
    pendingItems(query: OpeningStockReportQueryDto): Promise<StockVoucherSuccessResponse<PagedResult<PendingOpeningItem>>>;
    reconcile(query: OpeningStockReportQueryDto): Promise<StockVoucherSuccessResponse<PagedResult<OpeningReconcileRow>>>;
    private readCsv;
}
export {};
