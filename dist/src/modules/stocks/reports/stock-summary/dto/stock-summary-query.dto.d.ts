import { type ValueAt } from '../../item-ledger/item-ledger.rules';
import { type QtyIn, type ShowChoice, type SortKey, type SummaryBucket } from '../stock-summary.rules';
import type { ExportTab, GroupBy } from '../types/stock-summary.types';
export declare class StockSummaryOptionsDto {
    companyId: string;
    branchId: string;
}
export declare class StockSummaryScopeDto extends StockSummaryOptionsDto {
    from: string;
    to: string;
    godownId?: string;
    groupId?: string;
    brandId?: string;
    bucket?: SummaryBucket;
    valueAt?: ValueAt;
    qtyIn?: QtyIn;
    noSaleDays?: number;
}
export declare class StockSummaryViewDto {
    sort?: SortKey;
    dir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    hideZero?: boolean;
    onlyNegative?: boolean;
    show?: ShowChoice;
    find?: string;
    groupBy?: GroupBy;
    groupKey?: string;
}
declare const StockSummaryQueryDto_base: import("@nestjs/common").Type<StockSummaryScopeDto & StockSummaryViewDto>;
export declare class StockSummaryQueryDto extends StockSummaryQueryDto_base {
}
export declare class StockSummaryRunDto {
    runId: string;
    companyId?: string;
}
declare const StockSummaryRowsDto_base: import("@nestjs/common").Type<StockSummaryViewDto & StockSummaryRunDto>;
export declare class StockSummaryRowsDto extends StockSummaryRowsDto_base {
}
export declare class StockSummaryGodownsDto extends StockSummaryRowsDto {
}
export declare class StockSummaryGroupsDto extends StockSummaryRunDto {
    groupBy?: GroupBy;
    hideZero?: boolean;
    onlyNegative?: boolean;
    show?: ShowChoice;
}
declare const StockSummaryBranchesDto_base: import("@nestjs/common").Type<StockSummaryViewDto & Omit<StockSummaryScopeDto, "godownId">>;
export declare class StockSummaryBranchesDto extends StockSummaryBranchesDto_base {
}
export declare class StockSummaryItemDto extends StockSummaryScopeDto {
    itemId: string;
    runId?: string;
}
export declare class StockSummaryExportDto extends StockSummaryRowsDto {
    tab: ExportTab;
}
export {};
