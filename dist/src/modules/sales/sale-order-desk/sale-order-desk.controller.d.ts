import { CloseOpenLinesDto, DeliveryHoldDto, FiguresDto, MergeDto, MergePreviewDto, PriorityDto, StockCoverDto } from './dto/sale-order-desk.dto';
import { SaleOrderDeskMergeService } from './sale-order-desk-merge.service';
import { SaleOrderDeskService } from './sale-order-desk.service';
import type { CloseOpenLinesResult, DeliveryHoldResult, FiguresResult, MergePreviewResult, MergeResult, PriorityResult, SaleOrderDeskResponse, StockCoverResult } from './types/sale-order-desk.types';
export declare class SaleOrderDeskController {
    private readonly desk;
    private readonly mergeService;
    constructor(desk: SaleOrderDeskService, mergeService: SaleOrderDeskMergeService);
    deliveryHold(dto: DeliveryHoldDto): Promise<SaleOrderDeskResponse<DeliveryHoldResult>>;
    priority(dto: PriorityDto): Promise<SaleOrderDeskResponse<PriorityResult>>;
    closeOpenLines(dto: CloseOpenLinesDto): Promise<SaleOrderDeskResponse<CloseOpenLinesResult>>;
    stockCover(dto: StockCoverDto): Promise<SaleOrderDeskResponse<StockCoverResult>>;
    figures(dto: FiguresDto): Promise<SaleOrderDeskResponse<FiguresResult>>;
    mergePreview(dto: MergePreviewDto): Promise<SaleOrderDeskResponse<MergePreviewResult>>;
    merge(dto: MergeDto): Promise<SaleOrderDeskResponse<MergeResult>>;
}
