import { GetItemQtyRatesQueryDto } from './dto/get-item-qty-rates-query.dto';
import { SaveItemQtyRatesDto } from './dto/save-item-qty-rates.dto';
import { ItemQtyRatesService } from './item-qty-rates.service';
import type { QtyRatesSaveResult, QtyRatesView } from './types/item-qty-rates.types';
interface QtyRatesSuccess<TData> {
    success: true;
    message: string;
    data: TData;
}
export declare class ItemQtyRatesController {
    private readonly service;
    constructor(service: ItemQtyRatesService);
    getWithRates(query: GetItemQtyRatesQueryDto): Promise<QtyRatesSuccess<QtyRatesView>>;
    saveWithRates(dto: SaveItemQtyRatesDto): Promise<QtyRatesSuccess<QtyRatesSaveResult>>;
}
export {};
