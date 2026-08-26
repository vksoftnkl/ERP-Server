import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportDataset } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import { PgService } from '../../../../database/pg/pg.service';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { FieldMeta, ReportContext, ReportRow } from '../report-data-provider.types';
import { DynamicDatasetSource } from './dynamic-dataset.source';
import { findDuplicateColumns, introspectFields } from './dataset-field.introspector';
import { ReportDatasetSqlValidator } from './report-dataset-sql.validator';
import { SqlReportDatasetProvider } from './sql-report-dataset.provider';
import {
  DatasetProbeResult,
  RESERVED_DATASET_PARAMS,
  ReportDatasetDefinition,
  ReportDatasetParamSpec,
} from './report-dataset.types';
import {
  CreateReportDatasetDto,
  PreviewReportDatasetDto,
  ProbeReportDatasetDto,
  ReportDatasetParamDto,
  UpdateReportDatasetDto,
} from './dto/report-dataset-request.dto';

/**
 * Authoring, validating and storing runtime datasets.
 *
 * The load-bearing decision in here is that NOTHING IS STORED THAT HAS NOT RUN.
 * Every create and every update probes the query against the live database
 * before the row is written. That is what turns three separate failure modes —
 * a syntax error, a column that does not exist, a token that binds nothing —
 * from a 500 at a customer's counter into a 400 in the admin screen, and it is
 * also where the field metadata comes from, so the two cannot drift apart.
 */
@Injectable()
export class ReportDatasetsService {
  private readonly logger = new Logger(ReportDatasetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pg: PgService,
    private readonly requestContext: RequestContextService,
    private readonly validator: ReportDatasetSqlValidator,
    private readonly configuredGridSql: ConfiguredGridSqlService,
    private readonly source: DynamicDatasetSource,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────────────

  async findAll(includeInactive = false): Promise<ReportDataset[]> {
    return this.prisma.reportDataset.findMany({
      where: {
        rdsIsDeleted: false,
        ...(includeInactive ? {} : { rdsIsActive: true }),
      },
      orderBy: { rdsToken: 'asc' },
    });
  }

  async findOne(id: string): Promise<ReportDataset> {
    const row = await this.prisma.reportDataset.findFirst({
      where: { rdsId: id, rdsIsDeleted: false },
    });
    if (!row) {
      throw new NotFoundException(`Report dataset ${id} not found`);
    }
    return row;
  }

  // ─── Authoring ─────────────────────────────────────────────────────────

  /**
   * Validate and introspect without storing — what the admin screen calls while
   * the author is still typing.
   */
  async probe(dto: ProbeReportDatasetDto): Promise<DatasetProbeResult> {
    const params = this.normaliseParams(dto.rdsParams);
    return this.validateAndIntrospect(dto.rdsSql, params, []);
  }

  async create(dto: CreateReportDatasetDto): Promise<ReportDataset> {
    const token = dto.rdsToken.trim();
    this.validator.assertValidToken(token);
    await this.assertTokenAvailable(token, null);

    const params = this.normaliseParams(dto.rdsParams);
    const probe = await this.validateAndIntrospect(
      dto.rdsSql,
      params,
      this.normaliseFieldOverrides(dto.rdsFieldOverrides),
    );

    const userId = this.requestContext.getUserId();
    const created = await this.prisma.reportDataset.create({
      data: {
        rdsToken: token,
        rdsLabel: dto.rdsLabel,
        rdsCardinality: dto.rdsCardinality,
        rdsDocTypes: dto.rdsDocTypes ?? [],
        rdsSql: probe.normalizedSql,
        rdsParams: params as unknown as Prisma.InputJsonValue,
        rdsFields: probe.fields as unknown as Prisma.InputJsonValue,
        rdsSampleRows: this.normaliseSampleRows(dto.rdsSampleRows, probe.fields),
        rdsMaxRows: dto.rdsMaxRows ?? 5000,
        rdsNotes: dto.rdsNotes ?? null,
        rdsIsActive: dto.rdsIsActive ?? true,
        rdsCreatedBy: userId,
      },
    });

    await this.source.invalidate();
    this.logger.log(`Report dataset '${token}' created with ${probe.fields.length} field(s)`);
    return created;
  }

  /**
   * Update re-probes even when the SQL is untouched.
   *
   * The query is not the only thing that can change under a dataset: a column
   * renamed by a migration, a view redefined, a type widened from int to
   * numeric all change what the SAME text returns. Re-introspecting on every
   * save is the cheapest way to keep rds_fields honest, and an update is rare.
   */
  async update(id: string, dto: UpdateReportDatasetDto): Promise<ReportDataset> {
    const existing = await this.findOne(id);

    const params =
      dto.rdsParams === undefined
        ? ((existing.rdsParams as unknown as ReportDatasetParamSpec[] | null) ?? [])
        : this.normaliseParams(dto.rdsParams);

    const sql = dto.rdsSql ?? existing.rdsSql;
    const overrides =
      dto.rdsFieldOverrides === undefined
        ? ((existing.rdsFields as unknown as FieldMeta[] | null) ?? [])
        : this.normaliseFieldOverrides(dto.rdsFieldOverrides);

    const probe = await this.validateAndIntrospect(sql, params, overrides);

    const updated = await this.prisma.reportDataset.update({
      where: { rdsId: id },
      data: {
        ...(dto.rdsLabel !== undefined ? { rdsLabel: dto.rdsLabel } : {}),
        ...(dto.rdsCardinality !== undefined ? { rdsCardinality: dto.rdsCardinality } : {}),
        ...(dto.rdsDocTypes !== undefined ? { rdsDocTypes: dto.rdsDocTypes } : {}),
        ...(dto.rdsMaxRows !== undefined ? { rdsMaxRows: dto.rdsMaxRows } : {}),
        ...(dto.rdsNotes !== undefined ? { rdsNotes: dto.rdsNotes } : {}),
        ...(dto.rdsIsActive !== undefined ? { rdsIsActive: dto.rdsIsActive } : {}),
        ...(dto.rdsSampleRows !== undefined
          ? { rdsSampleRows: this.normaliseSampleRows(dto.rdsSampleRows, probe.fields) }
          : {}),
        rdsSql: probe.normalizedSql,
        rdsParams: params as unknown as Prisma.InputJsonValue,
        rdsFields: probe.fields as unknown as Prisma.InputJsonValue,
        rdsVersion: { increment: 1 },
        rdsModifiedOn: new Date(),
        rdsModifiedBy: this.requestContext.getUserId(),
      },
    });

    await this.source.invalidate();
    return updated;
  }

  /**
   * Soft delete, refused while a template still binds the token.
   *
   * A template that references a missing dataset does not fail at save time —
   * it was valid when it was saved. It fails at PRINT time, which is the worst
   * moment to discover it, so the check happens here where the operator can
   * still choose differently.
   */
  async remove(id: string, force = false): Promise<{ rdsId: string; rdsToken: string }> {
    const existing = await this.findOne(id);
    const users = await this.findTemplatesUsing(existing.rdsToken);

    if (users.length > 0 && !force) {
      throw new ConflictException(
        `Report dataset '${existing.rdsToken}' is still bound by ${users.length} template(s): ` +
          `${users.map((template) => template.pt_name).join(', ')}. ` +
          'Rebind or delete those templates first, or repeat with force=true to delete anyway ' +
          '— they will then fail at print time.',
      );
    }

    await this.prisma.reportDataset.update({
      where: { rdsId: id },
      data: {
        rdsIsDeleted: true,
        rdsIsActive: false,
        rdsModifiedOn: new Date(),
        rdsModifiedBy: this.requestContext.getUserId(),
      },
    });

    await this.source.invalidate();
    return { rdsId: id, rdsToken: existing.rdsToken };
  }

  /** Templates that bind a token, found by jsonb containment on the definition. */
  async findTemplatesUsing(token: string): Promise<Array<{ pt_id: string; pt_name: string }>> {
    return this.prisma.$queryRaw<Array<{ pt_id: string; pt_name: string }>>`
      SELECT pt_id, pt_name
      FROM reports.print_template
      WHERE NOT pt_is_deleted
        AND pt_definition -> 'datasets' @> ${JSON.stringify([{ provider: token }])}::jsonb
      ORDER BY pt_name
    `;
  }

  // ─── Preview ───────────────────────────────────────────────────────────

  /**
   * Run a stored dataset for real, against the caller's own company.
   *
   * Deliberately NOT a way to run arbitrary SQL: it takes an id, and the SQL it
   * runs is the row's, already validated. The company is the caller's own from
   * the request context, never a parameter — a vendor admin previewing a
   * dataset sees their own tenant's rows, the same as any other user would.
   */
  async preview(
    id: string,
    dto: PreviewReportDatasetDto,
  ): Promise<{ rows: ReportRow[]; rowCount: number; fields: readonly FieldMeta[] }> {
    const row = await this.findOne(id);
    const companyId = this.requireCompanyId();

    const definition = this.toDefinition(row);
    const provider = new SqlReportDatasetProvider(
      { ...definition, maxRows: Math.min(dto.limit ?? 20, 100), cardinality: 'many' },
      this.pg,
      this.configuredGridSql,
    );

    const context: ReportContext = {
      companyId,
      branchId: dto.branchId ?? null,
      accYear: dto.accYear,
      docId: dto.docId ?? '',
      userId: this.requestContext.getUserId(),
      params: dto.params ?? {},
    };

    const rows = (await provider.resolve(context)) as ReportRow[];
    return { rows, rowCount: rows.length, fields: definition.fields };
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  /**
   * Validate the SQL, then run it with WHERE false to learn its columns.
   *
   * The probe binds the caller's REAL company id rather than a null, for two
   * reasons: the query is proven to execute under the same scoping every print
   * will use, and Postgres gets a concrete value to infer parameter types from
   * where a bare NULL would sometimes leave it unable to.
   */
  private async validateAndIntrospect(
    sql: string,
    params: readonly ReportDatasetParamSpec[],
    overrides: readonly FieldMeta[],
  ): Promise<DatasetProbeResult> {
    this.validator.assertValidParamSpecs(params);
    const validated = this.validator.validate({ sql, params });

    const values: Record<string, unknown> = {
      p_company_id: this.requireCompanyId(),
      p_branch_id: null,
      p_acc_year: null,
      p_doc_id: null,
      p_user_id: this.requestContext.getUserId(),
    };
    for (const param of params) {
      values[param.name] = param.defaultValue ?? null;
    }

    const bound = this.configuredGridSql.bindGridParams(validated.normalizedSql, values);
    const probeSql = `SELECT * FROM (${bound.sql}) AS rds_probe WHERE false`;

    let descriptors;
    try {
      const result = await this.pg.queryReadOnly(probeSql, bound.params);
      descriptors = result.fields;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const unbound = this.configuredGridSql.findUnboundParamTokens(validated.normalizedSql);
      throw new BadRequestException(
        `Dataset query failed to execute: ${message}` +
          (unbound.length > 0 ? ` Unbound token(s): ${unbound.join(', ')}.` : ''),
      );
    }

    const duplicates = findDuplicateColumns(descriptors);
    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Query returns duplicate column name(s): ${duplicates.join(', ')}. ` +
          'A template referencing one of these would silently get whichever column the ' +
          'driver wrote last — alias them apart.',
      );
    }

    const fields = introspectFields(descriptors, overrides);
    if (fields.length === 0) {
      throw new BadRequestException('Query returns no columns — there is nothing to bind.');
    }

    return {
      normalizedSql: validated.normalizedSql,
      fields,
      reservedParamsUsed: validated.reservedParamsUsed,
    };
  }

  private async assertTokenAvailable(token: string, excludeId: string | null): Promise<void> {
    const clash = await this.prisma.reportDataset.findFirst({
      where: {
        rdsIsDeleted: false,
        rdsToken: { equals: token, mode: 'insensitive' },
        ...(excludeId ? { NOT: { rdsId: excludeId } } : {}),
      },
      select: { rdsId: true, rdsToken: true },
    });

    if (clash) {
      throw new ConflictException(`Report dataset token '${clash.rdsToken}' already exists`);
    }
  }

  private normaliseParams(params: readonly ReportDatasetParamDto[] = []): ReportDatasetParamSpec[] {
    return params.map((param) => ({
      name: param.name.trim().toLowerCase(),
      type: param.type,
      required: param.required === true,
      ...(param.label ? { label: param.label } : {}),
      ...(param.defaultValue !== undefined ? { defaultValue: param.defaultValue } : {}),
    }));
  }

  /**
   * Keep only the parts of a field override an author is allowed to set.
   *
   * `type` is filtered out rather than rejected: it always comes from the query,
   * and an author sending the introspected shape straight back (which the admin
   * screen does) should not have to strip it first.
   */
  private normaliseFieldOverrides(
    overrides: ReadonlyArray<Record<string, unknown>> = [],
  ): FieldMeta[] {
    return overrides
      .filter((entry) => typeof entry.name === 'string' && entry.name !== '')
      .map((entry) => ({
        name: String(entry.name),
        // Placeholder — introspectFields replaces it with the real type.
        type: 'string' as const,
        label: typeof entry.label === 'string' ? entry.label : String(entry.name),
        ...(typeof entry.format === 'string' ? { format: entry.format } : {}),
        ...(entry.complexScript === true ? { complexScript: true } : {}),
        ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
      }));
  }

  /** Sample rows are trimmed to the known columns, so a stale key cannot linger. */
  private normaliseSampleRows(
    rows: ReadonlyArray<Record<string, unknown>> | undefined,
    fields: readonly FieldMeta[],
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (rows === undefined || rows.length === 0) {
      return Prisma.JsonNull;
    }

    const known = new Set(fields.map((field) => field.name));
    const trimmed = rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => known.has(key))),
    );

    return trimmed as unknown as Prisma.InputJsonValue;
  }

  private toDefinition(row: ReportDataset): ReportDatasetDefinition {
    return {
      id: row.rdsId,
      token: row.rdsToken,
      label: row.rdsLabel,
      cardinality: row.rdsCardinality === 'one' ? 'one' : 'many',
      docTypes: row.rdsDocTypes,
      sql: row.rdsSql,
      params: (row.rdsParams as unknown as ReportDatasetParamSpec[] | null) ?? [],
      fields: (row.rdsFields as unknown as FieldMeta[] | null) ?? [],
      sampleRows: (row.rdsSampleRows as unknown as ReportRow[] | null) ?? null,
      maxRows: row.rdsMaxRows,
      version: row.rdsVersion,
    };
  }

  private requireCompanyId(): string {
    const companyId = this.requestContext.getCompanyId();
    if (!companyId) {
      throw new BadRequestException(
        'No company in the request context. A dataset is validated and previewed against a ' +
          `real company because ${Object.keys(RESERVED_DATASET_PARAMS)[0]} must bind to something.`,
      );
    }
    return companyId;
  }
}
