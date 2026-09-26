// eslint-disable-next-line @typescript-eslint/no-require-imports
import jexl = require('jexl');

import {
  formatDate,
  formatNumber,
  formatNumberIntl,
  groupIndian,
  groupWestern,
} from './transforms/format';
import { gstExclusive, gstSplit, isInterState } from './transforms/gst';
import { integerToIndianWords, numberToIndianWords } from './transforms/num-to-words';
import { scalarToString } from './transforms/scalar';
import {
  coalesce,
  lower,
  mask,
  padCenter,
  padEnd,
  padStart,
  repeat,
  titleCase,
  trim,
  truncate,
  upper,
  wrapText,
} from './transforms/text';

/**
 * The expression sandbox.
 *
 * jexl, and nothing else. No `eval`, no `new Function`, no `vm` — template
 * definitions are tenant-authored content, so an unsandboxed evaluator is
 * remote code execution against the whole tenancy. The Phase 0.3 spike
 * (scripts/reporting/jexl-sandbox-spike.js) is the standing regression check
 * for that: every runtime-reach attempt either throws at parse or resolves to
 * undefined.
 *
 * PRECEDENCE TRAP, for anyone authoring a template: jexl binds `|` TIGHTER
 * than arithmetic. `{{ row.qty * row.rate|fmt('0.00') }}` formats row.rate on
 * its own and then multiplies, producing '6' where '6.00' was intended. The
 * amount has to be parenthesised: `{{ (row.qty * row.rate)|fmt('0.00') }}`.
 *
 * Transforms are the only extension point. They are pure functions of their
 * arguments — a transform that reached a service, a request or the filesystem
 * would hand template authors exactly the capability jexl was chosen to deny.
 */

/**
 * The sandbox instance type. jexl's default export is a pre-built singleton
 * carrying the constructor, and the class itself is not exported as a type, so
 * the instance type has to be derived from the constructor.
 *
 * The `import = require()` form above is deliberate: jexl is CommonJS
 * (`module.exports = instance`, typed `export =`), and this tsconfig sets
 * allowSyntheticDefaultImports WITHOUT esModuleInterop. A default import
 * therefore typechecks and then resolves to `undefined` at runtime.
 */
export type ExpressionSandbox = InstanceType<typeof jexl.Jexl>;

/** Every transform a template may call, and the arity the validator expects. */
export const TRANSFORM_NAMES = [
  'fmt',
  'fmtIntl',
  'date',
  'numToWords',
  'intToWords',
  'gstSplit',
  'gstExclusive',
  'interState',
  'upper',
  'lower',
  'trim',
  'title',
  'pad',
  'padEnd',
  'padCenter',
  'truncate',
  'repeat',
  'coalesce',
  'wrap',
  'mask',
  'abs',
  'round',
  'ceil',
  'floor',
  'neg',
  'default',
  'length',
  'join',
  'first',
  'last',
  'sum',
  'sortBy',
  'where',
  'groupIndian',
  'groupWestern',
  'bool',
  'num',
  'str',
] as const;

export type TransformName = (typeof TRANSFORM_NAMES)[number];

const toNumber = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value];

/**
 * Build a fresh sandbox. One instance per process is enough — the returned
 * engine holds no per-render state, and compiled expressions are cached by the
 * caller (ExpressionEvaluator), not here.
 */
export const createExpressionEngine = (): ExpressionSandbox => {
  const engine = new jexl.Jexl();

  // ── Numbers and dates ────────────────────────────────────────────────
  engine.addTransform('fmt', (value: unknown, pattern?: string) =>
    formatNumber(value, pattern ?? '0.00'),
  );
  engine.addTransform('fmtIntl', (value: unknown, pattern?: string) =>
    formatNumberIntl(value, pattern ?? '0.00'),
  );
  engine.addTransform('date', (value: unknown, pattern?: string) =>
    formatDate(value, pattern ?? 'dd-MM-yyyy'),
  );
  engine.addTransform('groupIndian', (value: unknown) => groupIndian(scalarToString(value)));
  engine.addTransform('groupWestern', (value: unknown) => groupWestern(scalarToString(value)));

  // ── Amount in words ──────────────────────────────────────────────────
  engine.addTransform('numToWords', (value: unknown, currency?: string, subCurrency?: string) =>
    numberToIndianWords(value, {
      currency: currency ?? 'Rupees',
      subCurrency: subCurrency ?? 'Paise',
    }),
  );
  engine.addTransform('intToWords', (value: unknown) => integerToIndianWords(toNumber(value)));

  // ── GST ──────────────────────────────────────────────────────────────
  engine.addTransform('gstSplit', (value: unknown, rate?: unknown, interState?: unknown) =>
    gstSplit(value, rate, interState),
  );
  engine.addTransform('gstExclusive', (value: unknown, rate?: unknown) =>
    gstExclusive(value, rate),
  );
  engine.addTransform('interState', (supplier: unknown, recipient?: unknown) =>
    isInterState(supplier, recipient),
  );

  // ── Text ─────────────────────────────────────────────────────────────
  engine.addTransform('upper', upper);
  engine.addTransform('lower', lower);
  engine.addTransform('trim', trim);
  engine.addTransform('title', titleCase);
  engine.addTransform('pad', (value: unknown, width?: number, fill?: string) =>
    padStart(value, toNumber(width), fill),
  );
  engine.addTransform('padEnd', (value: unknown, width?: number, fill?: string) =>
    padEnd(value, toNumber(width), fill),
  );
  engine.addTransform('padCenter', (value: unknown, width?: number, fill?: string) =>
    padCenter(value, toNumber(width), fill),
  );
  engine.addTransform('truncate', (value: unknown, width?: number, ellipsis?: string) =>
    truncate(value, toNumber(width), ellipsis),
  );
  engine.addTransform('repeat', (value: unknown, count?: number) => repeat(value, toNumber(count)));
  engine.addTransform('coalesce', (value: unknown, ...fallbacks: unknown[]) =>
    coalesce(value, ...fallbacks),
  );
  engine.addTransform('wrap', (value: unknown, width?: number) => wrapText(value, toNumber(width)));
  engine.addTransform('mask', (value: unknown, visible?: number, maskChar?: string) =>
    mask(value, visible === undefined ? 4 : toNumber(visible), maskChar),
  );

  // ── Arithmetic ───────────────────────────────────────────────────────
  engine.addTransform('abs', (value: unknown) => Math.abs(toNumber(value)));
  engine.addTransform('neg', (value: unknown) => -toNumber(value));
  engine.addTransform('round', (value: unknown, decimals?: number) => {
    const scale = 10 ** Math.max(0, Math.trunc(toNumber(decimals)));
    return Math.round(toNumber(value) * scale) / scale;
  });
  engine.addTransform('ceil', (value: unknown) => Math.ceil(toNumber(value)));
  engine.addTransform('floor', (value: unknown) => Math.floor(toNumber(value)));
  engine.addTransform('num', (value: unknown) => toNumber(value));
  engine.addTransform('str', (value: unknown) => scalarToString(value));
  engine.addTransform('bool', (value: unknown) => Boolean(value));

  // ── Collections ──────────────────────────────────────────────────────
  // Present so a SUMMARY band can total a dataset directly, without needing an
  // aggregate element for every one-off figure.
  engine.addTransform('length', (value: unknown) =>
    Array.isArray(value) ? value.length : scalarToString(value).length,
  );
  engine.addTransform('join', (value: unknown, separator?: string) =>
    asArray(value)
      .map((entry) => scalarToString(entry))
      .filter(Boolean)
      .join(separator ?? ', '),
  );
  engine.addTransform('first', (value: unknown) => asArray(value)[0] ?? null);
  engine.addTransform('last', (value: unknown) => asArray(value).slice(-1)[0] ?? null);
  engine.addTransform('sum', (value: unknown, field?: string) =>
    asArray(value).reduce<number>((total, entry) => {
      if (field && entry && typeof entry === 'object') {
        return total + toNumber((entry as Record<string, unknown>)[field]);
      }
      return total + toNumber(entry);
    }, 0),
  );
  engine.addTransform('sortBy', (value: unknown, field?: string) => {
    const rows = [...asArray(value)];
    if (!field) {
      return rows.sort();
    }
    return rows.sort((left, right) => {
      const leftValue = (left as Record<string, unknown>)?.[field];
      const rightValue = (right as Record<string, unknown>)?.[field];
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return leftValue - rightValue;
      }
      return scalarToString(leftValue).localeCompare(scalarToString(rightValue));
    });
  });
  engine.addTransform('where', (value: unknown, field?: string, expected?: unknown) =>
    asArray(value).filter((entry) => {
      if (!field || !entry || typeof entry !== 'object') {
        return Boolean(entry);
      }
      return (entry as Record<string, unknown>)[field] === expected;
    }),
  );

  // ── Fallback ─────────────────────────────────────────────────────────
  engine.addTransform('default', (value: unknown, fallback?: unknown) =>
    value === null || value === undefined || value === '' ? (fallback ?? '') : value,
  );

  return engine;
};

/** Process-wide sandbox. Stateless, so sharing it is safe and saves setup cost. */
export const expressionEngine: ExpressionSandbox = createExpressionEngine();
