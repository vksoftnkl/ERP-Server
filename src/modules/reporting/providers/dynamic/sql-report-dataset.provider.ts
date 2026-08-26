import { InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueryResultRow } from 'pg';
import { PgService } from '../../../../database/pg/pg.service';
import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { toDateOnly, toIsoDateTime, toNumber, toText } from '../provider.utils';
import { synthesiseSampleRows } from './dataset-field.introspector';
import {
  RESERVED_DATASET_PARAMS,
  ReportDatasetDefinition,
  ReportDatasetParamSpec,
} from './report-dataset.types';

/**
 * One IReportDataProvider, driven by a stored definition instead of by code.
 *
 * There is exactly ONE of these classes for any number of datasets. A class per
 * dataset would put us back where we started — the point of the table is that a
 * new dataset is data, not a deploy.
 *
 * Everything downstream of the registry is unchanged: the layout engine, the
 * expression validator and all three renderers see a provider, and cannot tell
 * whether its rows came from Prisma in a compiled class or from a stored SELECT.
 */

const SAMPLE_ROW_COUNT = 3;

export class SqlReportDatasetProvider implements IReportDataProvider {
  private readonly logger = new Logger(SqlReportDatasetProvider.name);

  constructor(
    readonly definition: ReportDatasetDefinition,
    private readonly pg: PgService,
    private readonly configuredGridSql: ConfiguredGridSqlService,
  ) {}

  fields(): readonly FieldMeta[] {
    return this.definition.fields;
  }

  async resolve(context: ReportContext): Promise<ReportRow[] | ReportRow> {
    const rows = await this.runQuery(context);
    const coerced = rows.map((row) => this.coerceRow(row));

    if (this.definition.cardinality === 'one') {
      return coerced[0] ?? {};
    }
    return coerced;
  }

  sampleData(): ReportRow[] | ReportRow {
    const rows =
      this.definition.sampleRows && this.definition.sampleRows.length > 0
        ? this.definition.sampleRows.map((row) => ({ ...row }))
        : synthesiseSampleRows(this.definition.fields, SAMPLE_ROW_COUNT);

    return this.definition.cardinality === 'one' ? (rows[0] ?? {}) : rows;
  }

  /**
   * Bind, cap, run.
   *
   * Also used by the admin preview endpoint, which is why it is separate from
   * resolve(): an author wants the raw rows and the row count, not the display
   * coercion, when checking whether their WHERE clause is right.
   */
  async runQuery(context: ReportContext): Promise<QueryResultRow[]> {
    const { sql, params } = this.bind(context);

    try {
      const result = await this.pg.queryReadOnly(sql, params);
      return result.rows;
    } catch (error) {
      // Name the dataset. Without it the operator sees a bare Postgres message
      // with a $n that appears nowhere in the SQL anyone can read.
      const message = error instanceof Error ? error.message : String(error);
      const unbound = this.configuredGridSql.findUnboundParamTokens(this.definition.sql);
      const hint =
        unbound.length > 0
          ? ` Unbound token(s) still in the SQL: ${unbound.join(', ')}.`
          : '';

      this.logger.error(
        `Dataset '${this.definition.token}' failed: ${message}${hint}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        `Report dataset '${this.definition.token}' failed to execute: ${message}${hint}`,
      );
    }
  }

  /**
   * Substitute every p_* token with a bound $n parameter.
   *
   * The reserved tokens are applied FIRST and from the context, never from
   * `context.params`. That ordering is the whole tenant guarantee: by the time
   * caller-supplied values are considered, p_company_id has already been
   * consumed and replaced by a $n, so a params entry named `p_company_id`
   * has nothing left to bind to.
   */
  private bind(context: ReportContext): { sql: string; params: unknown[] } {
    const values: Record<string, unknown> = {};

    for (const [token, contextKey] of Object.entries(RESERVED_DATASET_PARAMS)) {
      values[token] = context[contextKey] ?? null;
    }

    const supplied = context.params ?? {};
    for (const spec of this.definition.params) {
      values[spec.name] = this.resolveDeclaredParam(spec, supplied);
    }

    const bound = this.configuredGridSql.bindGridParams(this.definition.sql, values);

    // Cap in SQL rather than by slicing the result: the point is to stop
    // Postgres materialising a million rows, not to hide them afterwards.
    const limit = this.definition.cardinality === 'one' ? 1 : this.definition.maxRows;
    const sql = `SELECT * FROM (${bound.sql}) AS rds_rows LIMIT $${bound.params.length + 1}`;

    return { sql, params: [...bound.params, limit] };
  }

  private resolveDeclaredParam(
    spec: ReportDatasetParamSpec,
    supplied: Readonly<Record<string, unknown>>,
  ): unknown {
    const raw = supplied[spec.name] ?? spec.defaultValue ?? null;

    if (raw === null && spec.required) {
      throw new InternalServerErrorException(
        `Report dataset '${this.definition.token}' requires parameter '${spec.name}', ` +
          'which the template binding and the render request both omitted.',
      );
    }

    return this.coerceParam(spec, raw);
  }

  /**
   * Coerce a caller-supplied value to its declared type.
   *
   * Not cosmetic. A dataset filtering `sb_bill_date >= p_from_date` with a JS
   * Date bound as a timestamp behaves differently from the same value as a
   * date string, and a numeric id arriving as a string makes Postgres pick a
   * different plan or reject the comparison outright.
   */
  private coerceParam(spec: ReportDatasetParamSpec, value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    switch (spec.type) {
      case 'integer':
        return Math.trunc(toNumber(value as number | string));
      case 'number':
        return toNumber(value as number | string);
      case 'boolean':
        return typeof value === 'boolean' ? value : /^(true|1|yes|y)$/i.test(String(value));
      case 'date':
        return toDateOnly(value as Date | string);
      default:
        // string and uuid alike: Postgres casts a text literal to uuid on
        // comparison, and letting it do so beats parsing uuids here.
        return String(value);
    }
  }

  /**
   * Turn driver values into display-ready scalars, using the introspected type.
   *
   * node-pg hands back `numeric` as a STRING and `timestamptz` as a Date, and
   * both survive a jexl expression as something no invoice should print — the
   * exact problem provider.utils exists to solve for the compiled providers.
   * The only difference here is that the type comes from rds_fields rather than
   * from a developer reading the Prisma model.
   */
  private coerceRow(row: QueryResultRow): ReportRow {
    const out: ReportRow = {};
    const typed = new Set<string>();

    for (const field of this.definition.fields) {
      typed.add(field.name);
      const value = row[field.name];

      switch (field.type) {
        case 'number':
          out[field.name] = toNumber(value as Prisma.Decimal | number | string | null);
          break;
        case 'integer':
          out[field.name] = Math.trunc(toNumber(value as number | string | null));
          break;
        case 'boolean':
          out[field.name] = value === null || value === undefined ? false : Boolean(value);
          break;
        case 'date':
          out[field.name] = toDateOnly(value as Date | string | null);
          break;
        case 'datetime':
          out[field.name] = toIsoDateTime(value as Date | string | null);
          break;
        case 'object':
          out[field.name] = value ?? null;
          break;
        default:
          out[field.name] = toText(value);
      }
    }

    // A column the stored fields do not describe — the SQL was edited and the
    // fields were not re-introspected. Pass it through as text rather than drop
    // it: a visible wrong-looking value beats a field that silently vanishes.
    for (const [key, value] of Object.entries(row)) {
      if (!typed.has(key)) {
        out[key] = typeof value === 'bigint' ? value.toString() : toText(value);
      }
    }

    return out;
  }
}
