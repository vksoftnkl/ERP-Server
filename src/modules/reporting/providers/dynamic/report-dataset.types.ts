import { FieldMeta, ReportContext } from '../report-data-provider.types';

/**
 * Runtime dataset definitions — the dynamic half of IReportDataProvider.
 *
 * A compiled provider and a row of reports.report_dataset answer the same three
 * questions (resolve / fields / sampleData). The difference is only where the
 * answer is written down, which is why nothing downstream of the registry has
 * to know which kind it got.
 */

export type DatasetParamType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'uuid';

/**
 * The tokens every dataset gets for free, bound from the authenticated request
 * context and NEVER from a caller.
 *
 * This map is the tenant boundary. A dataset author writes `p_company_id` in
 * the SQL; the binder substitutes ReportContext.companyId as a $n parameter. A
 * template can express neither the value nor the token, so there is no request
 * shape that makes a dataset read another company's rows.
 */
export const RESERVED_DATASET_PARAMS = {
  p_company_id: 'companyId',
  p_branch_id: 'branchId',
  p_acc_year: 'accYear',
  p_doc_id: 'docId',
  p_user_id: 'userId',
} as const satisfies Record<string, keyof ReportContext>;

export type ReservedDatasetParam = keyof typeof RESERVED_DATASET_PARAMS;

/** The one reserved token a dataset is REQUIRED to use. */
export const MANDATORY_SCOPE_PARAM: ReservedDatasetParam = 'p_company_id';

export const isReservedDatasetParam = (name: string): name is ReservedDatasetParam =>
  Object.prototype.hasOwnProperty.call(RESERVED_DATASET_PARAMS, name);

/** Every parameter token, reserved or declared, matches this. */
export const DATASET_PARAM_NAME_PATTERN = /^p_[a-z0-9]+(?:_[a-z0-9]+)*$/;

/**
 * An author-declared parameter, filled from the dataset binding's `params` or
 * the render request. Anything not declared here and not reserved is rejected
 * at save time, so a typo (`p_partyid` for `p_party_id`) fails in the admin
 * screen rather than silently matching no rows on a customer's statement.
 */
export interface ReportDatasetParamSpec {
  /** The token as written in the SQL, e.g. `p_party_id`. */
  readonly name: string;
  readonly type: DatasetParamType;
  readonly required: boolean;
  readonly label?: string;
  /** Used when the caller supplies nothing. Also used for save-time probing. */
  readonly defaultValue?: unknown;
}

/** One runtime dataset, as the registry holds it. */
export interface ReportDatasetDefinition {
  readonly id: string;
  readonly token: string;
  readonly label: string;
  readonly cardinality: 'one' | 'many';
  readonly docTypes: readonly string[];
  readonly sql: string;
  readonly params: readonly ReportDatasetParamSpec[];
  readonly fields: readonly FieldMeta[];
  readonly sampleRows: readonly Record<string, unknown>[] | null;
  readonly maxRows: number;
  readonly version: number;
}

/** Result of validating + introspecting a candidate SQL body, before saving. */
export interface DatasetProbeResult {
  readonly normalizedSql: string;
  readonly fields: readonly FieldMeta[];
  /** Reserved tokens the SQL actually uses — surfaced so the author can see it. */
  readonly reservedParamsUsed: readonly string[];
}
