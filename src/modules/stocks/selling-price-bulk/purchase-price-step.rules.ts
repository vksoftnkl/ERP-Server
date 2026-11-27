import { Prisma } from '@prisma/client';
import type {
  FromBillLevelSource,
  PriceLevel,
  PriceScope,
  PurchasePriceMode,
  PurchasePriceResult,
} from './types/selling-price-bulk.types';

/**
 * Change Selling Price P2 — cost after a purchase (plan 2026-11-24 §4, addendum 1 2026-11-26).
 * The PURE half of the price step, in Prisma.Decimal end to end: no database, no request.
 *
 * The card's rule is ItemPriceRule (NexERP src/modules/inventory/master/items/item_price_rule.h),
 * ported here word for word, so the server's proposal and menu 30's own maths agree to the paisa
 * (decision 14: one golden table in jest and QtTest):
 *   By %    keeps the profit % on the cost WITHOUT tax, then GST, to the nearest R.Off step;
 *   By Rs   keeps the ₹ on the cost WITH tax (the card's 11-21 rule), to the nearest step;
 *   By User keeps the price.
 */

type Dec = Prisma.Decimal;
const D = (v: Prisma.Decimal.Value): Dec => new Prisma.Decimal(v);
const ZERO = D(0);
const HUNDRED = D(100);
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

/** Six decimals, half away from zero — every stored cost (numeric(18,6)). */
export function dp6(value: Dec): Dec {
  return value.toDecimalPlaces(6, HALF_UP);
}

// ── The card's Profit Type ──────────────────────────────────────────────────

export type CardType = 'BY_PERCENT' | 'BY_RUPEES' | 'BY_USER';

/** ipm_profit_type → the rule; blank or unknown is By User (the card's typeOf). */
export function cardTypeOf(label: string | null | undefined): CardType {
  const text = (label ?? '').trim();
  if (text === 'By %') {
    return 'BY_PERCENT';
  }
  if (text === 'By Rs') {
    return 'BY_RUPEES';
  }
  return 'BY_USER';
}

/** wot × (1 + GST %). */
export function withTax(wot: Dec, gstPerc: Dec): Dec {
  return wot.plus(wot.times(gstPerc).dividedBy(HUNDRED));
}

/** value ÷ (1 + GST %); 0 when the divisor is 0. */
export function withoutTax(value: Dec, gstPerc: Dec): Dec {
  const divisor = D(1).plus(gstPerc.dividedBy(HUNDRED));
  return divisor.isZero() ? ZERO : value.dividedBy(divisor);
}

/**
 * ItemPriceRule::roundToStep — the NEAREST Round Off step, half away from zero; step 0 = none.
 * The value and the number of steps in it are read to a millionth first, as the card does.
 */
export function roundToStep(value: Dec, step: Dec): Dec {
  if (!step.greaterThan(0)) {
    return value;
  }
  const v = value.toDecimalPlaces(6, HALF_UP);
  const steps = v.dividedBy(step).toDecimalPlaces(6, HALF_UP);
  return steps.toDecimalPlaces(0, HALF_UP).times(step);
}

/** ItemPriceRule::cardPriceFor — the price a kept figure gives on a cost. */
export function cardPriceFor(
  type: CardType,
  cost: Dec,
  costWot: Dec,
  figure: Dec,
  step: Dec,
  gstPerc: Dec,
): Dec {
  if (type === 'BY_RUPEES') {
    return roundToStep(cost.plus(figure), step);
  }
  return roundToStep(withTax(costWot.times(D(1).plus(figure.dividedBy(HUNDRED))), gstPerc), step);
}

/**
 * The figure a level keeps when its cost moves (menu 30's load, P1 decision 20): By Rs the ₹ on
 * the cost with tax (price − cost); By % the % stored on the line when it reproduces the price on
 * the old cost (the card's typed figure), else (price w/o tax − cost w/o tax) ÷ cost w/o tax.
 * Null when there is no figure: no old cost, or no price (ItemPriceRule::hasFigure).
 */
export function cardKeptFigure(args: {
  type: CardType;
  price: Dec;
  oldCost: Dec | null;
  gstPerc: Dec;
  step: Dec;
  storedMarkup: Dec | null;
}): { figure: Dec; typed: boolean } | null {
  const { type, price, oldCost, gstPerc, step, storedMarkup } = args;
  if (oldCost === null || !oldCost.greaterThan(0) || price.isZero()) {
    return null;
  }
  const oldCostWot = withoutTax(oldCost, gstPerc);
  const priceWot = withoutTax(price, gstPerc);
  if (!oldCostWot.greaterThan(0) || priceWot.isZero()) {
    return null;
  }
  if (type === 'BY_RUPEES') {
    return { figure: price.minus(oldCost), typed: false };
  }
  if (type === 'BY_PERCENT' && storedMarkup !== null) {
    const again = cardPriceFor('BY_PERCENT', oldCost, oldCostWot, storedMarkup, step, gstPerc);
    if (again.minus(price).abs().lessThan(D('0.005'))) {
      return { figure: storedMarkup, typed: true };
    }
  }
  return { figure: priceWot.minus(oldCostWot).dividedBy(oldCostWot).times(HUNDRED), typed: false };
}

// ── The new cost (B2, §4.3) ─────────────────────────────────────────────────

/**
 * Decision 13 — one bill, several portions of one item / unit / key (two bill lines, or the
 * allocation rows of one line): ONE cost = Σ landed value ÷ Σ qty in, per BASE unit w/o GST.
 * Free goods count in the qty (Q6: they lower the cost).
 */
export function weightedLandedWot(portions: ReadonlyArray<{ landedCostWot: Dec; baseQty: Dec }>): Dec {
  const qty = portions.reduce((sum, p) => sum.plus(p.baseQty), ZERO);
  if (!qty.greaterThan(0)) {
    // No qty in (should not happen on a posted line): the plain average of the rates.
    const n = portions.length;
    return n ? portions.reduce((sum, p) => sum.plus(p.landedCostWot), ZERO).dividedBy(n) : ZERO;
  }
  return portions.reduce((sum, p) => sum.plus(p.landedCostWot.times(p.baseQty)), ZERO).dividedBy(qty);
}

/**
 * §4.3 — the bought unit's cost: Cost Wot = landed per base unit × the unit's factor, 6 dp;
 * Cost = Cost Wot × (1 + the item's GST % today), 6 dp.
 */
export function billCost(landedWotPerBase: Dec, factor: Dec, gstPerc: Dec): { cost: Dec; costWot: Dec } {
  const costWot = landedWotPerBase.times(factor).toDecimalPlaces(reliableDecimals(factor), HALF_UP);
  return { cost: dp6(withTax(costWot, gstPerc)), costWot: dp6(costWot) };
}

/**
 * `pii_landed_cost_wot` is per BASE unit to 6 decimals, so × a factor carries that rounding × the
 * factor: E1's 1,348.22 a BOX is stored as 112.351667 a PCS, and × 12 gives 1,348.220004. The
 * bought unit keeps only the decimals the per-base figure vouches for: 6 − ⌈log10 factor⌉ (at
 * least 2; a factor up to 1 keeps 6). 12 → 4 decimals → 1,348.2200.
 */
export function reliableDecimals(factor: Dec): number {
  if (!factor.greaterThan(1)) {
    return 6;
  }
  return Math.max(2, 6 - Math.ceil(Math.log10(factor.toNumber())));
}

/**
 * §4.3 — a chain unit's pair: each half × (its factor ÷ the bought factor), 6 dp, both directions.
 * From the bought unit's 6-dp figures (E1: BOX 1,415.631000 → PCS 117.969250).
 */
export function chainCost(
  bought: { cost: Dec; costWot: Dec },
  boughtFactor: Dec,
  unitFactor: Dec,
): { cost: Dec; costWot: Dec } {
  if (!boughtFactor.greaterThan(0)) {
    return { cost: bought.cost, costWot: bought.costWot };
  }
  const ratio = (value: Dec) => dp6(value.times(unitFactor).dividedBy(boughtFactor));
  return { cost: ratio(bought.cost), costWot: ratio(bought.costWot) };
}

/** Q12 — an MRP (or sale price) key matched per piece: key × (unit factor ÷ bought factor), 6 dp. */
export function chainKey(key: Dec, boughtFactor: Dec, unitFactor: Dec): Dec {
  return boughtFactor.greaterThan(0) ? dp6(key.times(unitFactor).dividedBy(boughtFactor)) : key;
}

/** Two keys are the same price point when they agree to the paisa. */
export function sameKey(a: Dec | null, b: Dec | null): boolean {
  if (a === null || b === null) {
    return a === null && b === null;
  }
  return a.minus(b).abs().lessThan(D('0.005'));
}

/** B5 (Q5) — a key compared per BASE unit across units: key ÷ factor, 6 dp. */
export function keyPerBase(key: Dec | null, factor: Dec): Dec | null {
  if (key === null || !key.greaterThan(0)) {
    return null;
  }
  return factor.greaterThan(0) ? dp6(key.dividedBy(factor)) : key;
}

// ── The prices (§4.4) ───────────────────────────────────────────────────────

/** One level of the line as it stands. */
export interface CurrentLevel {
  level: PriceLevel;
  price: Dec;
  /** ipm_price_x_markup_perc of the line itself (the card's typed %); null when not its own. */
  storedMarkup: Dec | null;
}

export interface ProposedLevel {
  level: PriceLevel;
  price: Dec;
  from: FromBillLevelSource;
  /** By % (RULE): the kept % — sent as the level's markup so a typed % stays stored as typed. */
  keptPercent: Dec | null;
  /** Why the level kept its price (By User, no price, first cost, a sold-at level, …). */
  why: string | null;
}

/**
 * §4.4 — every level of one line for a new cost: a price typed on the bill wins (bought unit
 * only); the rest re-price by the line's own Profit Type (the card's onCostMove). No re-price
 * for a level priced 0, a line with no old cost ("first cost"), or a "sold at" line's fixed
 * default level.
 */
export function proposeLevels(args: {
  levels: readonly CurrentLevel[];
  profitType: string | null | undefined;
  roundOff: Dec;
  gstPerc: Dec;
  oldCost: Dec | null;
  newCost: Dec;
  newCostWot: Dec;
  /** The bill's Sell A–D (bought unit only): a level above 0 wins. */
  billPrices?: ReadonlyArray<Dec | null>;
  /** A sold-at line's fixed level (sales.default_price_level), 1–4; null for any other line. */
  lockedLevel?: number | null;
}): ProposedLevel[] {
  const type = cardTypeOf(args.profitType);
  return args.levels.map((current) => {
    const typed = args.billPrices?.[current.level - 1] ?? null;
    if (typed !== null && typed.greaterThan(0)) {
      return { level: current.level, price: typed, from: 'BILL', keptPercent: null, why: null };
    }
    const keep = (why: string): ProposedLevel => ({
      level: current.level,
      price: current.price,
      from: 'KEPT',
      keptPercent: null,
      why,
    });
    if (type === 'BY_USER') {
      return keep('By User keeps the price');
    }
    if (current.price.isZero()) {
      return keep('no price on this level');
    }
    if (args.lockedLevel !== null && args.lockedLevel !== undefined && args.lockedLevel === current.level) {
      return keep('a stock-bucket price is fixed');
    }
    // The card works the cost w/o tax from the cost it is given (menu 30's pricesForCost).
    const costWot = withoutTax(args.newCost, args.gstPerc);
    if (!costWot.greaterThan(0)) {
      return keep('no cost');
    }
    const kept = cardKeptFigure({
      type,
      price: current.price,
      oldCost: args.oldCost,
      gstPerc: args.gstPerc,
      step: args.roundOff,
      storedMarkup: current.storedMarkup,
    });
    if (!kept) {
      return keep('first cost: the profit is worked out, not the price');
    }
    return {
      level: current.level,
      price: cardPriceFor(type, args.newCost, costWot, kept.figure, args.roundOff, args.gstPerc),
      from: 'RULE',
      keptPercent: type === 'BY_PERCENT' ? kept.figure : null,
      why: null,
    };
  });
}

/**
 * Q9 — the new line a typed bill price makes for a bought key with no line: the typed levels,
 * the other levels from the line that prices that stock today ("Start from", P1 §4.8: its
 * Profit Type, R.Off and each level's kept figure), the cost the bill's.
 */
export function proposeNewLine(args: {
  startFrom: {
    levels: readonly CurrentLevel[];
    profitType: string | null | undefined;
    roundOff: Dec;
    lineCost: Dec | null;
  } | null;
  billPrices: ReadonlyArray<Dec | null>;
  gstPerc: Dec;
  newCost: Dec;
  newCostWot: Dec;
}): ProposedLevel[] {
  const empty: CurrentLevel[] = ([1, 2, 3, 4] as PriceLevel[]).map((level) => ({
    level,
    price: ZERO,
    storedMarkup: null,
  }));
  return proposeLevels({
    levels: args.startFrom?.levels ?? empty,
    profitType: args.startFrom?.profitType ?? 'By User',
    roundOff: args.startFrom?.roundOff ?? ZERO,
    gstPerc: args.gstPerc,
    oldCost: args.startFrom?.lineCost ?? null,
    newCost: args.newCost,
    newCostWot: args.newCostWot,
    billPrices: args.billPrices,
  });
}

// ── Who writes which line (§4.2.4, C9, Q10) ─────────────────────────────────

/** The target line as it stands at the bill's branch: the branch's own, All branches, or none. */
export type PurchaseTarget = 'OWN' | 'ALL' | 'NONE';

export interface PurchaseTargetScope {
  /** The scope the write resolves at (resolveTargetScope's `requested`). */
  scope: PriceScope;
  /** The loaded line's own scope (resolveTargetScope's `rowScope`); null = no line. */
  rowScope: PriceScope | null;
  /** C4 — which later bills count for B5: the whole company (All branches) or the branch. */
  laterScope: 'COMPANY' | 'BRANCH';
  /** The price log / audit words. */
  label: 'all branches' | 'this branch' | '→ this branch';
}

/**
 * §4.2.4 — ONE pure table (the P3 hook):
 *
 *   target          head office poster          store poster
 *   own line        BRANCH update               BRANCH update
 *   All branches    CHAIN update (every branch) BRANCH insert, "→ this branch" (Q10)
 *   none (NO_LINE)  CHAIN insert (O7, Q9)       BRANCH insert
 */
export function purchaseTargetScope(isHq: boolean, target: PurchaseTarget): PurchaseTargetScope {
  if (target === 'OWN') {
    return { scope: 'BRANCH', rowScope: 'BRANCH', laterScope: 'BRANCH', label: 'this branch' };
  }
  if (target === 'ALL') {
    return isHq
      ? { scope: 'CHAIN', rowScope: 'CHAIN', laterScope: 'COMPANY', label: 'all branches' }
      : { scope: 'BRANCH', rowScope: 'CHAIN', laterScope: 'BRANCH', label: '→ this branch' };
  }
  return isHq
    ? { scope: 'CHAIN', rowScope: null, laterScope: 'COMPANY', label: 'all branches' }
    : { scope: 'BRANCH', rowScope: null, laterScope: 'BRANCH', label: 'this branch' };
}

// ── The mode and the results ────────────────────────────────────────────────

const MODES: readonly string[] = ['NONE', 'COST_ONLY', 'UPDATE_PRICES', 'OPEN_CHANGE_SELLING'];

/**
 * §4.1 — the mode a bill was saved under (pi_policy). An old snapshot maps: allowPriceUpdate
 * false or priceUpdate 'OFF' → NONE; otherwise its priceUpdate. No snapshot → NONE.
 */
export function purchasePriceModeOf(policy: unknown): PurchasePriceMode {
  if (!policy || typeof policy !== 'object') {
    return 'NONE';
  }
  const p = policy as { allowPriceUpdate?: unknown; priceUpdate?: unknown };
  const token = typeof p.priceUpdate === 'string' ? p.priceUpdate.trim().toUpperCase() : '';
  if (p.allowPriceUpdate === false || token === 'OFF' || !MODES.includes(token)) {
    return 'NONE';
  }
  return token as PurchasePriceMode;
}

/**
 * One bill line, several bought keys (allocation rows of different MRPs): the line's one result
 * is the strongest of its keys', in this order.
 */
const RESULT_ORDER: readonly PurchasePriceResult[] = [
  'UPDATED',
  'COST_ONLY',
  'TO_REVIEW',
  'NO_LINE',
  'LATER_BILL',
  'KEPT_NEWER',
  'NONE',
  'OFF',
];

export function strongestResult(results: readonly PurchasePriceResult[]): PurchasePriceResult {
  if (!results.length) {
    return 'NONE';
  }
  return [...results].sort((a, b) => RESULT_ORDER.indexOf(a) - RESULT_ORDER.indexOf(b))[0];
}

/** Indian money words: 1,300.00 (en-IN grouping), two decimals. */
export function money(value: Dec | number): string {
  const n = typeof value === 'number' ? value : value.toDecimalPlaces(2, HALF_UP).toNumber();
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** A quantity in words: no trailing zeros (10, 2.5). */
export function qtyText(value: Dec): string {
  return value.toDecimalPlaces(3, HALF_UP).toString();
}

/** A ratio in words: 12, 24, 0.5. */
export function ratioText(value: Dec): string {
  return value.toDecimalPlaces(4, HALF_UP).toString();
}

/** `YYYY-MM-DD` → `DD-MM-YYYY`. */
export function displayDate(day: string): string {
  return day.slice(0, 10).split('-').reverse().join('-');
}
