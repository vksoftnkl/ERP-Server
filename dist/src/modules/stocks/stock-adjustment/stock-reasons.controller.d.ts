import type { StockVoucherSuccessResponse } from '../stock-voucher/types/stock-voucher.types';
import { DeactivateStockReasonDto, SaveStockReasonDto, StockReasonListQueryDto, StockReasonPickerQueryDto, StockReasonRefQueryDto } from './dto/stock-reason.dto';
import { StockReasonsService, type StockReasonListRow, type StockReasonRow, type StockReasonUsage } from './stock-reasons.service';
export declare class StockReasonsController {
    private readonly service;
    constructor(service: StockReasonsService);
    pick(query: StockReasonPickerQueryDto): Promise<StockVoucherSuccessResponse<StockReasonRow[]>>;
    list(query: StockReasonListQueryDto): Promise<StockVoucherSuccessResponse<StockReasonListRow[]>>;
    getOne(query: StockReasonRefQueryDto): Promise<StockVoucherSuccessResponse<StockReasonListRow>>;
    usage(query: StockReasonRefQueryDto): Promise<StockVoucherSuccessResponse<StockReasonUsage>>;
    save(dto: SaveStockReasonDto): Promise<StockVoucherSuccessResponse<StockReasonListRow>>;
    deactivate(dto: DeactivateStockReasonDto): Promise<StockVoucherSuccessResponse<StockReasonListRow | {
        srmId: string;
        deleted: true;
    }>>;
}
