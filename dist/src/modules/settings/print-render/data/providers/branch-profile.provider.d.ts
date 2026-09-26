import { PgService } from "../../../../../database/pg/pg.service";
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class BranchProfileProvider implements PrintDataProvider {
    private readonly pg;
    readonly code = "branch.profile";
    readonly label = "Branch address";
    readonly cardinality: "one";
    constructor(pg: PgService);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
