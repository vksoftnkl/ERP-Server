import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import type { StockSummaryBranchesDto, StockSummaryExportDto, StockSummaryGodownsDto, StockSummaryGroupsDto, StockSummaryItemDto, StockSummaryOptionsDto, StockSummaryQueryDto, StockSummaryRowsDto, StockSummaryViewDto } from './dto/stock-summary-query.dto';
import { StockSummaryRunStore } from './stock-summary-run.store';
import { type ItemRunRow, type TransitDbRow, type ViewSpec } from './stock-summary.rules';
import { type BranchesPayload, type ExportPayload, type GodownsPayload, type GroupsPayload, type ItemPayload, type OptionsPayload, type RowsPayload, type SummaryPayload, type TransitOut } from './types/stock-summary.types';
type Dec = Prisma.Decimal;
export declare class StockSummaryService {
    private readonly prisma;
    private readonly requestContext;
    private readonly runs;
    private readonly printRuns;
    constructor(prisma: PrismaService, requestContext: RequestContextService, runs: StockSummaryRunStore);
    options(q: StockSummaryOptionsDto): Promise<OptionsPayload>;
    show(q: StockSummaryQueryDto): Promise<SummaryPayload>;
    private itemsAnswer;
    rows(q: StockSummaryRowsDto): Promise<RowsPayload>;
    groups(q: StockSummaryGroupsDto): Promise<GroupsPayload>;
    godowns(q: StockSummaryGodownsDto): Promise<GodownsPayload>;
    branches(q: StockSummaryBranchesDto): Promise<BranchesPayload>;
    private branchesAnswer;
    item(q: StockSummaryItemDto): Promise<ItemPayload>;
    export(q: StockSummaryExportDto): Promise<ExportPayload>;
    private exportItems;
    private exportBranches;
    printData(input: {
        runId: string | null;
        query: StockSummaryQueryDto | null;
        view?: StockSummaryViewDto | null;
    }): Promise<ExportPayload>;
    private printRun;
    private buildItemsRun;
    private headOf;
    private headNow;
    private userId;
    private assertView;
    private assertAlso;
    private gone;
    private runOf;
    private itemRunOf;
    private snapshot;
    private moment;
    private fiscalYear;
    private lookup;
    private resolve;
}
export declare function assertRange(from: string, to: string): void;
export declare function assertItemCap(items: number): void;
export declare function capRows(n: number): void;
export declare function transitOutOf(rows: readonly TransitDbRow[], todayOnly: boolean): TransitOut;
export declare function godownTab(run: {
    rows: readonly ItemRunRow[];
    branchGodowns: readonly {
        godownId: string;
        name: string;
    }[];
}, view: ViewSpec): {
    columns: {
        godownId: string;
        name: string;
    }[];
    rows: ItemRunRow[];
};
interface LotIn {
    godownId: string;
    godownName: string | null;
    bucket: string;
    lotId: string;
    batchNo: string | null;
    mrp: string | null;
    expiry: string | null;
    supplier: string | null;
    onHand: Dec;
    reserved: Dec | null;
    available: Dec | null;
    rate: Dec;
    value: Dec;
    inScope: boolean;
}
export declare function lotsBlock(source: 'STOCK_BALANCE' | 'LEDGER', asOf: string, rows: readonly LotIn[], factor: Dec): ItemPayload['lots'];
export {};
