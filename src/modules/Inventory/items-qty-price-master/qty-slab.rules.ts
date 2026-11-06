import { Prisma } from '@prisma/client';

/**
 * Qty-wise prices (menu 244, `inventory.item_qty_price`) — the PURE slab rule:
 * which slabs can price a line, in which order, and what one slab makes of a
 * price. Plan 2026-11-05 "Qty-wise Prices + Cost + Card Rate" §7.2 / §4.4 /
 * §4.2 step 3.5, with the user's answers Q3 (most specific wins), Q4 / Q11
 * (each line by its own qty, in its own unit), Q6 (the document's date) and
 * Q12 (levels 1–4 only).
 *
 * No database, no request. Two readers on the server:
 *   - the price lookup (`/master-lookups/item-price` → `qty_slabs[]`) filters
 *     and ranks with `slabsFor`;
 *   - the Qty-wise Prices save (`/item-qty-prices/save-with-rates`) judges every
 *     slab against the card with `judgeSlab`.
 * The Qt port is `NexERP/src/shared/pricing/qty_slab_rules.{h,cpp}`: same
 * names, same cases (`qty-slab.rules.spec.ts`). Change both together.
 *
 * Money is Prisma.Decimal throughout; a figure becomes a number only at the
 * JSON boundary.
 */

export type Dec = Prisma.Decimal;
const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

/** `iqp_price_mode`: P = % off the price, R = ₹ off each, F = a fixed price each. */
export const QTY_PRICE_MODES = ['P', 'R', 'F'] as const;
export type QtyPriceMode = (typeof QTY_PRICE_MODES)[number];

/** The price levels a slab may name (Q12 / C6): blank, or one of these when active. */
export const SELLING_SLAB_LEVELS = [1, 2, 3, 4] as const;

/** The company setting that switches slabs on bills (D9, default On). */
export const APPLY_QTY_PRICES_SETTING_KEY = 'sales.apply_qty_prices';

/** One slab, as the rule reads it. Dates are `YYYY-MM-DD`; NULL scope = all. */
export interface QtySlab {
  iqpId: string;
  companyId: string | null;
  branchId: string | null;
  /** iqp_party_id = sales.customers.cus_id = the customer's ledger id (one partyId). */
  partyId: string | null;
  priceLevel: number | null;
  /** Inclusive lower bound. */
  fromQty: Dec;
  /** EXCLUSIVE upper bound; null = "and above". */
  toQty: Dec | null;
  priceMode: string;
  discPct: Dec | null;
  flatOff: Dec | null;
  price: Dec | null;
  /** The R / F amount includes tax. */
  isTaxIncl: boolean;
  effectiveFrom: string;
  /** Inclusive; null = open. */
  effectiveTo: string | null;
  isActive: boolean;
  /** iqp_modified_on (ISO) — the last tie-break only, for synced overlapping rows. */
  modifiedOn?: string | null;
}

/** The columns `qtySlabOf` reads — a Prisma `ItemQtyPrice` satisfies it as is. */
export interface QtySlabRecord {
  iqpId: string;
  iqpCompanyId: string | null;
  iqpBranchId: string | null;
  iqpPartyId: string | null;
  iqpPriceLevel: number | null;
  iqpFromQty: Dec;
  iqpToQty: Dec | null;
  iqpPriceMode: string;
  iqpDiscPct: Dec | null;
  iqpFlatOff: Dec | null;
  iqpPrice: Dec | null;
  iqpIsTaxIncl: boolean;
  iqpEffectiveFrom: Date;
  iqpEffectiveTo: Date | null;
  iqpIsActive: boolean;
  iqpModifiedOn?: Date | null;
}

/** A DATE column as Prisma hands it back (UTC midnight) → `YYYY-MM-DD`. */
export function dayOf(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** A stored slab as the rule reads it. */
export function qtySlabOf(record: QtySlabRecord): QtySlab {
  return {
    iqpId: record.iqpId,
    companyId: record.iqpCompanyId,
    branchId: record.iqpBranchId,
    partyId: record.iqpPartyId,
    priceLevel: record.iqpPriceLevel,
    fromQty: new Prisma.Decimal(record.iqpFromQty),
    toQty: record.iqpToQty === null ? null : new Prisma.Decimal(record.iqpToQty),
    priceMode: (record.iqpPriceMode || 'P').trim().toUpperCase(),
    discPct: record.iqpDiscPct === null ? null : new Prisma.Decimal(record.iqpDiscPct),
    flatOff: record.iqpFlatOff === null ? null : new Prisma.Decimal(record.iqpFlatOff),
    price: record.iqpPrice === null ? null : new Prisma.Decimal(record.iqpPrice),
    isTaxIncl: record.iqpIsTaxIncl,
    effectiveFrom: dayOf(record.iqpEffectiveFrom),
    effectiveTo: record.iqpEffectiveTo ? dayOf(record.iqpEffectiveTo) : null,
    isActive: record.iqpIsActive,
    modifiedOn: record.iqpModifiedOn ? record.iqpModifiedOn.toISOString() : null,
  };
}

/** Who and when a line is priced for — the lookup's query, resolved. */
export interface SlabScope {
  /** Absent = only slabs for every company (never another company's). */
  companyId?: string | null;
  /** Absent = only slabs for every branch. */
  branchId?: string | null;
  /** The customer (ledger id); absent = only slabs for every party. */
  partyId?: string | null;
  /** The line's price level, 1–7. Only 1–4 are selling levels: 5 / 6 / 7 get no slab. */
  priceLevel: number;
  /** `YYYY-MM-DD` — the document's date (Q6). */
  onDate: string;
}

/** A blank level (all levels), or one of 1–4 that is active (`activeLevels`). */
export function isSellingSlabLevel(
  level: number | null | undefined,
  activeLevels: Iterable<number>,
): boolean {
  if (level === null || level === undefined) {
    return true;
  }
  const active = new Set(activeLevels);
  return (SELLING_SLAB_LEVELS as readonly number[]).includes(level) && active.has(level);
}

/**
 * Q3 — how specific a slab is: 8 × party set + 4 × level set + 2 × branch set +
 * 1 × company set. Customer beats price level beats branch beats company.
 */
export function slabSpecificity(
  slab: Pick<QtySlab, 'partyId' | 'priceLevel' | 'branchId' | 'companyId'>,
): number {
  return (
    (slab.partyId !== null ? 8 : 0) +
    (slab.priceLevel !== null ? 4 : 0) +
    (slab.branchId !== null ? 2 : 0) +
    (slab.companyId !== null ? 1 : 0)
  );
}

/** `effective_from ≤ day ≤ effective_to` (to null = open). */
export function slabInForce(
  slab: Pick<QtySlab, 'effectiveFrom' | 'effectiveTo'>,
  day: string,
): boolean {
  const d = day.slice(0, 10);
  return (
    slab.effectiveFrom.slice(0, 10) <= d &&
    (slab.effectiveTo === null || d <= slab.effectiveTo.slice(0, 10))
  );
}

/** Still to come or running on `day`: effective_to null or ≥ day. */
export function slabInForceOnOrAfter(slab: Pick<QtySlab, 'effectiveTo'>, day: string): boolean {
  return slab.effectiveTo === null || slab.effectiveTo.slice(0, 10) >= day.slice(0, 10);
}

/**
 * §4.4 filter — the slab can price a line of this scope on this day: active,
 * in force, company / branch / party NULL or the line's, level NULL or the
 * line's — and only when the line's level is a selling level 1–4.
 * (Unit and item are the caller's query; deleted rows never reach here.)
 */
export function slabAppliesTo(slab: QtySlab, scope: SlabScope): boolean {
  if (!(SELLING_SLAB_LEVELS as readonly number[]).includes(scope.priceLevel)) {
    return false;
  }
  if (!slab.isActive || !slabInForce(slab, scope.onDate)) {
    return false;
  }
  const same = (row: string | null, line: string | null | undefined) =>
    row === null || (line !== undefined && line !== null && row === line);
  return (
    same(slab.companyId, scope.companyId) &&
    same(slab.branchId, scope.branchId) &&
    same(slab.partyId, scope.partyId) &&
    (slab.priceLevel === null || slab.priceLevel === scope.priceLevel)
  );
}

/**
 * §4.4 rank (C9 / Q3): most specific first; then `from_qty` ascending; then the
 * tie-break for synced overlapping rows — `effective_from` descending,
 * `modified_on` descending — and the id, so the order is total.
 */
export function rankSlabs<T extends QtySlab>(slabs: readonly T[]): T[] {
  return [...slabs].sort(
    (a, b) =>
      slabSpecificity(b) - slabSpecificity(a) ||
      a.fromQty.comparedTo(b.fromQty) ||
      compareText(b.effectiveFrom, a.effectiveFrom) ||
      compareText(b.modifiedOn ?? '', a.modifiedOn ?? '') ||
      compareText(a.iqpId, b.iqpId),
  );
}

/** The slabs that can price this line, ranked: the lookup's `qty_slabs`. */
export function slabsFor<T extends QtySlab>(slabs: readonly T[], scope: SlabScope): T[] {
  return rankSlabs(slabs.filter((slab) => slabAppliesTo(slab, scope)));
}

/** `from_qty ≤ qty < to_qty` (to null = and above). */
export function slabHoldsQty(slab: Pick<QtySlab, 'fromQty' | 'toQty'>, qty: Dec): boolean {
  return slab.fromQty.lte(qty) && (slab.toQty === null || qty.lt(slab.toQty));
}

/**
 * §7.2 item 2 — the slab for the line's own qty in its own unit (Q4 / Q11):
 * the FIRST of the ranked list whose range holds it, else null.
 */
export function pickSlab<T extends QtySlab>(ranked: readonly T[], qty: Dec): T | null {
  return ranked.find((slab) => slabHoldsQty(slab, qty)) ?? null;
}

/** An amount moved between tax bases by the tax %: incl → excl divides, excl → incl multiplies. */
export function toTaxBasis(
  amount: Dec,
  fromInclTax: boolean,
  toInclTax: boolean,
  taxPerc: Dec,
): Dec {
  if (fromInclTax === toInclTax) {
    return amount;
  }
  const factor = HUNDRED.plus(taxPerc).div(HUNDRED);
  if (factor.lte(0)) {
    return amount;
  }
  return fromInclTax ? amount.div(factor) : amount.times(factor);
}

/** The price basis a slab amount is turned into: the card's / the line's. */
export interface PriceBasis {
  /** item_incl_tax on the card; the line's IsInclusiveTax on a bill. */
  inclTax: boolean;
  taxPerc: Dec;
}

/**
 * §7.2 item 4 — what one slab makes of a base price, each:
 *   P = base × (1 − pct ÷ 100); R = base − flat_off; F = price.
 * R / F amounts are moved to the basis's tax footing when the slab's
 * `is_tax_incl` differs. Rounded half-up to 0.01. Null when the mode's own
 * figure is missing (the slab save refuses that: ITEM_QTY_PRICE_VALUE_REQUIRED).
 */
export function slabUnitPrice(
  base: Dec,
  slab: Pick<QtySlab, 'priceMode' | 'discPct' | 'flatOff' | 'price' | 'isTaxIncl'>,
  basis: PriceBasis,
): Dec | null {
  const mode = (slab.priceMode || 'P').toUpperCase();
  let each: Dec;
  if (mode === 'F') {
    if (slab.price === null) {
      return null;
    }
    each = toTaxBasis(slab.price, slab.isTaxIncl, basis.inclTax, basis.taxPerc);
  } else if (mode === 'R') {
    if (slab.flatOff === null) {
      return null;
    }
    each = base.minus(toTaxBasis(slab.flatOff, slab.isTaxIncl, basis.inclTax, basis.taxPerc));
  } else {
    if (slab.discPct === null) {
      return null;
    }
    each = base.times(HUNDRED.minus(slab.discPct)).div(HUNDRED);
  }
  return each.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * C10 — the rate a slab gives a bill line: the slab price, but only when it is
 * BELOW the base (a slab never raises a line's rate). Null = the line keeps
 * its base price.
 */
export function slabLineRate(
  base: Dec,
  slab: Pick<QtySlab, 'priceMode' | 'discPct' | 'flatOff' | 'price' | 'isTaxIncl'>,
  basis: PriceBasis,
): Dec | null {
  const each = slabUnitPrice(base, slab, basis);
  return each !== null && each.lt(base) ? each : null;
}

/**
 * D9 — `sales.apply_qty_prices` out of what AppSettingValueService
 * .resolveEffective answered (the whole catalog, precedence applied). An absent
 * row or an unreadable value is the seeded default, On.
 */
export function isApplyQtyPricesOn(
  effective: ReadonlyArray<{ asdKey: string; value: string | null }>,
): boolean {
  const value = effective
    .find((entry) => entry.asdKey === APPLY_QTY_PRICES_SETTING_KEY)
    ?.value?.trim()
    .toLowerCase();
  return !['false', '0', 'no', 'off', 'n'].includes(value ?? '');
}

// ── the save's judgement (plan §4.2 step 3.5) ───────────────────────────────

/** One unit's card AFTER the save, as a slab of that unit is judged against it. */
export interface SlabCard {
  /** Levels 1–4 after the save; 0 = the level is not priced. */
  prices: readonly [Dec, Dec, Dec, Dec];
  /** A price row is in force for the unit (or the save creates one). */
  hasPriceRow: boolean;
  /** The cost after the save; 0 = not known. */
  cost: Dec;
  /** 0 = no MRP. */
  mrp: Dec;
  /** 0 = no minimum. */
  min: Dec;
  basis: PriceBasis;
}

export type SlabVerdict = 'ZERO_OR_LESS' | 'ABOVE_MRP' | 'BELOW_MIN' | 'BELOW_COST';

/** A slab at one level that breaks a rule. `level` null = a level-blank slab on a unit with no price. */
export interface SlabJudgement {
  level: number | null;
  /** The level's price the slab works on; null when there is none (F only). */
  base: Dec | null;
  each: Dec;
  verdict: SlabVerdict;
}

/**
 * §4.2 step 3.5 — every rule a slab breaks against the card after the save,
 * one verdict per level (the first that fails, in this order):
 *   Each ≤ 0 → ZERO_OR_LESS; Each > MRP (> 0) → ABOVE_MRP; Each < Min (> 0) →
 *   BELOW_MIN; Each < cost (> 0) → BELOW_COST (the caller applies the
 *   below-cost policy).
 * The levels: the slab's own, else every ACTIVE level priced above 0. A unit
 * with no price row — or a slab whose own level is not priced — has no base:
 * P / R are not judged (no bill can price them), F only against zero and the
 * cost. A slab missing its mode's figure is not judged here. A slab whose own
 * level is not an active selling level (an inactive 1–4, or 5 / 6 / 7 on an
 * old row) is not judged at all (review fix C-b): no bill applies it.
 */
export function judgeSlab(
  slab: QtySlab,
  card: SlabCard,
  activeLevels: Iterable<number>,
): SlabJudgement[] {
  const active = new Set(activeLevels);
  if (slab.priceLevel !== null && !isSellingSlabLevel(slab.priceLevel, active)) {
    return [];
  }
  const priced = (level: number) =>
    card.hasPriceRow && level >= 1 && level <= 4 && card.prices[level - 1].gt(0);
  const levels: Array<number | null> =
    slab.priceLevel !== null
      ? [slab.priceLevel]
      : card.hasPriceRow
        ? (SELLING_SLAB_LEVELS as readonly number[]).filter((l) => active.has(l) && priced(l))
        : [null];
  if (!levels.length) {
    // A level-blank slab on a unit whose active levels are all unpriced.
    levels.push(null);
  }
  const mode = (slab.priceMode || 'P').toUpperCase();
  const out: SlabJudgement[] = [];
  for (const level of levels) {
    const base = level !== null && priced(level) ? card.prices[level - 1] : null;
    if (base === null && mode !== 'F') {
      continue;
    }
    const each = slabUnitPrice(base ?? ZERO, slab, card.basis);
    if (each === null) {
      continue;
    }
    const verdict: SlabVerdict | null = each.lte(0)
      ? 'ZERO_OR_LESS'
      : base !== null && card.mrp.gt(0) && each.gt(card.mrp)
        ? 'ABOVE_MRP'
        : base !== null && card.min.gt(0) && each.lt(card.min)
          ? 'BELOW_MIN'
          : card.cost.gt(0) && each.lt(card.cost)
            ? 'BELOW_COST'
            : null;
    if (verdict) {
      out.push({ level, base, each, verdict });
    }
  }
  return out;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
