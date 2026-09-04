import { PrismaService } from '../../database/prisma/prisma.service';
import { PgService } from '../../database/pg/pg.service';
import { BuildConfiguredGridFilterSqlOptions, BuildConfiguredGridSearchSqlOptions, ConfiguredGridSqlCandidate, ConfiguredGridSqlValidationResult, GridColumnItem, LoadConfiguredGridSqlCandidatesOptions, RunConfiguredGridSqlPageOptions, RunConfiguredGridSqlPageResult, ValidateConfiguredGridSqlOptions } from './types/configured-grid-sql.types';
export type { ConfiguredGridListResult } from './types/configured-grid-sql.types';
export declare class ConfiguredGridSqlService {
    private readonly prisma;
    private readonly pg;
    constructor(prisma: PrismaService, pg: PgService);
    private normalizeRelationName;
    private buildTableNameSearchTerms;
    loadCandidates(options: LoadConfiguredGridSqlCandidatesOptions): Promise<ConfiguredGridSqlCandidate[]>;
    filterPrimaryFromTable(candidates: ConfiguredGridSqlCandidate[], tableName: string): ConfiguredGridSqlCandidate[];
    validateBaseSql(options: ValidateConfiguredGridSqlOptions): ConfiguredGridSqlValidationResult;
    runPagedQuery<TItem>(options: RunConfiguredGridSqlPageOptions): Promise<RunConfiguredGridSqlPageResult<TItem>>;
    assertBaseSqlExecutable(baseSql: string, alias: string): Promise<void>;
    loadGridColumns(gridId: bigint): Promise<GridColumnItem[]>;
    loadPrimaryGridStyles(tableName: string): Promise<GridColumnItem[] | undefined>;
    getSearchableFieldNames(gridId: bigint, baseSql: string): Promise<string[]>;
    deriveSearchableFieldNamesFromColumns(columns: Array<{
        filter: boolean;
        sqlFieldName: string | null;
        columnNumber: number;
        columnName: string;
    }>, baseSql: string): string[];
    private deriveSearchableFieldNames;
    buildSearchSql(options: BuildConfiguredGridSearchSqlOptions): {
        sql: string;
        params: unknown[];
    };
    buildFilterSql(options: BuildConfiguredGridFilterSqlOptions): {
        sql: string;
        params: unknown[];
    };
    bindGridParams(sql: string, prm: Record<string, unknown>): {
        sql: string;
        params: unknown[];
    };
    findUnboundParamTokens(sql: string): string[];
    parseCountValue(value: bigint | number | string | undefined): number;
    private serializeRawQueryValue;
    private prepareBaseSql;
    stripSqlComments(sql: string): string;
    extractTopLevelFromTableName(sql: string): string | null;
    private tokenizeSearchColumnName;
    private describeSearchColumnName;
    private getSearchColumnMatchScore;
    private extractSelectFieldNames;
    private extractTopLevelSelectClause;
    private splitTopLevelCommaSeparated;
    private extractSqlOutputFieldName;
    private extractTopLevelFromRelation;
    private parseSqlIdentifierToken;
    substituteGridPrm(sql: string, prm: Record<string, unknown>): string;
    private formatSqlLiteral;
    private escapeRegex;
}
