import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportDataset } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import { PgService } from '../../../../database/pg/pg.service';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { FieldMeta, ProviderDescriptor, ReportRow } from '../report-data-provider.types';
import { SqlReportDatasetProvider } from './sql-report-dataset.provider';
import { ReportDatasetDefinition, ReportDatasetParamSpec } from './report-dataset.types';

/**
 * The in-memory index of runtime datasets.
 *
 * ── Why it is a warm cache and not a lookup ─────────────────────────────────
 * ReportDataProviderRegistry.get() is SYNCHRONOUS, and it is called from inside
 * the render path and from the designer catalogue. Making it async to reach the
 * database would ripple through the render service, the templates service and
 * every caller of both — for a table that changes a few times a month and is
 * read on every print. So definitions are loaded whole at boot and kept.
 *
 * ── Why there is a poll ─────────────────────────────────────────────────────
 * The app runs under PM2 in cluster mode. An admin's save lands on ONE worker;
 * the others would serve a stale definition until restart. invalidate() handles
 * the worker that took the write, and the probe below — a single aggregate over
 * a partial index — is what makes the rest converge. It compares a signature
 * (count, max version, max timestamp) rather than reloading blindly, so the
 * steady-state cost is one cheap query per worker per interval.
 *
 * Redis pub/sub would make this instant instead of eventually-consistent. It is
 * the right upgrade if dataset edits ever become frequent; at a few edits a
 * month, a 30-second convergence is not worth another moving part.
 */

const DEFAULT_REFRESH_MS = 30_000;

@Injectable()
export class DynamicDatasetSource implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicDatasetSource.name);

  /** Keyed by LOWERCASE token — the unique index is on lower(rds_token). */
  private providers = new Map<string, SqlReportDatasetProvider>();

  private descriptors = new Map<string, ProviderDescriptor>();

  private signature = '';

  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pg: PgService,
    private readonly configuredGridSql: ConfiguredGridSqlService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // The warm load must NOT be able to abort the bootstrap.
    //
    // It threw once for a real and entirely ordinary reason: the app started
    // against a database where reports.report_dataset did not exist yet, which
    // is the state of every deployment between a code release and its migration
    // — and of any working tree that pulls this branch without migrating. A
    // throw here is raised from onModuleInit, so Nest aborts, and the whole
    // server dies over an empty optional table. Sales, purchase, stock and the
    // seven compiled report providers do not need this table to work.
    //
    // So a failed load degrades to zero runtime datasets. A template that binds
    // one then fails at print with 'Unknown report dataset provider', which is
    // both accurate and survivable; everything else is unaffected.
    let loaded = true;
    try {
      await this.refresh();
    } catch (error) {
      loaded = false;
      this.logger.error(
        'Runtime report datasets could not be loaded — serving none. ' +
          'Templates binding a custom.* dataset will fail at print time until this clears. ' +
          `Cause: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const intervalMs = Number(
      this.config.get<string | number>('REPORT_DATASET_REFRESH_MS') ?? DEFAULT_REFRESH_MS,
    );

    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.logger.log('Runtime dataset refresh polling disabled');
      if (!loaded) {
        // Nothing will retry, so say plainly what has to happen.
        this.logger.error(
          'Polling is disabled and the initial load failed: runtime datasets stay empty for ' +
            'the life of this process. Apply pending migrations and restart.',
        );
      }
      return;
    }

    this.timer = setInterval(() => {
      void this.refreshIfChanged();
    }, intervalMs);
    // Never hold the process open for a cache refresh.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  has(token: string): boolean {
    return this.providers.has(token.toLowerCase());
  }

  get(token: string): SqlReportDatasetProvider | undefined {
    return this.providers.get(token.toLowerCase());
  }

  list(docType?: string): ProviderDescriptor[] {
    const all = [...this.descriptors.values()];
    if (docType === undefined) {
      return all;
    }
    return all.filter(
      (descriptor) => descriptor.docTypes.length === 0 || descriptor.docTypes.includes(docType),
    );
  }

  listTokens(): string[] {
    return [...this.providers.keys()];
  }

  /** Called by the admin service after any write, so THIS worker is never stale. */
  async invalidate(): Promise<void> {
    await this.refresh();
  }

  private async refreshIfChanged(): Promise<void> {
    try {
      const current = await this.readSignature();
      if (current === this.signature) {
        return;
      }
      this.logger.log('Runtime dataset definitions changed elsewhere — reloading');
      await this.refresh();
    } catch (error) {
      // A failed probe must not kill the interval or the worker. The next tick
      // retries; meanwhile the last good cache keeps serving prints.
      this.logger.error(
        `Runtime dataset refresh probe failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async readSignature(): Promise<string> {
    const probe = await this.prisma.reportDataset.aggregate({
      where: { rdsIsDeleted: false, rdsIsActive: true },
      _count: { rdsId: true },
      _max: { rdsVersion: true, rdsModifiedOn: true, rdsCreatedOn: true },
    });

    return [
      probe._count.rdsId,
      probe._max.rdsVersion ?? 0,
      probe._max.rdsModifiedOn?.toISOString() ?? '',
      probe._max.rdsCreatedOn?.toISOString() ?? '',
    ].join('|');
  }

  private async refresh(): Promise<void> {
    const rows = await this.prisma.reportDataset.findMany({
      where: { rdsIsDeleted: false, rdsIsActive: true },
      orderBy: { rdsToken: 'asc' },
    });

    const providers = new Map<string, SqlReportDatasetProvider>();
    const descriptors = new Map<string, ProviderDescriptor>();

    for (const row of rows) {
      const definition = this.toDefinition(row);
      const key = definition.token.toLowerCase();

      providers.set(key, new SqlReportDatasetProvider(definition, this.pg, this.configuredGridSql));
      descriptors.set(key, {
        token: definition.token,
        label: definition.label,
        cardinality: definition.cardinality,
        docTypes: definition.docTypes,
        fields: definition.fields,
      });
    }

    this.providers = providers;
    this.descriptors = descriptors;
    this.signature = await this.readSignature();

    this.logger.log(`Loaded ${providers.size} runtime report dataset(s)`);
  }

  /**
   * Row → definition.
   *
   * The JSON columns are cast rather than re-validated. They were validated on
   * the way in, and a boot that refuses to start because one stored dataset has
   * drifted would take every print down with it — including the ones that do
   * not use it. A malformed definition instead fails when something binds it.
   */
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
}
