import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { StockSummaryQueryDto, StockSummaryViewDto } from '../../../../stocks/reports/stock-summary/dto/stock-summary-query.dto';
import { StockSummaryService } from '../../../../stocks/reports/stock-summary/stock-summary.service';
import type { ExportPayload, SummaryRow } from '../../../../stocks/reports/stock-summary/types/stock-summary.types';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class StockSummaryPrintSource {
    private readonly summary;
    private readonly prisma;
    constructor(summary: StockSummaryService, prisma: PrismaService);
    query(request: ProviderRequest): Promise<StockSummaryQueryDto | null>;
    view(request: ProviderRequest): Promise<StockSummaryViewDto>;
    data(request: ProviderRequest): Promise<ExportPayload>;
    printedBy(userId: string | null): Promise<string | null>;
}
export declare class StockSummaryHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.stock_summary.head";
    readonly label = "Stock Summary \u2014 heading, totals, transit and tie";
    readonly cardinality: "one";
    constructor(source: StockSummaryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class StockSummaryRowsProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.stock_summary.rows";
    readonly label = "Stock Summary \u2014 one row per item, as the Item-wise grid";
    readonly cardinality: "many";
    constructor(source: StockSummaryPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare function summaryHeadRow(data: ExportPayload, printedBy: string | null, at: Date): PrintRow;
export declare function summaryPrintRow(row: SummaryRow, index: number, todayOnly: boolean): PrintRow;
export declare const STOCK_SUMMARY_PRINT_PROVIDERS: readonly [typeof StockSummaryHeadProvider, typeof StockSummaryRowsProvider];
