import { PgService } from '../../../database/pg/pg.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { LookupModuleKey, NameIdOption } from '../types/master-lookup-api.types';
import { DropdownLookupConfig } from '../types/master-lookup-internal.types';
export declare class ConfiguredDropdownLookup {
    private readonly prisma;
    private readonly pg;
    constructor(prisma: PrismaService, pg: PgService);
    loadConfigsByModule(): Promise<Map<LookupModuleKey, DropdownLookupConfig>>;
    loadConfigById(dropdownId: number): Promise<DropdownLookupConfig | null>;
    fetchItems(config: DropdownLookupConfig): Promise<NameIdOption[] | null>;
    private findRecordForModule;
    private toConfig;
    private mapRowsToOptions;
    private mapRowToOption;
    private compareRows;
}
