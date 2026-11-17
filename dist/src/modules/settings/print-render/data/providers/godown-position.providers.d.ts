import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { GodownPositionQueryDto } from '../../../../stocks/reports/godown-position/dto/godown-position-query.dto';
import { GodownPositionService } from '../../../../stocks/reports/godown-position/godown-position.service';
import type { PositionExportPayload, PositionRow } from '../../../../stocks/reports/godown-position/types/godown-position.types';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare function positionHeadRow(data: PositionExportPayload, printedBy: string | null, at: Date): PrintRow;
export declare function positionPrintRow(r: PositionRow, index: number): PrintRow;
export declare class GodownPositionPrintSource {
    private readonly position;
    private readonly prisma;
    private readonly runs;
    constructor(position: GodownPositionService, prisma: PrismaService);
    query(request: ProviderRequest): Promise<GodownPositionQueryDto>;
    data(request: ProviderRequest): Promise<PositionExportPayload>;
    printedBy(userId: string | null): Promise<string | null>;
}
export declare class GodownPositionHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.godown_position.head";
    readonly label = "Godown Stock Position \u2014 heading, tiles, kg totals and tie";
    readonly cardinality: "one";
    constructor(source: GodownPositionPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class GodownPositionRowsProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.godown_position.rows";
    readonly label = "Godown Stock Position \u2014 one row per item \u00D7 godown, as the grid (also the count sheet)";
    readonly cardinality: "many";
    constructor(source: GodownPositionPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare const GODOWN_POSITION_PRINT_PROVIDERS: readonly [typeof GodownPositionHeadProvider, typeof GodownPositionRowsProvider];
