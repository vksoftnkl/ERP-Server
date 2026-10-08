import { PrismaService } from '../../../database/prisma/prisma.service';
import { GetStockAdjReasonsQueryDto } from './dto/get-stock-adj-reasons-query.dto';
import { StockAdjReasonsGetMeta, StockAdjReasonsPayload } from './types/stock-adj-reasons-api.types';
export declare class StockAdjReasonsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    get(queryDto: GetStockAdjReasonsQueryDto): Promise<{
        items: StockAdjReasonsPayload[];
        meta: StockAdjReasonsGetMeta;
    }>;
    private toPayload;
}
