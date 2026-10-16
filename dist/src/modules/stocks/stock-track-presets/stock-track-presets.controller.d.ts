import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import { StockTrackPresetsService } from './stock-track-presets.service';
import { StockTrackPresetsGetMeta, StockTrackPresetsPayload, StockTrackPresetsSuccessResponse } from './types/stock-track-presets-api.types';
export declare class StockTrackPresetsController {
    private readonly stockTrackPresetsService;
    constructor(stockTrackPresetsService: StockTrackPresetsService);
    get(queryDto: GetStockTrackPresetsQueryDto): Promise<StockTrackPresetsSuccessResponse<StockTrackPresetsPayload[], StockTrackPresetsGetMeta>>;
}
