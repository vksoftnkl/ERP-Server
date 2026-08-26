import { QueryResultRow } from 'pg';
import { PgService } from '../../../../database/pg/pg.service';
import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import { FieldMeta, IReportDataProvider, ReportContext, ReportRow } from '../report-data-provider.types';
import { ReportDatasetDefinition } from './report-dataset.types';
export declare class SqlReportDatasetProvider implements IReportDataProvider {
    readonly definition: ReportDatasetDefinition;
    private readonly pg;
    private readonly configuredGridSql;
    private readonly logger;
    constructor(definition: ReportDatasetDefinition, pg: PgService, configuredGridSql: ConfiguredGridSqlService);
    fields(): readonly FieldMeta[];
    resolve(context: ReportContext): Promise<ReportRow[] | ReportRow>;
    sampleData(): ReportRow[] | ReportRow;
    runQuery(context: ReportContext): Promise<QueryResultRow[]>;
    private bind;
    private resolveDeclaredParam;
    private coerceParam;
    private coerceRow;
}
