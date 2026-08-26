/**
 * Phase 2 — the data provider contract.
 *
 * Templates reference dataset TOKENS, never SQL. This is the multi-tenant
 * security boundary of the whole feature: a template is tenant-authored
 * content, and a template that could carry SQL would be a cross-tenant read
 * primitive handed to whoever can open the designer.
 *
 * A provider therefore does two things and no more:
 *   * turns a ReportContext into rows, scoped to that context's company/branch
 *   * describes its own fields, so the designer can offer them
 *
 * `sampleData()` is mandatory, not a nicety. It is what makes the designer
 * preview work with no database access at all, which in turn is what keeps the
 * designer usable against production data it must not read.
 */

/** A single row of provider output. Values are already display-ready scalars. */
export type ReportRow = Record<string, unknown>;

export type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'object';

export interface FieldMeta {
  /** The name a template writes, e.g. `netAmount`. */
  readonly name: string;
  readonly type: FieldType;
  /** Human label for the designer's field tree. */
  readonly label: string;
  /**
   * Suggested format pattern for the designer to pre-fill, e.g. '#,##0.00'.
   * Advisory only — the template's own pattern always wins.
   */
  readonly format?: string;
  /** Marks a field as containing complex script, so the renderer picks a font. */
  readonly complexScript?: boolean;
  readonly description?: string;
}

/**
 * Everything a provider is allowed to know about the request.
 *
 * companyId and branchId are not optional and not caller-supplied hints — they
 * come from the authenticated request context, and every provider query must
 * filter on them.
 */
export interface ReportContext {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly accYear: string;
  /** The document being printed. Empty for a parameterised report. */
  readonly docId: string;
  readonly userId: string | null;
  /** Provider-specific parameters from the dataset binding or the request. */
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface IReportDataProvider {
  /** Resolve real rows for this context. */
  resolve(context: ReportContext): Promise<ReportRow[] | ReportRow>;
  /** Representative rows, with no database access. Powers designer preview. */
  sampleData(): ReportRow[] | ReportRow;
  /** Field metadata, powering the designer's field tree and autocomplete. */
  fields(): readonly FieldMeta[];
}

export interface ProviderDescriptor {
  readonly token: string;
  readonly label: string;
  readonly cardinality: 'one' | 'many';
  /** Document types this provider is meaningful for. Empty = any. */
  readonly docTypes: readonly string[];
  readonly fields: readonly FieldMeta[];
}
