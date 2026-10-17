import type Expression from 'jexl/Expression';
import { ExpressionSandbox, expressionEngine } from './jexl.factory';
import { scalarToString } from './transforms/scalar';

/**
 * Evaluates the `{{ ... }}` template strings that appear in element values.
 *
 * Two things this class exists to guarantee:
 *
 *   1. Expressions are COMPILED ONCE and reused across rows. A 500-line invoice
 *      evaluates the same handful of expressions 500 times; re-parsing each one
 *      per row turns a 40ms render into a 4s one.
 *   2. A failing expression NEVER aborts a render. A template is tenant-authored
 *      and may reference a field a particular document does not have. The value
 *      degrades to empty and the failure is collected, so the caller can log it
 *      and still hand the customer their invoice.
 */

/** A `{{ ... }}` span, or a literal run of text. */
type Segment =
  | { readonly kind: 'literal'; readonly text: string }
  | { readonly kind: 'expression'; readonly source: string; readonly compiled: Expression | null };

interface CompiledTemplate {
  readonly segments: readonly Segment[];
  /** True when the whole string is one expression and nothing else. */
  readonly singleExpression: boolean;
}

export interface EvaluationFailure {
  readonly expression: string;
  readonly message: string;
}

const EXPRESSION_PATTERN = /\{\{([\s\S]*?)\}\}/g;

/** Cap the cache so a tenant cannot grow it without bound by editing templates. */
const MAX_CACHE_ENTRIES = 5_000;

export class ExpressionEvaluator {
  private readonly cache = new Map<string, CompiledTemplate>();

  private readonly failures: EvaluationFailure[] = [];

  constructor(private readonly engine: ExpressionSandbox = expressionEngine) {}

  /** Failures seen since construction, for the render log. */
  getFailures(): readonly EvaluationFailure[] {
    return this.failures;
  }

  clearFailures(): void {
    this.failures.length = 0;
  }

  /**
   * Evaluate a template string against a context.
   *
   * When the string is exactly one expression the raw value is returned with its
   * type intact — a number stays a number, an object stays an object. That is
   * what lets `visible` receive a boolean and `gstSplit` return a record.
   * Anything else is interpolated to a string.
   */
  evaluate(template: string | undefined | null, context: Record<string, unknown>): unknown {
    if (template === undefined || template === null || template === '') {
      return '';
    }

    const compiled = this.compileTemplate(template);

    if (compiled.singleExpression) {
      const segment = compiled.segments[0];
      return segment.kind === 'expression' ? this.evalSegment(segment, context) : segment.text;
    }

    let output = '';
    for (const segment of compiled.segments) {
      if (segment.kind === 'literal') {
        output += segment.text;
        continue;
      }
      const value = this.evalSegment(segment, context);
      output += scalarToString(value);
    }

    return output;
  }

  /** Evaluate to a string, the form every text primitive needs. */
  evaluateText(template: string | undefined | null, context: Record<string, unknown>): string {
    const value = this.evaluate(template, context);
    if (value === null || value === undefined) {
      return '';
    }
    return scalarToString(value);
  }

  /**
   * Evaluate to a boolean, for `visible` and `when`.
   *
   * An ABSENT expression means "no condition stated" and must be true, which is
   * why this cannot just call evaluate() and coerce: an empty string is falsy.
   */
  evaluateCondition(
    template: string | undefined | null,
    context: Record<string, unknown>,
  ): boolean {
    if (template === undefined || template === null || template.trim() === '') {
      return true;
    }
    const value = this.evaluate(template, context);
    // 'false' and '0' arrive as strings when the author wrote them into an
    // interpolated string rather than a bare expression.
    if (typeof value === 'string') {
      const normalised = value.trim().toLowerCase();
      return normalised !== '' && normalised !== 'false' && normalised !== '0';
    }
    return Boolean(value);
  }

  /**
   * Evaluate to a number, for aggregate inputs. Non-numeric degrades to 0.
   *
   * Parses back a value that a FORMATTING transform has already turned into
   * text, because an aggregate's input expression is usually the element's own
   * display expression. Two conventions have to survive that round trip:
   *
   *   * digit grouping — '2,50,000.00'
   *   * accounting parentheses — '(5,000.00)' is NEGATIVE five thousand
   *
   * The second one is not a nicety. A statement whose pending column is
   * formatted '#,##0.00;(#,##0.00)' would otherwise read every credit as zero,
   * and the closing balance would silently exceed the sum of its own subtotals.
   * Prefer `aggregate.over` to aggregate the raw field and avoid the round trip
   * entirely.
   */
  evaluateNumber(template: string | undefined | null, context: Record<string, unknown>): number {
    const value = this.evaluate(template, context);
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    // Prisma Decimal arrives as an object with a numeric toString.
    const text = scalarToString(value).trim();
    if (!text) {
      return 0;
    }

    const parenthesised = /^\(.*\)$/.test(text);

    // Drop grouping separators, then take the first numeric run. Character
    // stripping alone is not enough: 'Rs. 1,234.50' reduces to '.1234.50',
    // which has two decimal points and parses as NaN.
    const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return 0;
    }

    const numeric = Number(match[0]);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return parenthesised ? -Math.abs(numeric) : numeric;
  }

  /** True when the string contains at least one expression span. */
  static hasExpression(template: string | undefined | null): boolean {
    return typeof template === 'string' && template.includes('{{');
  }

  private evalSegment(
    segment: Extract<Segment, { kind: 'expression' }>,
    context: Record<string, unknown>,
  ): unknown {
    if (!segment.compiled) {
      return '';
    }
    try {
      return segment.compiled.evalSync(context);
    } catch (error) {
      this.recordFailure(segment.source, error);
      return '';
    }
  }

  private recordFailure(expression: string, error: unknown): void {
    // Cap the list: a bad expression in a DETAIL band fails once per row, and a
    // 5000-row report would otherwise build a 5000-entry array of the same text.
    if (this.failures.length >= 50) {
      return;
    }
    if (this.failures.some((failure) => failure.expression === expression)) {
      return;
    }
    this.failures.push({
      expression,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  private compileTemplate(template: string): CompiledTemplate {
    const cached = this.cache.get(template);
    if (cached) {
      return cached;
    }

    const segments: Segment[] = [];
    let cursor = 0;

    EXPRESSION_PATTERN.lastIndex = 0;
    let match = EXPRESSION_PATTERN.exec(template);
    while (match !== null) {
      if (match.index > cursor) {
        segments.push({ kind: 'literal', text: template.slice(cursor, match.index) });
      }

      const source = match[1].trim();
      segments.push({ kind: 'expression', source, compiled: this.compileExpression(source) });

      cursor = match.index + match[0].length;
      match = EXPRESSION_PATTERN.exec(template);
    }

    if (cursor < template.length) {
      segments.push({ kind: 'literal', text: template.slice(cursor) });
    }

    if (segments.length === 0) {
      segments.push({ kind: 'literal', text: '' });
    }

    const compiled: CompiledTemplate = {
      segments,
      singleExpression: segments.length === 1 && segments[0].kind === 'expression',
    };

    if (this.cache.size < MAX_CACHE_ENTRIES) {
      this.cache.set(template, compiled);
    }

    return compiled;
  }

  private compileExpression(source: string): Expression | null {
    if (!source) {
      return null;
    }
    try {
      return this.engine.compile(source);
    } catch (error) {
      // A parse failure is a template bug. It is reported once here rather than
      // once per row, because compilation is cached.
      this.recordFailure(source, error);
      return null;
    }
  }
}
