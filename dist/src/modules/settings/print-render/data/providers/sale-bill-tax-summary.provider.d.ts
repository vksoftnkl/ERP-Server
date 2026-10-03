import { PgService } from "../../../../../database/pg/pg.service";
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class SaleBillTaxSummaryProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "sales.bill.tax_summary";
    readonly label = "Sale bill \u2014 HSN / tax summary";
    readonly cardinality: "many";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
