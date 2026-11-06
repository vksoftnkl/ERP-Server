import { CostPriceBulkService } from './cost-price-bulk.service';
import { ListCostPriceBulkQueryDto } from './dto/list-cost-price-bulk-query.dto';
import { SaveCostPriceBulkDto } from './dto/save-cost-price-bulk.dto';
import type { CostBulkListResult, CostBulkSaveResult, CostBulkValidateResult } from './types/cost-price-bulk.types';
interface CostBulkSuccess<TData> {
    success: true;
    message: string;
    data: TData;
}
export declare class CostPriceBulkController {
    private readonly service;
    constructor(service: CostPriceBulkService);
    list(query: ListCostPriceBulkQueryDto): Promise<CostBulkSuccess<CostBulkListResult>>;
    validate(dto: SaveCostPriceBulkDto): Promise<CostBulkSuccess<CostBulkValidateResult>>;
    save(dto: SaveCostPriceBulkDto): Promise<CostBulkSuccess<CostBulkSaveResult>>;
}
export {};
