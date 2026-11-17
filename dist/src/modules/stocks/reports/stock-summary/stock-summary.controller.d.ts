import { StockSummaryService } from './stock-summary.service';
import { StockSummaryBranchesDto, StockSummaryExportDto, StockSummaryGodownsDto, StockSummaryGroupsDto, StockSummaryItemDto, StockSummaryOptionsDto, StockSummaryQueryDto, StockSummaryRowsDto } from './dto/stock-summary-query.dto';
import type { BranchesPayload, ExportPayload, GodownsPayload, GroupsPayload, ItemPayload, OptionsPayload, RowsPayload, SummaryPayload } from './types/stock-summary.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class StockSummaryController {
    private readonly service;
    constructor(service: StockSummaryService);
    options(q: StockSummaryOptionsDto): Promise<Ok<OptionsPayload>>;
    show(q: StockSummaryQueryDto): Promise<Ok<SummaryPayload>>;
    rows(q: StockSummaryRowsDto): Promise<Ok<RowsPayload>>;
    item(q: StockSummaryItemDto): Promise<Ok<ItemPayload>>;
    groups(q: StockSummaryGroupsDto): Promise<Ok<GroupsPayload>>;
    godowns(q: StockSummaryGodownsDto): Promise<Ok<GodownsPayload>>;
    branches(q: StockSummaryBranchesDto): Promise<Ok<BranchesPayload>>;
    export(q: StockSummaryExportDto): Promise<Ok<ExportPayload>>;
}
export {};
