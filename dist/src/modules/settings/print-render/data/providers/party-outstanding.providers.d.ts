import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { OutstandingExportDto } from '../../../../reports/party-outstanding/dto/party-outstanding-query.dto';
import { PartyOutstandingService } from '../../../../reports/party-outstanding/party-outstanding.service';
import type { PartiesExportPayload } from '../../../../reports/party-outstanding/types/party-outstanding.types';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class PartyOutstandingPrintSource {
    private readonly outstanding;
    private readonly prisma;
    constructor(outstanding: PartyOutstandingService, prisma: PrismaService);
    query(request: ProviderRequest): Promise<OutstandingExportDto>;
    parties(request: ProviderRequest): Promise<{
        q: OutstandingExportDto;
        data: PartiesExportPayload;
    }>;
    printedBy(userId: string | null): Promise<string | null>;
}
export declare class PartyOutstandingHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.party_outstanding.head";
    readonly label = "Party-wise Outstanding \u2014 heading, totals and tiles";
    readonly cardinality: "one";
    constructor(source: PartyOutstandingPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class PartyOutstandingPartiesProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.party_outstanding.parties";
    readonly label = "Party-wise Outstanding \u2014 one row per party";
    readonly cardinality: "many";
    constructor(source: PartyOutstandingPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare const PARTY_OUTSTANDING_PRINT_PROVIDERS: readonly [typeof PartyOutstandingHeadProvider, typeof PartyOutstandingPartiesProvider];
