import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { ItemLedgerExportDto } from '../../../../stocks/reports/item-ledger/dto/item-ledger-query.dto';
import { ItemLedgerService } from '../../../../stocks/reports/item-ledger/item-ledger.service';
import type { ExportPayload, LedgerRow } from '../../../../stocks/reports/item-ledger/types/item-ledger.types';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class ItemLedgerPrintSource {
    private readonly ledger;
    private readonly prisma;
    constructor(ledger: ItemLedgerService, prisma: PrismaService);
    query(request: ProviderRequest): Promise<ItemLedgerExportDto>;
    rows(request: ProviderRequest): Promise<ExportPayload>;
    printedBy(userId: string | null): Promise<string | null>;
}
export declare class ItemLedgerHeadProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.item_ledger.head";
    readonly label = "Item Ledger \u2014 heading, opening, totals and closing";
    readonly cardinality: "one";
    constructor(source: ItemLedgerPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class ItemLedgerRowsProvider implements PrintDataProvider {
    private readonly source;
    readonly code = "reports.item_ledger.rows";
    readonly label = "Item Ledger \u2014 one row per voucher line group, posting order";
    readonly cardinality: "many";
    constructor(source: ItemLedgerPrintSource);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare function headRow(data: ExportPayload, printedBy: string | null, at: Date): PrintRow;
export declare function ledgerPrintRow(row: LedgerRow, index: number): PrintRow;
export declare const ITEM_LEDGER_PRINT_PROVIDERS: readonly [typeof ItemLedgerHeadProvider, typeof ItemLedgerRowsProvider];
