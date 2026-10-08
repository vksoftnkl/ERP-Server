import { PrismaService } from "../../../database/prisma/prisma.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import { StockTrackPresetsGetMeta, StockTrackPresetsPayload } from './types/stock-track-presets-api.types';
export declare class StockTrackPresetsService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    get(queryDto: GetStockTrackPresetsQueryDto): Promise<{
        items: StockTrackPresetsPayload[];
        meta: StockTrackPresetsGetMeta;
    }>;
    private toPayload;
}
