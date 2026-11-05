import { type PriceChangeAction, type PriceChangeSource } from '../types/price-change-log.types';
export declare const PRICE_TABLE_FILTERS: readonly ["IPM", "IQP", "BOTH"];
export type PriceTableFilter = (typeof PRICE_TABLE_FILTERS)[number];
export declare class ItemPriceLogFilterDto {
    companyId: string;
    branchId?: string;
    fromDate: string;
    toDate: string;
    priceTable?: PriceTableFilter;
    itemId?: string;
    userId?: string;
    deviceId?: string;
    field?: string;
    source?: PriceChangeSource;
    action?: PriceChangeAction;
    search?: string;
}
export declare class ListItemPriceLogQueryDto extends ItemPriceLogFilterDto {
    page?: number;
    limit?: number;
}
export declare class GetItemPriceLogQueryDto {
    ipclId: string;
}
export declare class ItemPriceHistoryQueryDto {
    itemId: string;
    companyId?: string;
    branchId?: string;
    priceTable?: PriceTableFilter;
    limit?: number;
}
export declare class ItemPriceLogGapsQueryDto {
    companyId?: string;
}
