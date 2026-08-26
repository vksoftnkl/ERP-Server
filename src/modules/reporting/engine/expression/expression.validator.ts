import { ExpressionSandbox, TRANSFORM_NAMES, expressionEngine } from './jexl.factory';

/**
 * Validates template expressions at SAVE time.
 *
 * Two distinct jobs, both of which have to happen before a definition is
 * persisted rather than when it is rendered:
 *
 *   * Parseability. A syntax error caught here is a red underline in the
 *     designer. The same error caught at render time is a blank invoice at a
 *     customer's counter on a Saturday.
 *
 *   * Identifier and transform whitelisting (risk R3). jexl already denies
 *     reach into the JS runtime — the Phase 0.3 spike proves it — but denying
 *     unknown ROOT identifiers is a second, cheaper line: a template that
 *     references `process` or an undeclared dataset is rejected outright rather
 *     than silently rendering empty. It also catches the far more common case
 *     of a typo'd dataset name, which would otherwise print a blank column and
 *     nobody would notice until a customer did.
 */

/**
 * Root identifiers the engine injects into every evaluation context, over and
 * above the template's own declared datasets.
 */
export const BUILTIN_ROOT_IDENTIFIERS = [
  /** The current DETAIL/group row. */
  'row',
  /** Page number, total, and whether this is the first/last page. */
  'page',
  /** Accumulated aggregates by scope. */
  'agg',
  /** Request context: company, branch, accYear, docId, user. */
  'ctx',
  /** Render-time constants: now, renderedAt. */
  'sys',
  /** Group state: the group's key and its row count. */
  'group',
] as const;

const TRANSFORM_SET = new Set<string>(TRANSFORM_NAMES);

export interface ExpressionIssue {
  /** JSON path into the definition, e.g. bands[2].elements[3].value */
  readonly path: string;
  readonly expression: string;
  readonly message: string;
}

const EXPRESSION_PATTERN = /\{\{([\s\S]*?)\}\}/g;

/**
 * jexl AST node shapes, as emitted by jexl 2.3 and verified against the parser
 * rather than inferred from the @types package (which types the AST as `any`).
 *
 * Two field names are load-bearing and easy to get wrong:
 *
 *   * An Identifier carries its name in `value`, NOT `name`. `name` is only
 *     populated on FunctionCall.
 *   * ObjectLiteral and ArrayLiteral carry their CHILDREN in `value` too, while
 *     Literal carries a plain JS scalar there. So `value` may be a string, a
 *     node, a node array or a node record depending on `type` — it can never be
 *     walked without first switching on the type.
 *
 * Shapes, for reference:
 *   invoice.number   -> Identifier{value:'number', from:Identifier{value:'invoice'}}
 *   row.qty|fmt('x') -> FunctionCall{name:'fmt', pool:'transforms', args:[...]}
 *   items[.qty > 0]  -> FilterExpression{subject, expr, relative:true} with the
 *                       inner Identifier carrying relative:true
 */
interface AstNode {
  readonly type: string;
  /** FunctionCall only. */
  readonly name?: string;
  /**
   * Identifier: the identifier text. Literal: the scalar. ObjectLiteral: a
   * record of child nodes. ArrayLiteral: an array of child nodes.
   */
  readonly value?: unknown;
  readonly subject?: AstNode;
  readonly left?: AstNode;
  readonly right?: AstNode;
  readonly test?: AstNode;
  readonly consequent?: AstNode;
  readonly alternate?: AstNode;
  readonly expr?: AstNode;
  /** Set on identifiers that are relative to a filter's current element. */
  readonly relative?: boolean;
  readonly args?: readonly AstNode[];
  /** 'transforms' for `a|b`, 'functions' for `b(a)`. */
  readonly pool?: string;
  /** The subject an Identifier reads a property from. Absent on a root. */
  readonly from?: AstNode;
}

export class ExpressionValidator {
  constructor(private readonly engine: ExpressionSandbox = expressionEngine) {}

  /**
   * Validate every `{{ ... }}` span in one template string.
   *
   * `allowedRoots` is the union of the built-ins and the template's declared
   * dataset names. A reference outside it is an error, not a warning: there is
   * no legitimate template that reads an identifier the engine will not supply.
   */
  validateTemplateString(
    template: string | undefined | null,
    path: string,
    allowedRoots: ReadonlySet<string>,
  ): ExpressionIssue[] {
    if (typeof template !== 'string' || !template.includes('{{')) {
      return [];
    }

    const issues: ExpressionIssue[] = [];

    // An unbalanced brace is invisible to the span regex — it just swallows the
    // rest of the string or matches nothing — so count delimiters explicitly.
    const openCount = (template.match(/\{\{/g) ?? []).length;
    const closeCount = (template.match(/\}\}/g) ?? []).length;
    if (openCount !== closeCount) {
      issues.push({
        path,
        expression: template,
        message: `unbalanced expression delimiters (${openCount} '{{' vs ${closeCount} '}}')`,
      });
      return issues;
    }

    EXPRESSION_PATTERN.lastIndex = 0;
    let match = EXPRESSION_PATTERN.exec(template);
    while (match !== null) {
      const source = match[1].trim();

      if (!source) {
        issues.push({ path, expression: template, message: 'empty expression' });
      } else {
        issues.push(...this.validateExpression(source, path, allowedRoots));
      }

      match = EXPRESSION_PATTERN.exec(template);
    }

    return issues;
  }

  /** Validate one bare expression (no `{{ }}` wrapper). */
  validateExpression(
    source: string,
    path: string,
    allowedRoots: ReadonlySet<string>,
  ): ExpressionIssue[] {
    let ast: AstNode;

    try {
      const compiled = this.engine.compile(source);
      ast = compiled._getAst() as unknown as AstNode;
    } catch (error) {
      return [
        {
          path,
          expression: source,
          message: error instanceof Error ? error.message : String(error),
        },
      ];
    }

    const issues: ExpressionIssue[] = [];
    this.walk(ast, source, path, allowedRoots, issues);
    return issues;
  }

  /**
   * Walk the AST collecting whitelist violations.
   *
   * Identifier nodes carry `relative: true` inside a filter or map expression
   * (`items[.qty > 0]`), where the leading `.` means "the current element" and
   * the name is a property of it, not a root. Those are skipped — treating them
   * as roots would reject every collection filter a template writes.
   */
  private walk(
    node: AstNode | undefined,
    source: string,
    path: string,
    allowedRoots: ReadonlySet<string>,
    issues: ExpressionIssue[],
    depth = 0,
  ): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    // A deeply nested expression is either generated or hostile; either way the
    // walker should not recurse into it without bound.
    if (depth > 100) {
      issues.push({ path, expression: source, message: 'expression nests too deeply' });
      return;
    }

    switch (node.type) {
      case 'Identifier': {
        // A property access (`invoice.number`) parses as an Identifier whose
        // `from` is the subject. Only the innermost — no `from`, not relative —
        // is a root reference. `relative` marks the current element inside a
        // filter (`items[.qty > 0]`), where the name is a property, not a root.
        const isRoot = !node.from && !node.relative;
        const identifierName = typeof node.value === 'string' ? node.value : undefined;

        if (isRoot && identifierName && !allowedRoots.has(identifierName)) {
          issues.push({
            path,
            expression: source,
            message:
              `unknown identifier '${identifierName}'. Available: ` +
              `${[...allowedRoots].sort().join(', ')}`,
          });
        }
        break;
      }

      case 'FunctionCall': {
        // jexl models `a|b` and `b(a)` as the same node, discriminated by
        // `pool`. No functions are registered at all, so a 'functions' pool
        // call is always a mistake; a 'transforms' call has to be in the
        // whitelist. Either way an unregistered name would also throw at
        // evaluation — rejecting it here is what makes it a designer error.
        if (node.pool === 'functions') {
          issues.push({
            path,
            expression: source,
            message: `function calls are not allowed in expressions (found '${node.name ?? '?'}')`,
          });
        } else if (node.name && !TRANSFORM_SET.has(node.name)) {
          issues.push({
            path,
            expression: source,
            message: `unknown transform '|${node.name}'`,
          });
        }
        break;
      }

      case 'ObjectLiteral': {
        for (const child of Object.values((node.value ?? {}) as Record<string, AstNode>)) {
          this.walk(child, source, path, allowedRoots, issues, depth + 1);
        }
        break;
      }

      case 'ArrayLiteral': {
        for (const child of (node.value ?? []) as readonly AstNode[]) {
          this.walk(child, source, path, allowedRoots, issues, depth + 1);
        }
        break;
      }

      default:
        break;
    }

    // Recurse over every child-bearing field, whatever the node type.
    for (const child of [
      node.subject,
      node.left,
      node.right,
      node.test,
      node.consequent,
      node.alternate,
      node.expr,
      node.from,
    ]) {
      this.walk(child, source, path, allowedRoots, issues, depth + 1);
    }

    for (const child of node.args ?? []) {
      this.walk(child, source, path, allowedRoots, issues, depth + 1);
    }
  }
}

/** The root identifiers a template with these datasets may legally reference. */
export const buildAllowedRoots = (datasetNames: readonly string[]): Set<string> =>
  new Set<string>([...BUILTIN_ROOT_IDENTIFIERS, ...datasetNames]);
