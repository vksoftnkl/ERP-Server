import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { OpeningReconcileRow, PagedResult, StockVoucherCancelResult, StockVoucherImportResult, StockVoucherLineProblem, StockVoucherPayload, StockVoucherSaveResult, StockVoucherPostResult, StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { OpeningStockLookupService } from './opening-stock-lookup.service';
import type { OpeningStockItemLookup } from './types/opening-stock-lookup.types';
import { SaveOpeningStockVoucherDto } from './dto/save-opening-stock-voucher.dto';
import { GetOpeningStockVoucherQueryDto, OpeningStockItemLookupQueryDto, OpeningStockReportQueryDto, OpeningStockVoucherRefQueryDto } from './dto/list-opening-stock-voucher-query.dto';
import { CancelOpeningStockVoucherDto, PostOpeningStockVoucherDto } from './dto/post-opening-stock-voucher.dto';
import { ImportOpeningStockVoucherDto } from './dto/import-opening-stock-voucher.dto';
type UploadedCsvFile = {
    buffer: Buffer;
    originalname?: string;
    size?: number;
};
export declare class OpeningStockVoucherController {
    private readonly stockVoucherService;
    private readonly lookupService;
    constructor(stockVoucherService: StockVoucherService, lookupService: OpeningStockLookupService);
    lookupItem(query: OpeningStockItemLookupQueryDto): Promise<StockVoucherSuccessResponse<OpeningStockItemLookup>>;
    save(dto: SaveOpeningStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherSaveResult>>;
    load(query: GetOpeningStockVoucherQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    validate(query: OpeningStockVoucherRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    post(dto: PostOpeningStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>>;
    cancel(dto: CancelOpeningStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    import(dto: ImportOpeningStockVoucherDto, file?: UploadedCsvFile): Promise<StockVoucherSuccessResponse<StockVoucherImportResult>>;
    reconcile(query: OpeningStockReportQueryDto): Promise<StockVoucherSuccessResponse<PagedResult<OpeningReconcileRow>>>;
    private readCsv;
}
export {};
