import { Injectable, Logger } from '@nestjs/common';
import { PrintTemplateDataset } from '@prisma/client';
import { PgService } from 'src/database/pg/pg.service';
import { ModuleErrorDetail } from 'src/common/utils/module-service.utils';
import { PTV_CONTEXT_PARAMS } from '../../print-template/print-template.constants';
import { RenderContext, ResolvedDataset } from '../types/print-render-api.types';
import { DatasetBindError, bindDatasetSql, withRowLimit } from './dataset-sql-binder';
import { hasContextDefault, isServerOwnedParam } from './render-params';
import { PrintDataProviderRegistry } from './print-data-provider.registry';
import { PrintRow } from './print-data-provider.types';
import { toScalarText } from './scalar-text';
import { coerceProviderRow, coerceResultRows, duplicateColumns } from './value-coercion';

/**
 * §4 executed — every dataset a revision declares, turned into rows.
 *
 * ── THE THREE RUNTIME FACTS ────────────────────────────────────────────────
 *
 * §4 says the stored-SQL guards are an authoring lint and that the real
 * boundary is three runtime facts. All three are here, and none of them is a
 * check on the query text:
 *
 *   1. Parameters BOUND over the extended protocol   → `bindDatasetSql`
 *   2. The query run in a READ ONLY transaction      → `PgService.queryReadOnlyTx`
 *   3. A role with no write privilege                → the read-only pool's
 *      DATABASE_READONLY_URL, which is deployment's half of the bargain and is
 *      warned about at boot when it is missing.
 *
 * ── WHY EVERY DATASET RUNS AT ONCE ─────────────────────────────────────────
 *
 * They are independent reads against a pool. An invoice with five datasets
 * would otherwise pay five sequential round trips before layout starts, on the
 * one request a person is standing at a counter waiting for. Nesting does not
 * change this: a child query "runs ONCE FOR THE WHOLE RENDER, NOT ONCE PER
 * PARENT ROW", so it has no dependency on its parent's rows and starts at the
 * same moment.
 */

export interface DatasetRunRequest {
  readonly datasets: readonly PrintTemplateDataset[];
  readonly context: RenderContext;
  /** The operator's answers, already validated and coerced against ptv_params. */
  readonly params: Readonly<Record<string, unknown>>;
  readonly lang: string;
}

export interface DatasetRunResult {
  /** Dataset name → rows (or the single row for a MASTER), for the layout engine. */
  readonly data: Record<string, unknown>;
  readonly resolved: readonly ResolvedDataset[];
  readonly warnings: readonly { kind: string; message: string }[];
}

export class DatasetRunError extends Error {
  constructor(
    message: string,
    readonly details: ModuleErrorDetail[],
  ) {
    super(message);
    this.name = 'DatasetRunError';
  }
}

@Injectable()
export class DatasetRunnerService {
  private readonly logger = new Logger(DatasetRunnerService.name);

  constructor(
    private readonly pg: PgService,
    private readonly providers: PrintDataProviderRegistry,
  ) {}

  async run(request: DatasetRunRequest): Promise<DatasetRunResult> {
    const warnings: { kind: string; message: string }[] = [];

    const settled = await Promise.all(
      request.datasets.map(async (dataset) => this.runOne(dataset, request, warnings)),
    );

    const data: Record<string, unknown> = {};
    for (const entry of settled) {
      data[entry.name] = entry.value;
    }

    // Nesting is applied AFTER every dataset has its rows, because a child is
    // grouped onto its parent rather than fetched per parent row.
    this.attachChildren(request.datasets, data, warnings);

    return { data, resolved: settled, warnings };
  }

  // ─── One dataset ───────────────────────────────────────────────────────

  private async runOne(
    dataset: PrintTemplateDataset,
    request: DatasetRunRequest,
    warnings: { kind: string; message: string }[],
  ): Promise<ResolvedDataset> {
    const startedAt = Date.now();
    const isMaster = dataset.ptdRole === 'MASTER';
    // "MASTER: exactly one, the header context, one row read." Asking for more
    // would only make the truncation flag below lie.
    const limit = isMaster ? 1 : dataset.ptdRowLimit;

    const rows =
      dataset.ptdSourceKind === 'SQL'
        ? await this.runSql(dataset, request, limit, warnings)
        : await this.runProvider(dataset, request, limit);

    // The cap is applied in SQL, so a full result AT the limit is the signal
    // that PostgreSQL had more to give. Reported rather than silently accepted:
    // a bill that prints 5,000 of 5,140 lines is a legal document that is
    // missing rows, and nothing else in the render would say so.
    const truncated = !isMaster && rows.length >= limit;
    if (truncated) {
      warnings.push({
        kind: 'row-limit',
        message:
          `Dataset '${dataset.ptdName}' returned its full row limit of ${limit} rows — ` +
          'there may be more. Raise ptdRowLimit on the revision if the document is incomplete.',
      });
    }

    return {
      name: dataset.ptdName,
      datasetNo: dataset.ptdDatasetNo,
      role: isMaster ? 'MASTER' : 'DETAIL',
      sourceKind: dataset.ptdSourceKind === 'SQL' ? 'SQL' : 'PROVIDER',
      // A `one` dataset bound to an array makes `{{ invoice.bill_no }}` resolve
      // to undefined and print blank — the most confusing failure available,
      // because the data is right there in the log. Taking the first row is the
      // only useful reading; an empty MASTER becomes {} so that every field
      // reference prints blank rather than throwing on a property of undefined.
      value: isMaster ? (rows[0] ?? {}) : rows,
      rowCount: rows.length,
      durationMs: Date.now() - startedAt,
      truncated,
    };
  }

  private async runSql(
    dataset: PrintTemplateDataset,
    request: DatasetRunRequest,
    limit: number,
    warnings: { kind: string; message: string }[],
  ): Promise<PrintRow[]> {
    const sql = dataset.ptdSql;
    if (!sql) {
      // ck_ptd_source_biconditional says this cannot happen; it is checked
      // because a NULL here would otherwise reach the binder as 'undefined'.
      throw new DatasetRunError(`Dataset '${dataset.ptdName}' is SQL-sourced but has no query`, [
        {
          field: `datasets.${dataset.ptdName}.ptdSql`,
          message:
            'ptdSourceKind is SQL and ptdSql is empty. One of the two is wrong — ' +
            'ck_ptd_source_biconditional normally prevents this pairing.',
        },
      ]);
    }

    const values = this.bindableValues(dataset, request);

    let bound;
    try {
      bound = withRowLimit(bindDatasetSql(sql, values), limit);
    } catch (error) {
      if (error instanceof DatasetBindError) {
        throw new DatasetRunError(`Dataset '${dataset.ptdName}' cannot be bound`, [
          { field: `datasets.${dataset.ptdName}.ptdSql`, message: error.message },
        ]);
      }
      throw error;
    }

    try {
      const result = await this.pg.queryReadOnlyTx(bound.sql, bound.params, dataset.ptdTimeoutMs);

      const duplicated = duplicateColumns(result);
      if (duplicated.length > 0) {
        warnings.push({
          kind: 'duplicate-column',
          message:
            `Dataset '${dataset.ptdName}' returns ${duplicated.join(', ')} more than once. ` +
            'Only the last of each is reachable from an expression — alias them apart.',
        });
      }

      return coerceResultRows(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A cancelled statement is the timeout, and saying so beats a bare
      // 'canceling statement due to statement timeout' with no subject.
      const timedOut = /statement timeout/i.test(message);

      this.logger.error(
        `Dataset '${dataset.ptdName}' (${dataset.ptdId}) failed after binding ` +
          `${bound.bound.map((name) => `:${name}`).join(', ') || 'no parameters'}: ${message}`,
      );

      throw new DatasetRunError(
        timedOut
          ? `Dataset '${dataset.ptdName}' took longer than its ${dataset.ptdTimeoutMs}ms limit`
          : `Dataset '${dataset.ptdName}' failed to execute`,
        [
          {
            field: `datasets.${dataset.ptdName}.ptdSql`,
            message: timedOut
              ? `The query was cancelled at ${dataset.ptdTimeoutMs}ms (ptdTimeoutMs). ` +
                'Either the query needs an index for this filter, or the limit is too low.'
              : message,
          },
        ],
      );
    }
  }

  private async runProvider(
    dataset: PrintTemplateDataset,
    request: DatasetRunRequest,
    limit: number,
  ): Promise<PrintRow[]> {
    const code = dataset.ptdProviderCode ?? '';
    const provider = this.providers.get(code);

    if (!provider) {
      throw new DatasetRunError(
        `Dataset '${dataset.ptdName}' names a provider this server does not have`,
        [
          {
            field: `datasets.${dataset.ptdName}.ptdProviderCode`,
            message:
              `No provider is registered as '${code}'. Registered: ${this.providers.codes().join(', ') || 'none'}. ` +
              'A provider is code, so a template that names one this build does not carry cannot ' +
              'be made to work by editing data — either the template is ahead of the server or ' +
              'the code is a typo.',
          },
        ],
      );
    }

    try {
      const produced = await provider.resolve({
        context: request.context,
        params: request.params,
        lang: request.lang,
        rowLimit: limit,
      });

      const rows = Array.isArray(produced) ? produced : [produced];
      return rows.slice(0, limit).map((row) => coerceProviderRow(row));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Provider '${code}' failed for dataset '${dataset.ptdName}': ${message}`);
      throw new DatasetRunError(`Dataset '${dataset.ptdName}' failed to load`, [
        { field: `datasets.${dataset.ptdName}.ptdProviderCode`, message },
      ]);
    }
  }

  // ─── Parameters ────────────────────────────────────────────────────────

  /**
   * What a query may bind: the context the render already holds, then whatever
   * the revision declared and the operator answered.
   *
   * THE CONTEXT IS A DEFAULT, NOT A CEILING. It is written first, and a
   * DECLARED prompt of the same name overwrites it — that is the whole point of
   * being able to put `doc_id` in `ptv_params`: a report that prints a document
   * the operator picks needs `:doc_id` to be the answer, not the id the print
   * request happened to carry. An unanswered prompt (null) does NOT overwrite,
   * so declaring one costs nothing when it is left blank.
   *
   * `company_id` is the exception, and it is the tenant guarantee: it is written
   * LAST, so no declaration and no answer can move it off the authenticated
   * company. `resolveRenderParams` refuses an answer to it as well; this is what
   * makes that refusal not load-bearing.
   */
  private bindableValues(
    dataset: PrintTemplateDataset,
    request: DatasetRunRequest,
  ): Record<string, unknown> {
    const context: Record<(typeof PTV_CONTEXT_PARAMS)[number], unknown> = {
      company_id: request.context.companyId,
      branch_id: request.context.branchId,
      acc_year: request.context.accYear,
      doc_id: request.context.docId,
      user_id: request.context.userId,
      device_id: request.context.deviceId,
    };

    const values: Record<string, unknown> = {};
    for (const name of PTV_CONTEXT_PARAMS) {
      values[name] = context[name] ?? null;
    }

    for (const [name, value] of Object.entries(request.params)) {
      if (isServerOwnedParam(name)) continue;
      if (value === null || value === undefined) {
        // Only a context name has something to fall back TO; anything else
        // keeps its null, because a query binding it must still see the blank.
        if (hasContextDefault(name)) continue;
      }
      values[name] = value ?? null;
    }

    // ptd_requires_company is the flag that says a query is allowed to be
    // global. It does not change what is bindable — a state-code list simply
    // never mentions :company_id — so nothing is removed here; the save-time
    // guard is where the rule lives.
    void dataset;

    return values;
  }

  // ─── Nesting ───────────────────────────────────────────────────────────

  /**
   * ptd_parent_no / ptd_link_fields, applied.
   *
   * "THE CHILD QUERY RUNS ONCE FOR THE WHOLE RENDER, NOT ONCE PER PARENT ROW.
   * It is bound with the same context every other dataset gets, returns the
   * parent's key as an ordinary column, and the RENDERER groups on it." This is
   * that grouping: each parent row gains a property named after the child
   * dataset, holding the child rows whose link columns match.
   *
   * The child stays available at the top level as well, unchanged. A band bound
   * to `batches` still walks every batch row on the document; the attachment is
   * what lets `{{ row.batches }}` mean this line's batches from inside the line.
   *
   * ── WHAT THIS IS NOT ───────────────────────────────────────────────────
   *
   * It is not a nested BAND. The body's band model has one `dataset` per band
   * and no sub-bands, so a design cannot yet repeat a band inside a row — that
   * is a schema change to `bandSchema`, not a data change, and inventing it
   * here would produce data no design can reach. What a design CAN do today is
   * read the attached array from an expression, which covers the common case a
   * batch/serial column needs.
   */
  private attachChildren(
    datasets: readonly PrintTemplateDataset[],
    data: Record<string, unknown>,
    warnings: { kind: string; message: string }[],
  ): void {
    const byNumber = new Map(datasets.map((dataset) => [dataset.ptdDatasetNo, dataset]));

    for (const child of datasets) {
      if (child.ptdParentNo === null || child.ptdParentNo === undefined) continue;

      const parent = byNumber.get(child.ptdParentNo);
      if (!parent) {
        warnings.push({
          kind: 'missing-dataset',
          message:
            `Dataset '${child.ptdName}' is nested under dataset number ${child.ptdParentNo}, ` +
            'which this revision does not have. Its rows are still available at the top level.',
        });
        continue;
      }

      const pairs = (child.ptdLinkFields ?? '')
        .split(',')
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
          const [parentColumn, childColumn] = pair.split('=');
          return { parentColumn, childColumn };
        });

      if (pairs.length === 0) {
        warnings.push({
          kind: 'missing-dataset',
          message:
            `Dataset '${child.ptdName}' names a parent but no link fields, so its rows cannot ` +
            'be matched to parent rows.',
        });
        continue;
      }

      const childRows = data[child.ptdName];
      if (!Array.isArray(childRows)) continue;

      // One pass over the child rows builds the index; the parents then look
      // up. A 14-line bill with 40 batch rows costs 54 steps, not 560.
      const index = new Map<string, Record<string, unknown>[]>();
      for (const row of childRows as Record<string, unknown>[]) {
        const key = pairs.map((pair) => toScalarText(row[pair.childColumn])).join(' ');
        const bucket = index.get(key);
        if (bucket) bucket.push(row);
        else index.set(key, [row]);
      }

      const attachTo = (parentRow: Record<string, unknown>): void => {
        const key = pairs.map((pair) => toScalarText(parentRow[pair.parentColumn])).join(' ');
        parentRow[child.ptdName] = index.get(key) ?? [];
      };

      const parentValue = data[parent.ptdName];
      if (Array.isArray(parentValue)) {
        for (const row of parentValue as Record<string, unknown>[]) attachTo(row);
      } else if (typeof parentValue === 'object' && parentValue !== null) {
        attachTo(parentValue as Record<string, unknown>);
      }
    }
  }
}
