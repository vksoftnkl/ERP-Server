import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { PagedResult, StockCountSheetRow, StockVarianceRow, StockVoucherCancelResult, StockVoucherLineProblem, StockVoucherListResult, StockVoucherPayload, StockVoucherPostResult, StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { SavePhysicalStockVoucherDto } from './dto/save-physical-stock-voucher.dto';
import { GenerateCountSheetQueryDto, GetPhysicalStockVoucherQueryDto, PhysicalStockVarianceQueryDto, PhysicalStockVoucherRefQueryDto } from './dto/list-physical-stock-voucher-query.dto';
import { CancelPhysicalStockVoucherDto, PostPhysicalStockVoucherDto } from './dto/post-physical-stock-voucher.dto';
export declare const PHYSICAL_MENU_ID = 45;
export declare class PhysicalStockVoucherController {
    private readonly stockVoucherService;
    private readonly prisma;
    private readonly requestContext;
    constructor(stockVoucherService: StockVoucherService, prisma: PrismaService, requestContext: RequestContextService);
    countSheet(query: GenerateCountSheetQueryDto): Promise<StockVoucherSuccessResponse<PagedResult<StockCountSheetRow>>>;
    save(dto: SavePhysicalStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload>>;
    listOrLoad(query: GetPhysicalStockVoucherQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherPayload | StockVoucherListResult>>;
    validate(query: PhysicalStockVoucherRefQueryDto): Promise<StockVoucherSuccessResponse<StockVoucherLineProblem[]>>;
    post(dto: PostPhysicalStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherPostResult>>;
    cancel(dto: CancelPhysicalStockVoucherDto): Promise<StockVoucherSuccessResponse<StockVoucherCancelResult>>;
    variance(query: PhysicalStockVarianceQueryDto): Promise<StockVoucherSuccessResponse<PagedResult<StockVarianceRow>>>;
    private postedMessage;
    private requireRight;
}
