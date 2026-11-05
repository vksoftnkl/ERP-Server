import { GetStockAdjReasonsQueryDto } from './dto/get-stock-adj-reasons-query.dto';
import { StockAdjReasonsService } from './stock-adj-reasons.service';
import { StockAdjReasonsGetMeta, StockAdjReasonsPayload, StockAdjReasonsSuccessResponse } from './types/stock-adj-reasons-api.types';
export declare class StockAdjReasonsController {
    private readonly stockAdjReasonsService;
    constructor(stockAdjReasonsService: StockAdjReasonsService);
    get(queryDto: GetStockAdjReasonsQueryDto): Promise<StockAdjReasonsSuccessResponse<StockAdjReasonsPayload[], StockAdjReasonsGetMeta>>;
}
