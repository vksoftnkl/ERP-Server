import { PgService } from "../../../../../database/pg/pg.service";
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class CompanyProfileProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "company.profile";
    readonly label = "Company letterhead";
    readonly cardinality: "one";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
