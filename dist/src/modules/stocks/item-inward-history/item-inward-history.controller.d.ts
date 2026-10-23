import { ItemInwardHistoryQueryDto } from './dto/item-inward-history-query.dto';
import { ItemInwardHistoryService, type ItemInwardRow } from './item-inward-history.service';
export declare class ItemInwardHistoryController {
    private readonly service;
    constructor(service: ItemInwardHistoryService);
    list(q: ItemInwardHistoryQueryDto): Promise<{
        success: true;
        message: string;
        data: ItemInwardRow[];
    }>;
}
