import { PgService } from "../../../../../database/pg/pg.service";
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class SaleBillHeaderProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "sales.bill.header";
    readonly label = "Sale bill \u2014 header";
    readonly cardinality: "one";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
