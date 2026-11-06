import { Prisma } from '@prisma/client';
import {
  HEADLINE_KEY,
  bucketKeyOfRow,
  isHeadlineKey,
  livePriceRows,
  resolveEffectivePrice,
  type BucketKey,
  type PriceCallerScope,
  type PriceRowScope,
} from '../items-price-master/price-resolver';
import {
  dayOf,
  judgeSlab,
  qtySlabOf,
  slabInForceOnOrAfter,
  type Dec,
  type QtySlab,
  type QtySlabRecord,
  type SlabCard,
  type SlabJudgement,
} from '../items-qty-price-master/qty-slab.rules';
import type { SaveItemQtyPriceDto } from '../items-qty-price-master/dto/save-item-qty-price.dto';
import { ItemQtyPriceErrorCode } from '../items-qty-price-master/types/item-qty-price-error-codes';
import { money } from '../../stocks/cost-price-bulk/cost-price-bulk.rules';
import type { BelowCostPolicy } from '../../stocks/selling-price-bulk/types/selling-price-bulk.types';
import type { QtyRatesProblem, QtyRatesSeverity } from './types/item-qty-rates.types';

/**
 * Qty-wise Prices + card rate, one form (menu 244, plan 2026-11-05 §4.2) — the
 * PURE part of the save: the card as it will stand after the save, the two new
 * card checks (3.3 headline above MRP, 3.4 By User prices kept), the set of
 * slabs judged (C7) and the problem list. No database: the service reads, these
 * decide. The slab arithmetic itself is `qty-slab.rules.ts` (shared with the
 * price lookup and the Qt port).
 */

const ZERO = new Prisma.Decimal(0);
export const BY_USER = 'By User';

/** A wire number as a Decimal, through its text. */
export function dec(value: number | string | Dec | null | undefined): Dec {
  if (value === null || value === undefined) {
    return ZERO;
  }
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value));
}

/** The price-row columns the card reads — a Prisma `ItemPriceMaster` satisfies it. */
export interface CardPriceRecord extends PriceRowScope {
  ipmId: string;
  ipmUcUnitId: string;
  ipmCostPrice: Dec | null;
  ipmCostWot: Dec | null;
  ipmMaxPrice: Dec | null;
  ipmMinPrice: Dec | null;
  ipmProfitType: string | null;
  ipmRoundOff: Dec | null;
  ipmSalesPriceA: Dec | null;
  ipmSalesPriceB: Dec | null;
  ipmSalesPriceC: Dec | null;
  ipmSalesPriceD: Dec | null;
  ipmEffectiveFrom: Date;
  ipmEffectiveTo: Date;
}

/** A stored price row's figures, as the checks compare against them. */
export interface StoredCardRow {
  ipmId: string;
  costPrice: Dec;
  costWot: Dec;
  maxPrice: Dec;
  minPrice: Dec;
  profitType: string;
  prices: [Dec, Dec, Dec, Dec];
}

export function storedCardRowOf(row: CardPriceRecord): StoredCardRow {
  return {
    ipmId: row.ipmId,
    costPrice: dec(row.ipmCostPrice),
    costWot: dec(row.ipmCostWot),
    maxPrice: dec(row.ipmMaxPrice),
    minPrice: dec(row.ipmMinPrice),
    profitType: row.ipmProfitType ?? BY_USER,
    prices: [
      dec(row.ipmSalesPriceA),
      dec(row.ipmSalesPriceB),
      dec(row.ipmSalesPriceC),
      dec(row.ipmSalesPriceD),
    ],
  };
}

/** Two bucket amounts are the same figure — exactly, as Decimals (no epsilon: house rule). */
const sameAmount = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : dec(a).eq(dec(b));

/** Two bucket keys are the same bucket. */
export function sameKey(a: BucketKey, b: BucketKey): boolean {
  return sameAmount(a.mrp, b.mrp) && sameAmount(a.salePrice, b.salePrice);
}

/**
 * Review fix C-c — a cost sent back is UNCHANGED when it and the stored cost
 * are the same figure at 2 decimals (half-up): the screen shows and sends the
 * cost as loaded, and a 6-decimal stored cost must not count as typed over.
 */
export function sameCost(sent: Dec, stored: Dec): boolean {
  const at2 = (value: Dec) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return at2(sent).eq(at2(stored));
}

/**
 * The row a unit's card stands on: its headline in force today here; for an
 * item priced only per bucket (no headline), the dearest-MRP bucket (then the
 * dearest sale price) — the provisional answer the price lookup gives a line
 * with no MRP. Null when nothing prices the unit.
 */
export function cardRowOf<R extends CardPriceRecord>(
  unitRows: readonly R[],
  today: string,
  caller: PriceCallerScope,
): { key: BucketKey; row: R } | null {
  const headline = resolveEffectivePrice(unitRows, HEADLINE_KEY, today, caller);
  if (headline) {
    return { key: { ...HEADLINE_KEY }, row: headline.row };
  }
  const keys = livePriceRows(unitRows, today, caller)
    .map((row) => bucketKeyOfRow(row))
    .filter((key) => !isHeadlineKey(key))
    .sort((a, b) => (b.mrp ?? -1) - (a.mrp ?? -1) || (b.salePrice ?? -1) - (a.salePrice ?? -1));
  if (!keys.length) {
    return null;
  }
  const answer = resolveEffectivePrice(unitRows, keys[0], today, caller);
  return answer ? { key: keys[0], row: answer.row } : null;
}

/**
 * §4.1 `scheduledFrom` — the first day after today on which a LATER row of the
 * unit takes over for this key here: a row starting that day that is, on that
 * day, the one the resolver answers. Null when none does.
 */
export function scheduledFromOf<R extends CardPriceRecord>(
  unitRows: readonly R[],
  key: BucketKey,
  today: string,
  caller: PriceCallerScope,
): string | null {
  const days = [
    ...new Set(
      unitRows
        .filter((row) => !row.ipmIsDeleted)
        .map((row) => dayOf(row.ipmEffectiveFrom))
        .filter((day) => day > today),
    ),
  ].sort();
  for (const day of days) {
    const answer = resolveEffectivePrice(unitRows, key, day, caller);
    if (answer && dayOf(answer.row.ipmEffectiveFrom) === day) {
      return day;
    }
  }
  return null;
}

/** One card row of the request, decoded: what was sent for one (unit, bucket). */
export interface SentCardRow {
  /** Position in rates.rows (the `field` path). */
  index: number;
  lineNo: number;
  uomId: string;
  unitName: string | null;
  /** The bucket key after the item's policy blanked it (the candidate's). */
  key: BucketKey;
  /** Levels sent; an absent level keeps its stored price. */
  levels: ReadonlyArray<{ level: number; price: Dec }>;
  /** Typed cost (Plain stock), else null. */
  costPrice: Dec | null;
  /** Typed MRP (Plain-stock headline), else null. */
  maxPrice: Dec | null;
  minPrice: Dec | null;
  profitType: string | null;
  /** The row the save writes over or copies from (the resolver's answer today), else null. */
  stored: StoredCardRow | null;
}

/** Levels 1–4 after the save: sent, else stored, else 0. */
export function pricesAfter(row: Pick<SentCardRow, 'levels' | 'stored'>): [Dec, Dec, Dec, Dec] {
  return [1, 2, 3, 4].map((level) => {
    const sent = row.levels.find((entry) => entry.level === level);
    return sent ? sent.price : (row.stored?.prices[level - 1] ?? ZERO);
  }) as [Dec, Dec, Dec, Dec];
}

export interface CardCheckContext {
  /** Active levels 1–4. */
  activeLevels: readonly number[];
  /** Level → name, for the messages. */
  levelNames: ReadonlyMap<number, string>;
}

function who(row: Pick<SentCardRow, 'lineNo' | 'unitName'>): string {
  return `Line ${row.lineNo}${row.unitName ? ` · ${row.unitName}` : ''}`;
}

function levelName(ctx: CardCheckContext, level: number): string {
  return ctx.levelNames.get(level) ?? `Level ${level}`;
}

/**
 * §4.2 steps 3.3 and 3.4 — the card checks /stock/price-bulk does not make:
 *   3.3 a HEADLINE row's prices (active levels in use) above its MRP after the
 *       save — the typed maxPrice, else the stored ipm_max_price; 0 = none —
 *       refuse ITEM_QTY_PRICE_ABOVE_MRP (price-bulk checks a bucket's MRP only, F5);
 *   3.4 a unit whose Rule after the save is By User, whose cost changed
 *       (typed ≠ stored ipm_cost_price) while every active level keeps its stored
 *       price — ask ITEM_QTY_PRICE_BY_USER_PRICES_KEPT.
 */
export function cardProblems(
  rows: readonly SentCardRow[],
  ctx: CardCheckContext,
): QtyRatesProblem[] {
  const out: QtyRatesProblem[] = [];
  for (const row of rows) {
    const prices = pricesAfter(row);
    if (isHeadlineKey(row.key)) {
      const mrp = row.maxPrice ?? row.stored?.maxPrice ?? ZERO;
      if (mrp.gt(0)) {
        for (const level of ctx.activeLevels) {
          const price = prices[level - 1];
          if (price.gt(0) && price.gt(mrp)) {
            out.push({
              source: 'CARD',
              code: ItemQtyPriceErrorCode.ABOVE_MRP,
              severity: 'REFUSE',
              lineNo: row.lineNo,
              slabIndex: null,
              iqpId: null,
              uomId: row.uomId,
              unitName: row.unitName,
              level,
              price: price.toNumber(),
              cost: null,
              field: `rates.rows.${row.index}.levels`,
              message: `${who(row)}: ${levelName(ctx, level)} ${money(price)} is above the MRP ${money(mrp)}.`,
            });
          }
        }
      }
    }
    const profitType = row.profitType ?? row.stored?.profitType ?? null;
    const stored = row.stored;
    if (
      profitType === BY_USER &&
      stored &&
      row.costPrice !== null &&
      !row.costPrice.eq(stored.costPrice) &&
      ctx.activeLevels.every((level) => prices[level - 1].eq(stored.prices[level - 1]))
    ) {
      out.push({
        source: 'CARD',
        code: ItemQtyPriceErrorCode.BY_USER_PRICES_KEPT,
        severity: 'ASK',
        lineNo: row.lineNo,
        slabIndex: null,
        iqpId: null,
        uomId: row.uomId,
        unitName: row.unitName,
        level: null,
        price: null,
        cost: row.costPrice.toNumber(),
        field: `rates.rows.${row.index}.levels`,
        message:
          `${who(row)}: the cost changed from ${money(stored.costPrice)} to ${money(row.costPrice)}, ` +
          'but this By User unit still has its old prices.',
      });
    }
  }
  return out;
}

/** What one unit's card is built from (the service reads, this decides). */
export interface UnitCardInput {
  /** The row the card stands on (cardRowOf), else null. */
  stored: StoredCardRow | null;
  /** Its key: the headline, or the dearest bucket. */
  key: BucketKey;
  /** The card row sent for this unit and key, else null. */
  sent: SentCardRow | null;
  plainStock: boolean;
  /** /stock/price-bulk's cost for this unit and key (stock first) — what Quick Rate shows. */
  costBasisRate: Dec;
  inclTax: boolean;
  taxPerc: Dec;
}

/**
 * §4.2 step 3.5 — a unit's card AFTER the save: the level prices (sent over
 * stored), the cost (the typed costPrice; else on Plain stock the row's own
 * stored cost; else price-bulk's cost basis), the MRP (a bucket's own; else the
 * typed maxPrice, else the stored) and the Min.
 */
export function unitCardAfter(input: UnitCardInput): SlabCard {
  const { stored, sent } = input;
  const prices = sent
    ? pricesAfter(sent)
    : ((stored?.prices ?? [ZERO, ZERO, ZERO, ZERO]) as [Dec, Dec, Dec, Dec]);
  const cost =
    sent?.costPrice ??
    (input.plainStock ? (stored ? stored.costPrice : input.costBasisRate) : input.costBasisRate);
  const mrp =
    input.key.mrp !== null ? dec(input.key.mrp) : (sent?.maxPrice ?? stored?.maxPrice ?? ZERO);
  return {
    prices,
    hasPriceRow: stored !== null || sent !== null,
    cost,
    mrp,
    min: sent?.minPrice ?? stored?.minPrice ?? ZERO,
    basis: { inclTax: input.inclTax, taxPerc: input.taxPerc },
  };
}

/** A slab as judged, with where it came from. */
export interface SlabAfterSave {
  slab: QtySlab;
  uomId: string;
  /** Index in the request's slabs[] when sent; null for a stored slab not sent. */
  slabIndex: number | null;
  /** The stored id, null for a new slab. */
  iqpId: string | null;
}

/** A stored slab with its unit, as the service read it. */
export interface StoredSlab {
  slab: QtySlab;
  uomId: string;
}

export function storedSlabOf(record: QtySlabRecord & { iqpItemUnitId: string }): StoredSlab {
  return { slab: qtySlabOf(record), uomId: record.iqpItemUnitId };
}

const optionalDec = (value: number | null | undefined, stored: Dec | null): Dec | null =>
  value === undefined ? stored : value === null ? null : dec(value);

/**
 * A sent slab as it will stand after the save: an update is the stored slab
 * with every sent field over it (an omitted field keeps the stored value, as
 * the slab writer does); a new slab takes the writer's defaults (from 0, mode
 * P, not tax inclusive, active).
 */
export function slabAfterSave(dto: SaveItemQtyPriceDto, stored: StoredSlab | null): StoredSlab {
  const base: QtySlab = stored?.slab ?? {
    iqpId: '',
    companyId: null,
    branchId: null,
    partyId: null,
    priceLevel: null,
    fromQty: ZERO,
    toQty: null,
    priceMode: 'P',
    discPct: null,
    flatOff: null,
    price: null,
    isTaxIncl: false,
    effectiveFrom: '',
    effectiveTo: null,
    isActive: true,
    modifiedOn: null,
  };
  const day = (value: string | null | undefined, keep: string | null) =>
    value === undefined ? keep : value === null ? null : value.slice(0, 10);
  return {
    uomId: dto.iqp_item_unit_id,
    slab: {
      ...base,
      iqpId: dto.iqp_id ?? base.iqpId,
      companyId: dto.iqp_company_id !== undefined ? dto.iqp_company_id : base.companyId,
      branchId: dto.iqp_branch_id !== undefined ? dto.iqp_branch_id : base.branchId,
      partyId: dto.iqp_party_id !== undefined ? dto.iqp_party_id : base.partyId,
      priceLevel: dto.iqp_price_level !== undefined ? dto.iqp_price_level : base.priceLevel,
      fromQty: dto.iqp_from_qty !== undefined ? dec(dto.iqp_from_qty) : base.fromQty,
      toQty: optionalDec(dto.iqp_to_qty, base.toQty),
      priceMode: (dto.iqp_price_mode ?? base.priceMode).toUpperCase(),
      discPct: optionalDec(dto.iqp_disc_pct, base.discPct),
      flatOff: optionalDec(dto.iqp_flat_off, base.flatOff),
      price: optionalDec(dto.iqp_price, base.price),
      isTaxIncl: dto.iqp_is_tax_incl ?? base.isTaxIncl,
      effectiveFrom: day(dto.iqp_effective_from, base.effectiveFrom) ?? base.effectiveFrom,
      effectiveTo: day(dto.iqp_effective_to, base.effectiveTo),
      isActive: dto.iqp_is_active ?? base.isActive,
    },
  };
}

/**
 * C7 — the slabs the save judges: every live slab of the item (stored, with
 * the sent changes over it) plus the new ones, minus the deleted ones — those
 * that can apply at this company and branch (company / branch blank or ours),
 * active, and in force today or later.
 */
export function slabsToJudge(args: {
  stored: readonly StoredSlab[];
  sent: readonly SaveItemQtyPriceDto[];
  deleteIds: readonly string[];
  companyId: string;
  branchId: string;
  today: string;
}): SlabAfterSave[] {
  // Ids compared lower-cased on both sides: a uuid another client sent in
  // capitals is the same row (as readStoredSlabs keys them).
  const low = (id: string) => id.toLowerCase();
  const deleted = new Set(args.deleteIds.map(low));
  const sentIds = new Set(
    args.sent.map((s) => s.iqp_id).filter((id): id is string => !!id).map(low),
  );
  const byId = new Map(args.stored.map((s) => [low(s.slab.iqpId), s]));
  const all: SlabAfterSave[] = [
    ...args.stored
      .filter((s) => !sentIds.has(low(s.slab.iqpId)))
      .map((s) => ({ ...s, slabIndex: null, iqpId: s.slab.iqpId })),
    ...args.sent.map((dto, index) => {
      const after = slabAfterSave(dto, dto.iqp_id ? (byId.get(low(dto.iqp_id)) ?? null) : null);
      return { ...after, slabIndex: index, iqpId: dto.iqp_id ?? null };
    }),
  ];
  return all.filter(
    ({ slab, iqpId }) =>
      !(iqpId && deleted.has(low(iqpId))) &&
      slab.isActive &&
      slabInForceOnOrAfter(slab, args.today) &&
      (slab.companyId === null || low(slab.companyId) === low(args.companyId)) &&
      (slab.branchId === null || low(slab.branchId) === low(args.branchId)),
  );
}

/** "100 and more", "10 up to 50". */
function rangeText(slab: QtySlab): string {
  const from = slab.fromQty.toFixed();
  return slab.toQty === null ? `${from} and more` : `${from} up to ${slab.toQty.toFixed()}`;
}

const SLAB_CODES: Readonly<Record<SlabJudgement['verdict'], ItemQtyPriceErrorCode>> = {
  ZERO_OR_LESS: ItemQtyPriceErrorCode.ZERO_OR_LESS,
  ABOVE_MRP: ItemQtyPriceErrorCode.ABOVE_MRP,
  BELOW_MIN: ItemQtyPriceErrorCode.BELOW_MIN,
  BELOW_COST: ItemQtyPriceErrorCode.BELOW_COST,
};

/**
 * Review fix C-e — the request path of a SENT slab's verdict: `slabs.<i>.` and
 * the figure its mode prices by (P iqp_disc_pct, R iqp_flat_off, F iqp_price),
 * the cell the user changes to fix it. A stored slab not sent has no index:
 * `iqp_id` (the problem's iqpId names it).
 */
export function slabProblemField(entry: Pick<SlabAfterSave, 'slab' | 'slabIndex'>): string {
  if (entry.slabIndex === null) {
    return 'iqp_id';
  }
  const mode = (entry.slab.priceMode || 'P').toUpperCase();
  const figure = mode === 'F' ? 'iqp_price' : mode === 'R' ? 'iqp_flat_off' : 'iqp_disc_pct';
  return `slabs.${entry.slabIndex}.${figure}`;
}

/** Below cost by `inventory.below_cost_price`: restrict refuses, warning asks, allow reports. */
export function belowCostSeverity(policy: BelowCostPolicy): QtyRatesSeverity {
  return policy === 'restrict' ? 'REFUSE' : policy === 'warning' ? 'ASK' : 'INFO';
}

/**
 * Step 3.5's verdicts as problems: zero or less, above MRP and below Min refuse;
 * below cost by the policy.
 */
export function slabProblems(
  judged: ReadonlyArray<{
    entry: SlabAfterSave;
    unitName: string | null;
    card: SlabCard;
    judgements: SlabJudgement[];
  }>,
  ctx: CardCheckContext & { policy: BelowCostPolicy },
): QtyRatesProblem[] {
  const out: QtyRatesProblem[] = [];
  for (const { entry, unitName, card, judgements } of judged) {
    const name =
      `${entry.slabIndex !== null ? `Slab ${entry.slabIndex + 1}` : 'Saved slab'} · ` +
      `${unitName ? `${unitName} ` : ''}${rangeText(entry.slab)}`;
    for (const j of judgements) {
      const at = j.level !== null ? ` at ${levelName(ctx, j.level)}` : '';
      const each = money(j.each);
      const text =
        j.verdict === 'ZERO_OR_LESS'
          ? `takes more off than the price${j.base ? ` ${money(j.base)}` : ''}: ${each} each.`
          : j.verdict === 'ABOVE_MRP'
            ? `${each} each is above the MRP ${money(card.mrp)}.`
            : j.verdict === 'BELOW_MIN'
              ? `${each} each is below the Min ${money(card.min)}.`
              : `${each} each is below the cost ${money(card.cost)}.`;
      out.push({
        source: 'SLAB',
        code: SLAB_CODES[j.verdict],
        severity: j.verdict === 'BELOW_COST' ? belowCostSeverity(ctx.policy) : 'REFUSE',
        lineNo: null,
        slabIndex: entry.slabIndex,
        iqpId: entry.iqpId,
        uomId: entry.uomId,
        unitName,
        level: j.level,
        price: j.each.toNumber(),
        cost: card.cost.gt(0) ? card.cost.toNumber() : null,
        field: slabProblemField(entry),
        message: `${name}${at}: ${text}`,
      });
    }
  }
  return out;
}

/** Judge every slab of the set against its unit's card (no card → no price row). */
export function judgeSlabs(
  entries: readonly SlabAfterSave[],
  cards: ReadonlyMap<string, { card: SlabCard; unitName: string | null }>,
  activeLevels: readonly number[],
  basis: SlabCard['basis'],
): Array<{
  entry: SlabAfterSave;
  unitName: string | null;
  card: SlabCard;
  judgements: SlabJudgement[];
}> {
  return entries.map((entry) => {
    const known = cards.get(entry.uomId);
    const card: SlabCard = known?.card ?? {
      prices: [ZERO, ZERO, ZERO, ZERO],
      hasPriceRow: false,
      cost: ZERO,
      mrp: ZERO,
      min: ZERO,
      basis,
    };
    return {
      entry,
      unitName: known?.unitName ?? null,
      card,
      judgements: judgeSlab(entry.slab, card, activeLevels),
    };
  });
}
