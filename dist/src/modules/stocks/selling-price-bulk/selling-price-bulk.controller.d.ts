import { SellingPriceBulkService } from './selling-price-bulk.service';
import { ListSellingPriceQueryDto } from './dto/list-selling-price-query.dto';
import { PriceBucketsQueryDto } from './dto/price-buckets-query.dto';
import { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import type { PagedResult, SellingPriceRow, SellingPriceSaveResult } from './types/selling-price-bulk.types';
declare class PriceBucketsParamDto {
    itemId: string;
}
interface SellingPriceSuccessResponse<TData> {
    success: true;
    message: string;
    data: TData;
}
export declare class SellingPriceBulkController {
    private readonly sellingPriceBulkService;
    constructor(sellingPriceBulkService: SellingPriceBulkService);
    listPrices(queryDto: ListSellingPriceQueryDto): Promise<SellingPriceSuccessResponse<PagedResult<SellingPriceRow>>>;
    listBuckets(params: PriceBucketsParamDto, queryDto: PriceBucketsQueryDto): Promise<SellingPriceSuccessResponse<SellingPriceRow[]>>;
    saveBulk(dto: SaveSellingPriceBulkDto): Promise<SellingPriceSuccessResponse<SellingPriceSaveResult>>;
}
export {};
