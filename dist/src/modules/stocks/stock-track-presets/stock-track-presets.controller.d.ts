import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import { DeactivateStockTrackPresetDto, SaveStockTrackPresetDto } from './dto/save-stock-track-preset.dto';
import { StockTrackPresetsService } from './stock-track-presets.service';
import { StockTrackPresetsGetMeta, StockTrackPresetsPayload, StockTrackPresetsSuccessResponse } from './types/stock-track-presets-api.types';
export declare const TRACKING_PRESETS_MENU_ID = 249;
export declare class StockTrackPresetsController {
    private readonly stockTrackPresetsService;
    private readonly prisma;
    private readonly requestContext;
    constructor(stockTrackPresetsService: StockTrackPresetsService, prisma: PrismaService, requestContext: RequestContextService);
    get(queryDto: GetStockTrackPresetsQueryDto): Promise<StockTrackPresetsSuccessResponse<StockTrackPresetsPayload[], StockTrackPresetsGetMeta>>;
    save(dto: SaveStockTrackPresetDto): Promise<StockTrackPresetsSuccessResponse<StockTrackPresetsPayload>>;
    deactivate(dto: DeactivateStockTrackPresetDto): Promise<StockTrackPresetsSuccessResponse<StockTrackPresetsPayload>>;
    private requireRight;
}
