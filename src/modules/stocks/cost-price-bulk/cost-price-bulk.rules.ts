import { Prisma } from '@prisma/client';
import { IGNORED_COLUMNS } from '../../Inventory/item-price-log/price-change-diff';
import type {
  PriceRowLevelWrite,
  PriceRowRewrite,
} from '../../Inventory/item-price-log/price-master-writer.service';
import type { BelowCostPolicy } from '../selling-price-bulk/types/selling-price-bulk.types';
import {
  BY_USER,
  COST_BULK,
  OVERRIDABLE_CODES,
  type CostBulkCounts,
  type CostBulkNote,
  type LeftOutReason,
} from './types/cost-price-bulk.types';

/**
 * Cost Price – Bulk Change (menu 298) — the PURE rules: who may be on the
 * grid, how a child unit hangs off its parent, the four stored figures of a
 * level, and every check a changed row meets on validate and save. No
 * database, no request: the service feeds them what it read.
 *
 * Money is Prisma.Decimal throughout; a figure becomes a number only at the
 * JSON boundary (the service's `num`).
 */

export type Dec = Prisma.Decimal;
const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);
/** The price columns are numeric with 6 decimals in practice; round once, there. */
const SCALE = 6;

/** A wire number (or a Decimal) as a Decimal, through its text — never through float arithmetic. */
export function dec(value: number | string | Dec): Dec {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value));
}

function round6(value: Dec): Dec {
  return value.toDecimalPlaces(SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

// ── eligibility ("Plain stock") ─────────────────────────────────────────────

/** What eligibility is decided on, as the gateway reads it for one item. */
export interface EligibilityFlags {
  isActive: boolean;
  /** item_is_batch_based — the old batch tick. */
  isBatchBased: boolean;
  /**
   * The EFFECTIVE preset (the item's own item_track_preset_id, else its
   * group's itg_track_preset_id) tracks batch, MRP, sale price or serial.
   * False when there is no preset at all.
   */
  presetTracks: boolean;
}

/**
 * Plan §0 — why an item may NOT be on this grid, or null when it may: an
 * active item whose effective preset tracks nothing (or that has none) and
 * whose old batch tick is off. Inactive is reported first (the popup says
 * "is inactive"), then the preset, then the tick. The list query's
 * LEFT_OUT_REASON_SQL is the same rule in SQL — change both together.
 */
export function leftOutReasonOf(
  flags: EligibilityFlags,
): Exclude<LeftOutReason, 'NO_PRICE_ROW'> | null {
  if (!flags.isActive) {
    return 'INACTIVE';
  }
  if (flags.presetTracks) {
    return 'NOT_PLAIN_STOCK';
  }
  if (flags.isBatchBased) {
    return 'OLD_BATCH_TICK';
  }
  return null;
}

/** The popup's "Tracked as": the effective preset's name, or "Plain stock" with none. */
export function trackedAsOf(presetName: string | null | undefined): string {
  return presetName?.trim() || 'Plain stock';
}

/** The popup's "Why", per reason. */
export function leftOutReasonText(reason: LeftOutReason, trackedAs: string): string {
  switch (reason) {
    case 'INACTIVE':
      return 'The item is not active.';
    case 'NOT_PLAIN_STOCK':
      return `Tracked as ${trackedAs} — not Plain stock. Change its prices in Change Selling Price (menu 30).`;
    case 'OLD_BATCH_TICK':
      return 'The old "batch" tick is on, so it is treated as batch. Change its prices in Change Selling Price (menu 30).';
    case 'NO_PRICE_ROW':
    default:
      return 'No price in force today at this branch. Set its prices on the item card.';
  }
}

// ── child units ─────────────────────────────────────────────────────────────

/** One unit and the unit above it (the previous active iuc_unit_slno). */
export interface UnitLinkInput {
  /** iuc_to_base_factor of the unit above; null on the top unit. */
  parentToBase: Dec | null;
  toBase: Dec;
  /** iuc_unit_factor — the item card's step: how many of this unit make one of the unit above. */
  unitFactor: Dec;
}

/**
 * How close the to-base ratio and the keyed step must be to count as the same
 * number: RELATIVE, because to-base factors are stored to 6 dp and the error
 * of their ratio grows with it — 0.1 ÷ 0.008333 = 12.00048, and the live
 * "undskndk" BOX / DZ pair gives 112.00672 for a keyed 112.
 */
export const UNIT_FACTOR_TOLERANCE = new Prisma.Decimal('0.0001');

/**
 * Plan §3 — how many of a unit make one of its parent: parent to-base ÷ this
 * to-base (the item card's rule, notes 147 A). Cross-checked against the
 * keyed step `iuc_unit_factor`: when the two agree within
 * UNIT_FACTOR_TOLERANCE of the keyed step, the keyed step is the answer,
 * exact; when they disagree the ratio is, and `factorsAgree` says so. The top
 * unit has no parent: null, and agrees trivially.
 */
export function unitLink(input: UnitLinkInput): {
  unitsPerParent: Dec | null;
  factorsAgree: boolean;
} {
  if (input.parentToBase === null) {
    return { unitsPerParent: null, factorsAgree: true };
  }
  if (input.toBase.lte(0)) {
    return { unitsPerParent: null, factorsAgree: false };
  }
  const ratio = round6(input.parentToBase.div(input.toBase));
  const agree =
    input.unitFactor.gt(0) &&
    ratio.minus(input.unitFactor).abs().lte(input.unitFactor.times(UNIT_FACTOR_TOLERANCE));
  return { unitsPerParent: agree ? input.unitFactor : ratio, factorsAgree: agree };
}

// ── the figures a level stores ──────────────────────────────────────────────

/** price ÷ (1 + tax%), 6 dp. A divisor ≤ 0 (a −100 % tax) leaves the figure as it is. */
export function exclusiveOfTax(withTax: Dec, taxPerc: Dec): Dec {
  const divisor = HUNDRED.plus(taxPerc).div(HUNDRED);
  return divisor.lte(0) ? round6(withTax) : round6(withTax.div(divisor));
}

/**
 * "Price wins" (menu 30's §5.1): the level's w/o-tax figure and markup are
 * derived from the price and the NEW cost, never trusted from the client.
 * Markup is (price − cost) ÷ cost × 100 on the tax-inclusive pair. A level
 * priced 0 is a level not in use and stores 0 / 0 / 0, as the item card's
 * rows do; an unknown cost (0) gives markup 0, never Infinity.
 */
export function levelFigures(price: Dec, taxPerc: Dec, cost: Dec): PriceRowLevelWrite {
  const p = round6(price);
  if (p.lte(0)) {
    return { price: ZERO, priceWot: ZERO, markupPerc: ZERO };
  }
  return {
    price: p,
    priceWot: exclusiveOfTax(p, taxPerc),
    markupPerc: cost.gt(0) ? round6(p.minus(cost).div(cost).times(HUNDRED)) : ZERO,
  };
}

// ── the concurrency token ───────────────────────────────────────────────────

/**
 * The token a row is loaded with and saved against: md5 of the row's
 * `to_jsonb` WITHOUT the columns a change is not judged by — the same list the
 * Price Change Log ignores (stamps, sync mark, generated keys). So any change
 * to a business column (a price, the cost, the period, the deleted flag …)
 * changes the token, while a sync stamp or a no-op save does not.
 * `ipm_updated_on` alone could not be the token: it is NULL on a row never
 * updated, and equal across two saves in one millisecond. Built in SQL — see
 * `rowTokenSql` in the gateway.
 */
export const TOKEN_IGNORED_COLUMNS: readonly string[] = IGNORED_COLUMNS.IPM;

// ── a row's checks ──────────────────────────────────────────────────────────

/** A price row as stored, with what the save must know about it (read under FOR UPDATE). */
export interface StoredPriceRow {
  ipmId: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  unitName: string | null;
  /** The row exists, is not deleted, is a headline, its item and unit are live and in scope. */
  usable: boolean;
  /** It is the headline that answers at this branch TODAY (in force, branch before chain). */
  current: boolean;
  eligibility: EligibilityFlags;
  /** ipm_branch_id IS NULL — the all-branches row. */
  isChain: boolean;
  /**
   * ipm_company_id IS NULL — a row shared by every company. It is never
   * rewritten in place: the save writes a company-scoped copy that shadows it
   * for this company (as menu 30's S3 does), and leaves it as it is.
   */
  companyShared: boolean;
  rowToken: string;
  costPrice: Dec;
  maxPrice: Dec;
  minPrice: Dec;
  profitType: string;
  prices: readonly [Dec, Dec, Dec, Dec];
}

/** One row of the request, as the service decoded it. */
export interface RowRequest {
  /** Position in the body's rows[] (0-based) — the `field` path, as the house validation pipe writes it. */
  index: number;
  lineNo: number;
  ipmId: string;
  rowToken: string;
  costPrice: Dec;
  /** Absent / null = the stored figure. */
  mrp?: Dec | null;
  minPrice?: Dec | null;
  profitType?: string | null;
  /** Levels sent; an absent level keeps its stored price. */
  levels?: ReadonlyArray<{ level: number; price: Dec }>;
}

export interface RowContext {
  taxPerc: Dec;
  /** The caller's user type is HQ (isHqUserType). */
  isHq: boolean;
  belowCostPolicy: BelowCostPolicy;
  /** fixed.price_levels names for 1–4. */
  levelNames: readonly [string, string, string, string];
  /**
   * fixed.price_levels.price_lvl_is_active for 1–4 (and not deleted). An inactive level
   * is hidden on the screen, so it is never checked against MRP / Min / cost
   * — it keeps its stored price, and only its w/o tax and markup are
   * recomputed.
   */
  levelActive: readonly [boolean, boolean, boolean, boolean];
  actor: string;
}

/** ipm_price_<a-d>_markup_perc is numeric(9,3): the largest markup it can store. */
export const MAX_MARKUP_PERC = new Prisma.Decimal('999999.999');

export interface RowPlan {
  lineNo: number;
  ipmId: string;
  refusals: CostBulkNote[];
  warnings: CostBulkNote[];
  /** True when the user-facing values differ from the stored ones. */
  changed: boolean;
  /** The row is company-shared: the write is a company-scoped copy, not an update in place. */
  companyCopy: boolean;
  /** The write when the row is usable and changed (refused or not — the caller decides). */
  write: PriceRowRewrite | null;
}

/** 140, 140.50, 12.125 — at least two decimals, never fewer than the figure has. */
export function money(value: Dec): string {
  return value.decimalPlaces() > 2 ? value.toFixed() : value.toFixed(2);
}

function note(
  code: string,
  level: 'REFUSE' | 'WARN',
  request: RowRequest,
  who: string,
  text: string,
  field: string,
): CostBulkNote {
  return {
    code,
    level,
    message: `Line ${request.lineNo} · ${who}: ${text}`,
    field: `rows.${request.index}.${field}`,
    line: request.lineNo,
    ipmId: request.ipmId,
    overridable: level === 'WARN' && OVERRIDABLE_CODES.includes(code),
  };
}

function whoOf(row: StoredPriceRow | null, request: RowRequest): string {
  if (!row) {
    return `price row ${request.ipmId}`;
  }
  const item = [row.itemCode, row.itemName].filter(Boolean).join(' ');
  return row.unitName ? `${item} · ${row.unitName}` : item;
}

/**
 * Plan §3 "Per row the server" — everything one row meets, in order:
 *
 *  1. it is still today's headline at this branch (else ROW_NOT_CURRENT),
 *     its item active (INACTIVE) and Plain stock (NOT_PLAIN_STOCK), and
 *     unchanged since load (ROW_CHANGED) — any of these and nothing else is
 *     judged: the row the user priced is not the row there now;
 *  2. a row whose values are all the stored ones is UNCHANGED — no checks, no
 *     write;
 *  3. an all-branches row needs HQ (CHAIN_NEEDS_HQ);
 *  4. per ACTIVE level in use (price > 0; an inactive level is hidden on the
 *     screen and not judged): above the MRP — the new one when sent — is
 *     ABOVE_MRP (MRP 0 = none), below the Min is BELOW_MIN, both refusals;
 *     below the new cost is BELOW_COST, by `inventory.below_cost_price`:
 *     restrict refuses, warning warns (tick to save), allow says nothing;
 *  5. a By User row (its rule after the save) whose cost changed while every
 *     active level keeps its stored price warns BY_USER_PRICES_KEPT;
 *  6. a markup (any level, active or not — all four are written) that the
 *     numeric(9,3) column cannot hold refuses COST_BULK_COST_TOO_LOW: a
 *     mistyped tiny cost (0.02 against 250) would otherwise fail the write.
 *
 * The write recomputes cost w/o tax and every level's w/o tax and markup from
 * the price against the NEW cost ("price wins"); round-off is not written.
 */
export function planRow(request: RowRequest, row: StoredPriceRow | null, ctx: RowContext): RowPlan {
  const plan: RowPlan = {
    lineNo: request.lineNo,
    ipmId: request.ipmId,
    refusals: [],
    warnings: [],
    changed: false,
    companyCopy: row?.companyShared === true,
    write: null,
  };
  const who = whoOf(row, request);
  const refuse = (code: string, text: string, field = 'ipmId') =>
    plan.refusals.push(note(code, 'REFUSE', request, who, text, field));

  // 1 — the row itself
  if (!row || !row.usable) {
    refuse(COST_BULK.ROW_NOT_CURRENT, 'this price row is not there now. Load the items again.');
    return plan;
  }
  const reason = leftOutReasonOf(row.eligibility);
  if (reason === 'INACTIVE') {
    refuse(COST_BULK.INACTIVE, 'the item is not active.');
    return plan;
  }
  if (reason) {
    refuse(
      COST_BULK.NOT_PLAIN_STOCK,
      reason === 'OLD_BATCH_TICK'
        ? 'the old "batch" tick is on, so it is not Plain stock. Use Change Selling Price.'
        : 'it is not Plain stock any more. Use Change Selling Price.',
    );
    return plan;
  }
  if (!row.current) {
    refuse(
      COST_BULK.ROW_NOT_CURRENT,
      "this is no longer today's price at this branch. Load the items again.",
    );
    return plan;
  }
  if (row.rowToken !== request.rowToken) {
    refuse(
      COST_BULK.ROW_CHANGED,
      'the price was changed after you loaded it. Load the items again.',
      'rowToken',
    );
    return plan;
  }

  // the values after the save
  const cost = request.costPrice;
  const mrp = request.mrp ?? row.maxPrice;
  const min = request.minPrice ?? row.minPrice;
  const profitType = request.profitType ?? row.profitType;
  const prices = row.prices.map((stored, index) => {
    const sent = request.levels?.find((level) => level.level === index + 1);
    return sent ? sent.price : stored;
  }) as [Dec, Dec, Dec, Dec];

  // 2 — unchanged
  const pricesKept = prices.every((price, index) => price.eq(row.prices[index]));
  plan.changed =
    !cost.eq(row.costPrice) ||
    !mrp.eq(row.maxPrice) ||
    !min.eq(row.minPrice) ||
    profitType !== row.profitType ||
    !pricesKept;
  if (!plan.changed) {
    return plan;
  }

  // 3 — the all-branches row
  if (row.isChain && !ctx.isHq) {
    refuse(
      COST_BULK.CHAIN_NEEDS_HQ,
      'this price is for all branches; only head office may change it.',
    );
  }

  // 4 — the prices against MRP, Min and the new cost
  const levels = prices.map((price, index) => ({
    price,
    name: ctx.levelNames[index],
    level: index + 1,
  }));
  const inUse = levels.filter((level) => level.price.gt(0) && ctx.levelActive[level.level - 1]);
  const list = (picked: typeof inUse) =>
    picked.map((l) => `${l.name} ${money(l.price)}`).join(', ');
  const verb = (picked: typeof inUse) => (picked.length === 1 ? 'is' : 'are');
  const aboveMrp = mrp.gt(0) ? inUse.filter((level) => level.price.gt(mrp)) : [];
  if (aboveMrp.length) {
    refuse(
      COST_BULK.ABOVE_MRP,
      `${list(aboveMrp)} ${verb(aboveMrp)} above the MRP ${money(mrp)}.`,
      'levels',
    );
  }
  const belowMin = min.gt(0) ? inUse.filter((level) => level.price.lt(min)) : [];
  if (belowMin.length) {
    refuse(
      COST_BULK.BELOW_MIN,
      `${list(belowMin)} ${verb(belowMin)} below the Min ${money(min)}.`,
      'levels',
    );
  }
  const belowCost = cost.gt(0) ? inUse.filter((level) => level.price.lt(cost)) : [];
  if (belowCost.length && ctx.belowCostPolicy !== 'allow') {
    const text = `${list(belowCost)} ${verb(belowCost)} below the new cost ${money(cost)}.`;
    const field = 'levels';
    if (ctx.belowCostPolicy === 'restrict') {
      refuse(COST_BULK.BELOW_COST, text, field);
    } else {
      plan.warnings.push(note(COST_BULK.BELOW_COST, 'WARN', request, who, text, field));
    }
  }

  // 5 — a By User row repriced by nobody (only the levels the user can see count)
  const activeKept = prices.every(
    (price, index) => !ctx.levelActive[index] || price.eq(row.prices[index]),
  );
  if (profitType === BY_USER && !cost.eq(row.costPrice) && activeKept) {
    plan.warnings.push(
      note(
        COST_BULK.BY_USER_PRICES_KEPT,
        'WARN',
        request,
        who,
        `the cost changed from ${money(row.costPrice)} to ${money(cost)}, but this By User unit still has its old prices.`,
        'levels',
      ),
    );
  }

  const figures = prices.map((price) => levelFigures(price, ctx.taxPerc, cost)) as [
    PriceRowLevelWrite,
    PriceRowLevelWrite,
    PriceRowLevelWrite,
    PriceRowLevelWrite,
  ];

  // 6 — a markup the column cannot hold (PostgreSQL rounds to its 3 dp on store)
  const tooHigh = levels.filter((level) =>
    figures[level.level - 1].markupPerc
      .toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP)
      .abs()
      .gt(MAX_MARKUP_PERC),
  );
  if (tooHigh.length) {
    refuse(
      COST_BULK.COST_TOO_LOW,
      `the new cost ${money(cost)} is too low for ${list(tooHigh)}: the profit would be over ` +
        '999,999.999 %, which cannot be stored. Check the New Cost.',
      'costPrice',
    );
  }

  plan.write = {
    ipmId: row.ipmId,
    costPrice: round6(cost),
    costWot: exclusiveOfTax(cost, ctx.taxPerc),
    maxPrice: round6(mrp),
    minPrice: round6(min),
    profitType,
    levels: figures,
  };
  return plan;
}

/** One override as the request sends it. No line = every line with that code. */
export interface OverrideRequest {
  code: string;
  line?: number | null;
}

/** The warning is ticked: its code (overridable) is in overrides[] for its line or for every line. */
export function isOverridden(
  warning: CostBulkNote,
  overrides: readonly OverrideRequest[],
): boolean {
  return (
    warning.overridable &&
    overrides.some(
      (o) =>
        o.code === warning.code &&
        (o.line === undefined || o.line === null || o.line === warning.line),
    )
  );
}

/** What stops a save: every refusal, and every warning not ticked. */
export function blockingNotes(
  plans: readonly RowPlan[],
  overrides: readonly OverrideRequest[],
): CostBulkNote[] {
  return plans.flatMap((plan) => [
    ...plan.refusals,
    ...plan.warnings.filter((warning) => !isOverridden(warning, overrides)),
  ]);
}

export function countsOf(plans: readonly RowPlan[]): CostBulkCounts {
  return {
    rows: plans.length,
    changed: plans.filter((plan) => plan.changed).length,
    unchanged: plans.filter((plan) => !plan.changed && !plan.refusals.length).length,
    refused: plans.filter((plan) => plan.refusals.length > 0).length,
    warned: plans.filter((plan) => plan.warnings.length > 0).length,
  };
}

/** The log / audit reason of a row saved with ticked warnings, else null. */
export function tickedReason(plan: RowPlan): string | null {
  if (!plan.warnings.length) {
    return null;
  }
  return `Warnings ticked at save: ${plan.warnings.map((w) => `${w.code} (${w.message})`).join('; ')}`;
}
