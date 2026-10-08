import { SaleOrderService } from './sale-order.service';
import { SaleOrderLifecycleService } from './sale-order-lifecycle.service';
import { AmendSaleOrderDto, CancelSaleOrderDto, PostSaleOrderDto } from './dto/sale-order-lifecycle.dto';
import { SaveSaleOrderDto } from './dto/save-sale-order.dto';
import { CancelSaleOrderLinesDto } from './dto/cancel-sale-order-lines.dto';
import { SaleOrderCancelLinesResult, SaleOrderPayload, SaleOrderSrcDocPendingAmount, SaleOrderSuccessResponse } from './types/sale-order-api.types';
export declare class SaleOrderController {
    private readonly orderService;
    private readonly lifecycle;
    constructor(orderService: SaleOrderService, lifecycle: SaleOrderLifecycleService);
    save(saveOrderDto: SaveSaleOrderDto): Promise<SaleOrderSuccessResponse<SaleOrderPayload>>;
    getById(soId: string, soCompanyId: string, soBranchId: string, soAccYear: string): Promise<SaleOrderSuccessResponse<SaleOrderPayload>>;
    getPendingAmount(ablSrcDocType: string, ablSrcDocId: string, ablSrcAccYear: string): Promise<SaleOrderSuccessResponse<SaleOrderSrcDocPendingAmount>>;
    cancelLines(srcModule: string, srcDocId: string, srcAccYear: string, cancelDto: CancelSaleOrderLinesDto): Promise<SaleOrderSuccessResponse<SaleOrderCancelLinesResult>>;
    remove(soId: string, soCompanyId: string, soBranchId: string, soAccYear: string): Promise<SaleOrderSuccessResponse<{
        soId: string;
        deleted: true;
    }>>;
    postOrder(dto: PostSaleOrderDto): Promise<SaleOrderSuccessResponse<{
        soStatus: string;
        warnings: unknown[];
    }>>;
    cancelOrder(dto: CancelSaleOrderDto): Promise<SaleOrderSuccessResponse<{
        soStatus: string;
        cancelledLines: number;
    }>>;
    amendOrder(dto: AmendSaleOrderDto): Promise<SaleOrderSuccessResponse<SaleOrderPayload>>;
}
