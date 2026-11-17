import { PgService } from "../../../../../database/pg/pg.service";
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class SaleReturnHeaderProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "sales.return.header";
    readonly label = "Sale return (credit note) \u2014 header";
    readonly cardinality: "one";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class SaleReturnItemsProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "sales.return.items";
    readonly label = "Sale return (credit note) \u2014 lines";
    readonly cardinality: "many";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class SaleReturnTaxSummaryProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "sales.return.tax_summary";
    readonly label = "Sale return (credit note) \u2014 HSN / tax summary";
    readonly cardinality: "many";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare const SALE_RETURN_PRINT_PROVIDERS: (typeof SaleReturnHeaderProvider | typeof SaleReturnItemsProvider | typeof SaleReturnTaxSummaryProvider)[];
