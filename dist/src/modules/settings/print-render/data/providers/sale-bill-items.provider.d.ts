import { PgService } from "../../../../../database/pg/pg.service";
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class SaleBillItemsProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "sales.bill.items";
    readonly label = "Sale bill \u2014 lines";
    readonly cardinality: "many";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
