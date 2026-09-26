import { OutputMode } from '../definition/template-definition.schema';

export type { SettingsErrorDetail as PrintRenderErrorDetail } from 'src/common/types/module-api.types';
export type { SettingsErrorResponse as PrintRenderErrorResponse } from 'src/common/types/module-api.types';
export type { SettingsSuccessResponse as PrintRenderSuccessResponse } from 'src/common/types/module-api.types';

/**
 * What the render already knows — the DEFAULT value of each context name.
 *
 * `:company_id`, `:branch_id`, `:acc_year`, `:doc_id`, `:user_id` and
 * `:device_id` are bound from here whenever the revision's `ptv_params`
 * declares no prompt of that name. A revision that DOES declare one overrides
 * the default with the operator's answer — the one exception is `companyId`,
 * which stays the authenticated company however the revision is written, since
 * a caller able to name the company is a caller able to read another tenant.
 */
export interface RenderContext {
  readonly companyId: string;
  readonly branchId: string | null;
  /** The DOCUMENT's accounting year — what its partitioned tables are keyed by. */
  readonly accYear: string | null;
  readonly docId: string | null;
  readonly userId: string | null;
  readonly deviceId: string | null;
}

/** One resolved dataset, ready for the layout engine. */
export interface ResolvedDataset {
  readonly name: string;
  readonly datasetNo: number;
  readonly role: 'MASTER' | 'DETAIL';
  readonly sourceKind: 'PROVIDER' | 'SQL';
  /** The single row for a MASTER, the array for a DETAIL. */
  readonly value: unknown;
  readonly rowCount: number;
  readonly durationMs: number;
  /** True when ptd_row_limit cut the result short — a silent truncation named. */
  readonly truncated: boolean;
}

export interface RenderWarning {
  readonly kind: string;
  readonly message: string;
}

/** What one render produced, whether or not its bytes reach a printer. */
export interface RenderOutcome {
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly extension: string;
  readonly outputMode: OutputMode;
  readonly pageCount: number;
  /** Pages per copy, in copy order. `pageCount` is their sum. */
  readonly pagesPerCopy: readonly number[];
  readonly copies: number;
  readonly copyLabels: readonly string[];
  readonly templateId: string;
  readonly templateName: string | null;
  readonly versionId: string;
  readonly revNo: number;
  readonly status: string;
  readonly engine: string;
  readonly paperCode: string;
  readonly layoutMs: number;
  readonly renderMs: number;
  readonly detailRows: number;
  readonly datasets: readonly ResolvedDataset[];
  readonly warnings: readonly RenderWarning[];
}

/**
 * The JSON view of a render — everything above except the bytes AND the rows.
 *
 * `ResolvedDataset.value` is dropped rather than carried: a detail dataset at
 * its row limit would turn "how many rows did I get" into several megabytes of
 * answer. What survives is the shape of the question — counts, timings, and
 * whether anything was truncated.
 */
export interface RenderInspection extends Omit<RenderOutcome, 'bytes' | 'datasets'> {
  readonly datasets: readonly Omit<ResolvedDataset, 'value'>[];
  readonly byteCount: number;
  /** Present only for a render that was logged. One id per copy. */
  readonly printLogIds?: readonly string[];
}
