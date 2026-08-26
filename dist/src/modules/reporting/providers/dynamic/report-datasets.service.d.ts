import { ReportDataset } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import { PgService } from '../../../../database/pg/pg.service';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { FieldMeta, ReportRow } from '../report-data-provider.types';
import { DynamicDatasetSource } from './dynamic-dataset.source';
import { ReportDatasetSqlValidator } from './report-dataset-sql.validator';
import { DatasetProbeResult } from './report-dataset.types';
import { CreateReportDatasetDto, PreviewReportDatasetDto, ProbeReportDatasetDto, UpdateReportDatasetDto } from './dto/report-dataset-request.dto';
export declare class ReportDatasetsService {
    private readonly prisma;
    private readonly pg;
    private readonly requestContext;
    private readonly validator;
    private readonly configuredGridSql;
    private readonly source;
    private readonly logger;
    constructor(prisma: PrismaService, pg: PgService, requestContext: RequestContextService, validator: ReportDatasetSqlValidator, configuredGridSql: ConfiguredGridSqlService, source: DynamicDatasetSource);
    findAll(includeInactive?: boolean): Promise<ReportDataset[]>;
    findOne(id: string): Promise<ReportDataset>;
    probe(dto: ProbeReportDatasetDto): Promise<DatasetProbeResult>;
    create(dto: CreateReportDatasetDto): Promise<ReportDataset>;
    update(id: string, dto: UpdateReportDatasetDto): Promise<ReportDataset>;
    remove(id: string, force?: boolean): Promise<{
        rdsId: string;
        rdsToken: string;
    }>;
    findTemplatesUsing(token: string): Promise<Array<{
        pt_id: string;
        pt_name: string;
    }>>;
    preview(id: string, dto: PreviewReportDatasetDto): Promise<{
        rows: ReportRow[];
        rowCount: number;
        fields: readonly FieldMeta[];
    }>;
    private validateAndIntrospect;
    private assertTokenAvailable;
    private normaliseParams;
    private normaliseFieldOverrides;
    private normaliseSampleRows;
    private toDefinition;
    private requireCompanyId;
}
