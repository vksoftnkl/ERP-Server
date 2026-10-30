import { GetItemPriceLogQueryDto, ItemPriceHistoryQueryDto, ItemPriceLogFilterDto, ItemPriceLogGapsQueryDto, ListItemPriceLogQueryDto } from './dto/item-price-log-query.dto';
import { ItemPriceLogService, type PriceLogDay, type PriceLogDetail, type PriceLogGaps, type PriceLogRow } from './item-price-log.service';
type Envelope<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class ItemPriceLogController {
    private readonly service;
    constructor(service: ItemPriceLogService);
    list(q: ListItemPriceLogQueryDto): Promise<Envelope<{
        items: PriceLogRow[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>>;
    get(q: GetItemPriceLogQueryDto): Promise<Envelope<PriceLogDetail>>;
    days(q: ItemPriceLogFilterDto): Promise<Envelope<PriceLogDay[]>>;
    itemHistory(q: ItemPriceHistoryQueryDto): Promise<Envelope<PriceLogRow[]>>;
    gaps(q: ItemPriceLogGapsQueryDto): Promise<Envelope<PriceLogGaps>>;
}
export {};
