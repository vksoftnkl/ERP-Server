import { RenderContext } from '../types/print-render-api.types';

/**
 * §4's other half — a dataset that is CODE rather than stored SQL.
 *
 * "A code-registered PROVIDER for anything needing joins across partitioned
 * tables or real business logic — the e-invoice QR, tax summaries, amount in
 * words. Stored SQL for everything else, so a new report costs no release."
 *
 * The dividing line is worth stating plainly, because it is not "hard queries
 * go here". A stored query is bound, read-only and company-scoped, and it can
 * join whatever it likes. What it CANNOT do is:
 *
 *   * pick the right partition from a document's own accounting year, which is
 *     a join key the query text does not know until the render happens;
 *   * carry a rule that has to stay right when the law changes — the Rule 46
 *     HSN summary is one query today and a different one the day a rate slab
 *     moves, and a hundred sites' stored copies of it would each be wrong
 *     separately;
 *   * produce something that is not rows at all, like a signed e-invoice QR.
 *
 * A provider gets exactly the closed context set and the operator's answers.
 * It gets no request, no headers and no way to widen its own scope: the
 * company it may read is the one in the context, full stop.
 */

export type PrintRow = Record<string, unknown>;

export interface ProviderRequest {
  readonly context: RenderContext;
  /** The operator's answers to ptv_params, already coerced to declared types. */
  readonly params: Readonly<Record<string, unknown>>;
  /**
   * The revision's language, `ptv_lang`. A provider that has a translated
   * column — item_name_ta beside item_name_en — picks with this, which is why
   * language never had to fork a template the way 3.0's platform column did.
   */
  readonly lang: string;
  /** ptd_row_limit for this dataset. A provider that can cap in SQL should. */
  readonly rowLimit: number;
}

export interface PrintDataProvider {
  /** ptd_provider_code — dotted lower snake, matching ck_ptd_provider_shape. */
  readonly code: string;
  /** What the designer's dataset picker shows. */
  readonly label: string;
  /** MASTER datasets take the first row; this says which shape is meant. */
  readonly cardinality: 'one' | 'many';
  resolve(request: ProviderRequest): Promise<PrintRow[] | PrintRow>;
}
