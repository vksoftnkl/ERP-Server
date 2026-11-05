import { PgService } from "../../../../../database/pg/pg.service";
import { PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare function providerQuery(pg: PgService, sql: string, params: readonly unknown[]): Promise<PrintRow[]>;
export declare function requireDocument(request: ProviderRequest, providerCode: string): {
    docId: string;
    accYear: string;
};
