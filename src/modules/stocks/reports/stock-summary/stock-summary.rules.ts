import { Prisma } from '@prisma/client';
import { bucketLabel, dmy } from '../item-ledger/item-ledger.rules';
import type {
  BranchCell,
  BranchRow,
  Chip,
  GodownRow,
  GroupBy,
  GroupRow,
  PageInfo,
  RowTie,
  SummaryRow,
  SummaryTie,
  SummaryTiles,
  UnitShown,
  ValueTotals,
  ViewEcho,
} from './types/stock-summary.types';

/**
 * The pure half of the Stock Summary (plan 2026-11-13 §5): the run built from
 * the Show's result sets, and every view of it (filters, sort, page, the
 * Group summary and Godown-wise tabs) — no database, so the specs pin each
 * rule without a fixture, and /rows, /groups, /godowns and /export are proved
 * to run no SQL.
 */

type Dec = Prisma.Decimal;
type Num = Dec | string | number;

export const D0 = new Prisma.Decimal(0);

export function dec(v: Num | null | undefined): Dec {
  return new Prisma.Decimal(v ?? 0);
}

export const SUMMARY_BUCKETS = ['SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE'] as const;
export const SUMMARY_BUCKET_CHOICES = [...SUMMARY_BUCKETS, 'ALL'] as const;
export type SummaryBucket = (typeof SUMMARY_BUCKET_CHOICES)[number];

export const QTY_IN = ['BASE', 'DEFAULT'] as const;
export type QtyIn = (typeof QTY_IN)[number];

export const SORT_KEYS = [
  'name',
  'code',
  'group',
  'brand',
  'opening',
  'inward',
  'outward',
  'closing',
  'reserved',
  'available',
  'inTransit',
  'rate',
  'value',
  'lastSale',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SHOW_CHOICES = [
  'ALL',
  'NEGATIVE',
  'NON_SALEABLE',
  'IN_TRANSIT',
  'RESERVED',
  'NO_SALE',
  'NOT_TIED',
] as const;
export type ShowChoice = (typeof SHOW_CHOICES)[number];

export const GROUP_BY = ['GROUP', 'BRAND', 'SECTION', 'CATEGORY'] as const;

export const EXPORT_TABS = ['ITEMS', 'GROUPS', 'GODOWNS', 'BRANCHES'] as const;

/** A groupKey that names "no group / brand / section / category". */
export const NO_KEY = 'NONE';

export const DEFAULT_NO_SALE_DAYS = 60;
export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 5_000;
export const EXPORT_ROW_CAP = 20_000;
export const ITEM_CAP = 50_000;
/** EXP chip: RED at or within this many days, AMBER after (D29). */
export const EXPIRY_RED_DAYS = 3;

// ── number formats ─────────────────────────────────────────────────────────

/** A base quantity in the Qty-in unit, 3 dp. */
export function qty(base: Num, factor: Num): string {
  return dec(base).dividedBy(factor).toFixed(3);
}

export function money(v: Num): string {
  return dec(v).toFixed(2);
}

/** value ÷ closing in the Qty-in unit (2 dp); "0.00" at closing 0. */
export function rateText(value: Num, baseQty: Num, factor: Num): string {
  const q = dec(baseQty);
  if (q.isZero()) return '0.00';
  return dec(value).dividedBy(q).times(factor).toFixed(2);
}

/** Whole days from `a` to `b` (ISO dates, b − a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** An instant as IST text with +05:30. */
export function istInstant(ms: number): string {
  return `${new Date(ms + 330 * 60_000).toISOString().slice(0, 19)}+05:30`;
}

/** The first day of the month of an ISO date. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

// ── the Show's result sets ────────────────────────────────────────────────

/** One holding of the pass (§5.4), base units, values on the chosen basis. */
export interface PassRow {
  item: string;
  lot: string;
  godown: string;
  bucket: string;
  oq: Dec;
  pq: Dec;
  iq: Dec;
  xq: Dec;
  iv: Dec;
  xv: Dec;
  n: number;
  /** The engine's valuation of the opening holding (at from − 1). */
  ov_engine: Dec;
  /** The engine's valuation of the closing holding (at to). */
  cv_engine: Dec;
  vm: string;
}

/** The pass's three parts (H / O / C) → one PassRow per holding. A holding with no O / C row is worth 0. */
export function mergePass(
  parts: readonly {
    part: 'H' | 'O' | 'C';
    item: string;
    lot: string;
    godown: string;
    bucket: string;
    oq: Num | null;
    pq: Num | null;
    iq: Num | null;
    xq: Num | null;
    iv: Num | null;
    xv: Num | null;
    n: number | null;
    value: Num | null;
    vm: string | null;
  }[],
): PassRow[] {
  const key = (r: { item: string; lot: string; godown: string; bucket: string }) =>
    `${r.item}|${r.lot}|${r.godown}|${r.bucket}`;
  const open = new Map<string, Dec>();
  const close = new Map<string, { value: Dec; vm: string | null }>();
  for (const r of parts) {
    if (r.part === 'O') open.set(key(r), dec(r.value));
    else if (r.part === 'C') close.set(key(r), { value: dec(r.value), vm: r.vm });
  }
  const out: PassRow[] = [];
  for (const r of parts) {
    if (r.part !== 'H') continue;
    const k = key(r);
    const c = close.get(k);
    out.push({
      item: r.item,
      lot: r.lot,
      godown: r.godown,
      bucket: r.bucket,
      oq: dec(r.oq),
      pq: dec(r.pq),
      iq: dec(r.iq),
      xq: dec(r.xq),
      iv: dec(r.iv),
      xv: dec(r.xv),
      n: Number(r.n ?? 0),
      ov_engine: open.get(k) ?? D0,
      cv_engine: c?.value ?? D0,
      vm: c?.vm ?? 'WAVG',
    });
  }
  return out;
}

export interface FactRow {
  item_id: string;
  code: string | null;
  name: string | null;
  barcode: string | null;
  sku: string | null;
  group_id: string | null;
  group_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  section_id: string | null;
  section_name: string | null;
  category_id: string | null;
  category_name: string | null;
  company_id: string | null;
  warn_days: number | null;
  base_unit: string | null;
  default_iuc_id: string | null;
  default_factor: Dec | null;
  default_unit: string | null;
  default_is_base: boolean | null;
}

export interface BalanceRow {
  item: string;
  lot: string;
  godown: string;
  bucket: string;
  on_hand: Dec;
  reserved: Dec;
  available: Dec;
  transit_in: Dec;
  value: Dec;
  rate: Dec;
  expiry: string | null;
}

export interface AfterRow {
  item: string;
  godown: string;
  bucket: string;
  q: Dec;
  n: number;
}

export interface TransitDbRow {
  out_id: string;
  doc_no: string | null;
  from_branch: string;
  from_branch_name: string | null;
  to_branch: string;
  to_branch_name: string | null;
  to_godown: string | null;
  item: string;
  bucket: string | null;
  q: Dec;
  v: Dec;
}

/** The scope a run is built for. */
export interface BuildScope {
  companyId: string;
  godownId: string | null;
  /** null = ALL buckets. */
  bucket: string | null;
  qtyIn: QtyIn;
  to: string;
  today: string;
  todayOnly: boolean;
  noSaleDays: number;
}

/** A holding is in the report's scope (godown, bucket). */
export function holdingInScope(
  h: { godown: string; bucket: string },
  s: Pick<BuildScope, 'godownId' | 'bucket'>,
): boolean {
  return (!s.godownId || h.godown === s.godownId) && (!s.bucket || h.bucket === s.bucket);
}

/**
 * Non-saleable (D31 tile, row `nonSaleableValue`): the godown scope's stock in
 * a bucket other than Saleable that the bucket scope leaves out. With Bucket =
 * All there is none (every bucket is in the row already).
 */
export function isNonSaleable(
  h: { godown: string; bucket: string },
  s: Pick<BuildScope, 'godownId' | 'bucket'>,
): boolean {
  return (
    (!s.godownId || h.godown === s.godownId) &&
    h.bucket !== 'SALEABLE' &&
    !!s.bucket &&
    h.bucket !== s.bucket
  );
}

// ── the run's rows ────────────────────────────────────────────────────────

export interface GroupKeys {
  GROUP: string | null;
  BRAND: string | null;
  SECTION: string | null;
  CATEGORY: string | null;
}

/** One Item-wise row of a run: the wire row + what views sort and filter on. */
export interface ItemRunRow {
  readonly wire: SummaryRow;
  readonly itemId: string;
  readonly nameKey: string;
  readonly codeKey: string;
  readonly groupNameKey: string;
  readonly brandNameKey: string;
  readonly findText: string;
  readonly keys: GroupKeys;
  readonly names: Record<GroupBy, string | null>;
  readonly factor: Dec;
  readonly num: {
    opening: Dec;
    inward: Dec;
    outward: Dec;
    closing: Dec;
    reserved: Dec | null;
    available: Dec | null;
    inTransit: Dec | null;
    rate: Dec;
    value: Dec;
  };
  readonly vals: {
    openingValue: Dec;
    inwardValue: Dec;
    outwardValue: Dec;
    costAdj: Dec;
    value: Dec;
    nonSaleable: Dec;
  };
  readonly lastSale: string | null;
  readonly flags: {
    zero: boolean;
    negative: boolean;
    nonSaleable: boolean;
    inTransit: boolean;
    reserved: boolean;
    noSale: boolean;
    notTied: boolean;
  };
  /** Closing per godown over the bucket scope (the Godown-wise tab ignores the Godown filter). */
  readonly godowns: readonly { godownId: string; qty: Dec; value: Dec }[];
  readonly nonSaleableByBucket: readonly { bucket: string; value: Dec }[];
  /** Today-only (tiles): reserved value, in-transit value to this branch. */
  readonly reservedValue: Dec | null;
  readonly inTransitValue: Dec | null;
  readonly inTransitFrom: readonly string[];
}

interface ItemAcc {
  opening: Dec;
  closing: Dec;
  inward: Dec;
  outward: Dec;
  openingValue: Dec;
  value: Dec;
  inwardValue: Dec;
  outwardValue: Dec;
  nonSaleable: Dec;
  nonSaleableByBucket: Map<string, Dec>;
  godowns: Map<string, { qty: Dec; value: Dec }>;
  vm: string;
}

function newAcc(): ItemAcc {
  return {
    opening: D0,
    closing: D0,
    inward: D0,
    outward: D0,
    openingValue: D0,
    value: D0,
    inwardValue: D0,
    outwardValue: D0,
    nonSaleable: D0,
    nonSaleableByBucket: new Map(),
    godowns: new Map(),
    vm: 'WAVG',
  };
}

interface NowAcc {
  onHand: Dec;
  reserved: Dec;
  available: Dec;
  value: Dec;
  reservedValue: Dec;
  expiry: string | null;
}

/** Everything the Show read, ready to build rows from. */
export interface BuildInput {
  scope: BuildScope;
  pass: readonly PassRow[];
  facts: readonly FactRow[];
  lastSale: ReadonlyMap<string, string | null>;
  /** Today-only (empty otherwise). */
  balance: readonly BalanceRow[];
  after: readonly AfterRow[];
  transitIn: readonly TransitDbRow[];
}

/** The Qty-in unit of one item (D27): the base unit, or the item's default unit when asked and set. */
export function unitOf(f: FactRow | undefined, qtyIn: QtyIn): { unit: UnitShown; factor: Dec } {
  const factor = f?.default_factor ? dec(f.default_factor) : D0;
  if (qtyIn === 'DEFAULT' && f?.default_iuc_id && factor.greaterThan(0)) {
    return {
      unit: {
        name: f.default_unit ?? '',
        factor: factor.toFixed(6),
        isBase: f.default_is_base === true || factor.equals(1),
      },
      factor,
    };
  }
  return {
    unit: { name: f?.base_unit ?? '', factor: dec(1).toFixed(6), isBase: true },
    factor: dec(1),
  };
}

/**
 * The Item-wise rows of a run (§5.2 row rules, D1, D9, D17–D19, D26–D29, D33).
 * One row per item with a ledger row at the branch up to `to` (in the item
 * filter); sums in `Prisma.Decimal`; strings formatted once here.
 */
export function buildItemRows(input: BuildInput): ItemRunRow[] {
  const s = input.scope;
  const acc = new Map<string, ItemAcc>();
  for (const h of input.pass) {
    let a = acc.get(h.item);
    if (!a) {
      a = newAcc();
      acc.set(h.item, a);
    }
    a.vm = h.vm ?? a.vm;
    const cq = dec(h.oq).plus(h.pq);
    if (holdingInScope(h, s)) {
      a.opening = a.opening.plus(h.oq);
      a.closing = a.closing.plus(cq);
      a.inward = a.inward.plus(h.iq);
      a.outward = a.outward.plus(h.xq);
      a.openingValue = a.openingValue.plus(h.ov_engine);
      a.value = a.value.plus(h.cv_engine);
      a.inwardValue = a.inwardValue.plus(h.iv);
      a.outwardValue = a.outwardValue.plus(h.xv);
    }
    if (isNonSaleable(h, s) && (!cq.isZero() || !dec(h.cv_engine).isZero())) {
      a.nonSaleable = a.nonSaleable.plus(h.cv_engine);
      a.nonSaleableByBucket.set(
        h.bucket,
        (a.nonSaleableByBucket.get(h.bucket) ?? D0).plus(h.cv_engine),
      );
    }
    if (!s.bucket || h.bucket === s.bucket) {
      const g = a.godowns.get(h.godown) ?? { qty: D0, value: D0 };
      a.godowns.set(h.godown, { qty: g.qty.plus(cq), value: g.value.plus(h.cv_engine) });
    }
  }

  const now = new Map<string, NowAcc>();
  for (const b of input.balance) {
    let n = now.get(b.item);
    if (!n) {
      n = { onHand: D0, reserved: D0, available: D0, value: D0, reservedValue: D0, expiry: null };
      now.set(b.item, n);
    }
    if (holdingInScope(b, s)) {
      n.onHand = n.onHand.plus(b.on_hand);
      n.reserved = n.reserved.plus(b.reserved);
      n.available = n.available.plus(b.available);
      n.value = n.value.plus(b.value);
      n.reservedValue = n.reservedValue.plus(dec(b.reserved).times(b.rate).toDecimalPlaces(2));
    }
    // D29: the nearest expiry of a SALEABLE lot with stock, in the godown scope.
    if (
      b.bucket === 'SALEABLE' &&
      (!s.godownId || b.godown === s.godownId) &&
      dec(b.on_hand).greaterThan(0) &&
      b.expiry &&
      (n.expiry === null || b.expiry < n.expiry)
    ) {
      n.expiry = b.expiry;
    }
  }

  const after = new Map<string, { q: Dec; n: number }>();
  for (const r of input.after) {
    if (!holdingInScope(r, s)) continue;
    const x = after.get(r.item) ?? { q: D0, n: 0 };
    after.set(r.item, { q: x.q.plus(r.q), n: x.n + Number(r.n) });
  }

  const transit = new Map<string, { q: Dec; v: Dec; from: Set<string> }>();
  for (const t of input.transitIn) {
    if (s.godownId && t.to_godown && t.to_godown !== s.godownId) continue;
    if (s.godownId && !t.to_godown) continue;
    const x = transit.get(t.item) ?? { q: D0, v: D0, from: new Set<string>() };
    x.q = x.q.plus(t.q);
    x.v = x.v.plus(t.v);
    if (t.from_branch_name) x.from.add(t.from_branch_name);
    transit.set(t.item, x);
  }
  // "List the item" (user, 2026-11-14): goods on the road TO this branch, in scope,
  // make a row even when the branch has no ledger row for the item — opening,
  // inward, outward, closing and value 0, its in-transit set, reserved / available
  // from stock_balance. Today only (the transit is read only when to ≥ today).
  for (const item of transit.keys()) {
    if (!acc.has(item)) acc.set(item, newAcc());
  }

  const facts = new Map(input.facts.map((f) => [f.item_id, f]));
  const rows: ItemRunRow[] = [];
  for (const [itemId, a] of acc) {
    const f = facts.get(itemId);
    const { unit, factor } = unitOf(f, s.qtyIn);
    const n = s.todayOnly ? (now.get(itemId) ?? null) : null;
    const tr = s.todayOnly ? (transit.get(itemId) ?? null) : null;
    const af = after.get(itemId) ?? { q: D0, n: 0 };
    const reserved = s.todayOnly ? (n?.reserved ?? D0) : null;
    const available = s.todayOnly ? (n?.available ?? D0) : null;
    const inTransit = s.todayOnly ? (tr?.q ?? D0) : null;
    const costAdj = a.value.minus(a.openingValue.plus(a.inwardValue).minus(a.outwardValue));
    const lastSale = input.lastSale.get(itemId) ?? null;
    const otherCompany = !!f?.company_id && f.company_id !== s.companyId;

    let tie: RowTie | null = null;
    if (s.todayOnly) {
      const stockNowQty = n?.onHand ?? D0;
      const stockNowValue = n?.value ?? D0;
      const qtyEqual = a.closing.plus(af.q).equals(stockNowQty);
      const valueEqual = af.n === 0 ? a.value.equals(stockNowValue) : null;
      tie = {
        equal: qtyEqual && valueEqual !== false,
        qtyEqual,
        valueEqual,
        stockNowQty: qty(stockNowQty, factor),
        stockNowValue: money(stockNowValue),
      };
    }

    const chips: Chip[] = [];
    if (a.closing.lessThan(0)) chips.push({ kind: 'NEGATIVE' });
    const warn = Number(f?.warn_days ?? 0);
    if (s.todayOnly && n?.expiry && warn > 0) {
      const days = daysBetween(s.today, n.expiry);
      if (days <= warn) {
        chips.push({
          kind: 'EXPIRY',
          date: n.expiry,
          days,
          tone: days <= EXPIRY_RED_DAYS ? 'RED' : 'AMBER',
        });
      }
    }
    let noSale = false;
    if (a.closing.greaterThan(0)) {
      if (!lastSale) {
        chips.push({ kind: 'NEVER_SOLD' });
        noSale = true;
      } else {
        const days = daysBetween(lastSale, s.to);
        if (days >= s.noSaleDays) {
          chips.push({ kind: 'NO_SALE', days });
          noSale = true;
        }
      }
    }
    if (otherCompany) chips.push({ kind: 'OTHER_COMPANY' });
    if (tie && !tie.equal) chips.push({ kind: 'NOT_TIED' });

    const nonSaleableByBucket = [...a.nonSaleableByBucket.entries()]
      .map(([bucket, value]) => ({ bucket, value }))
      .sort((x, y) => x.bucket.localeCompare(y.bucket));

    const wire: SummaryRow = {
      itemId,
      code: f?.code ?? null,
      name: f?.name ?? '',
      barcode: f?.barcode ?? null,
      sku: f?.sku ?? null,
      groupId: f?.group_id ?? null,
      groupName: f?.group_name ?? null,
      brandId: f?.brand_id ?? null,
      brandName: f?.brand_name ?? null,
      sectionId: f?.section_id ?? null,
      sectionName: f?.section_name ?? null,
      categoryId: f?.category_id ?? null,
      categoryName: f?.category_name ?? null,
      unit,
      defaultUnitId: f?.default_iuc_id ?? null,
      valuation: a.vm,
      otherCompany,
      opening: qty(a.opening, factor),
      inward: qty(a.inward, factor),
      outward: qty(a.outward, factor),
      closing: qty(a.closing, factor),
      reserved: reserved === null ? null : qty(reserved, factor),
      available: available === null ? null : qty(available, factor),
      inTransit: inTransit === null ? null : qty(inTransit, factor),
      rate: rateText(a.value, a.closing, factor),
      value: money(a.value),
      openingValue: money(a.openingValue),
      inwardValue: money(a.inwardValue),
      outwardValue: money(a.outwardValue),
      costAdj: money(costAdj),
      nonSaleableValue: money(a.nonSaleable),
      lastSale,
      chips,
      tie,
    };
    Object.freeze(wire);
    const name = (f?.name ?? '').toLowerCase();
    rows.push(
      Object.freeze({
        wire,
        itemId,
        nameKey: name,
        codeKey: (f?.code ?? '').toLowerCase(),
        groupNameKey: (f?.group_name ?? '').toLowerCase(),
        brandNameKey: (f?.brand_name ?? '').toLowerCase(),
        findText: [f?.code, f?.name, f?.barcode, f?.sku]
          .filter(Boolean)
          .join('\u0001')
          .toLowerCase(),
        keys: {
          GROUP: f?.group_id ?? null,
          BRAND: f?.brand_id ?? null,
          SECTION: f?.section_id ?? null,
          CATEGORY: f?.category_id ?? null,
        },
        names: {
          GROUP: f?.group_name ?? null,
          BRAND: f?.brand_name ?? null,
          SECTION: f?.section_name ?? null,
          CATEGORY: f?.category_name ?? null,
        },
        factor,
        num: {
          opening: a.opening,
          inward: a.inward,
          outward: a.outward,
          closing: a.closing,
          reserved,
          available,
          inTransit,
          rate: a.closing.isZero() ? D0 : a.value.dividedBy(a.closing).times(factor),
          value: a.value,
        },
        vals: {
          openingValue: a.openingValue,
          inwardValue: a.inwardValue,
          outwardValue: a.outwardValue,
          costAdj,
          value: a.value,
          nonSaleable: a.nonSaleable,
        },
        lastSale,
        flags: {
          // D26: opening, inward, outward, closing, reserved and in transit all 0.
          zero:
            a.opening.isZero() &&
            a.inward.isZero() &&
            a.outward.isZero() &&
            a.closing.isZero() &&
            (reserved?.isZero() ?? true) &&
            (inTransit?.isZero() ?? true),
          negative: a.closing.lessThan(0),
          // As the tile counts it (review N6): any non-saleable stock, also at value 0.
          nonSaleable: nonSaleableByBucket.length > 0,
          inTransit: !!inTransit && !inTransit.isZero(),
          reserved: !!reserved && !reserved.isZero(),
          noSale,
          notTied: !!tie && !tie.equal,
        },
        godowns: [...a.godowns.entries()].map(([godownId, g]) => ({ godownId, ...g })),
        nonSaleableByBucket,
        reservedValue: s.todayOnly ? (n?.reservedValue ?? D0) : null,
        inTransitValue: s.todayOnly ? (tr?.v ?? D0) : null,
        inTransitFrom: tr ? [...tr.from] : [],
      }),
    );
  }
  return rows;
}

// ── tiles, totals, the tie ────────────────────────────────────────────────

export function sumValues(rows: readonly ItemRunRow[]): ValueTotals {
  let o = D0;
  let i = D0;
  let x = D0;
  let c = D0;
  let v = D0;
  for (const r of rows) {
    o = o.plus(r.vals.openingValue);
    i = i.plus(r.vals.inwardValue);
    x = x.plus(r.vals.outwardValue);
    c = c.plus(r.vals.costAdj);
    v = v.plus(r.vals.value);
  }
  return {
    openingValue: money(o),
    inwardValue: money(i),
    outwardValue: money(x),
    costAdj: money(c),
    closingValue: money(v),
  };
}

/** D31 — the six tiles, over the whole run (`hideZero` = the Show's). */
export function tilesOf(
  rows: readonly ItemRunRow[],
  todayOnly: boolean,
  hideZero: boolean,
): SummaryTiles {
  let closing = D0;
  let inStock = 0;
  let hiddenZero = 0;
  let negCount = 0;
  let negValue = D0;
  let first: ItemRunRow | null = null;
  let nsValue = D0;
  let nsItems = 0;
  const byBucket = new Map<string, { value: Dec; items: number }>();
  let trValue = D0;
  let trItems = 0;
  const from = new Set<string>();
  let rsValue = D0;
  let rsItems = 0;
  for (const r of rows) {
    closing = closing.plus(r.vals.value);
    if (r.num.closing.greaterThan(0)) inStock += 1;
    if (r.flags.zero) hiddenZero += 1;
    if (r.flags.negative) {
      negCount += 1;
      negValue = negValue.plus(r.vals.value);
      if (
        !first ||
        r.vals.value.lessThan(first.vals.value) ||
        (r.vals.value.equals(first.vals.value) && r.nameKey < first.nameKey)
      ) {
        first = r;
      }
    }
    if (r.nonSaleableByBucket.length > 0) {
      nsItems += 1;
      nsValue = nsValue.plus(r.vals.nonSaleable);
      for (const b of r.nonSaleableByBucket) {
        const x = byBucket.get(b.bucket) ?? { value: D0, items: 0 };
        byBucket.set(b.bucket, { value: x.value.plus(b.value), items: x.items + 1 });
      }
    }
    if (r.flags.inTransit) {
      trItems += 1;
      trValue = trValue.plus(r.inTransitValue ?? D0);
      r.inTransitFrom.forEach((b) => from.add(b));
    }
    if (r.flags.reserved) {
      rsItems += 1;
      rsValue = rsValue.plus(r.reservedValue ?? D0);
    }
  }
  return {
    closingValue: money(closing),
    items: {
      listed: hideZero ? rows.length - hiddenZero : rows.length,
      inStock,
      hiddenZero,
    },
    negative: {
      count: negCount,
      value: money(negValue),
      first: first
        ? {
            itemId: first.itemId,
            name: first.wire.name,
            closing: first.wire.closing,
            unit: first.wire.unit.name,
          }
        : null,
    },
    nonSaleable: {
      value: money(nsValue),
      items: nsItems,
      byBucket: [...byBucket.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([bucket, x]) => ({ bucket, value: money(x.value), items: x.items })),
    },
    inTransitIn: todayOnly
      ? { value: money(trValue), items: trItems, fromBranches: [...from].sort() }
      : null,
    reserved: todayOnly ? { value: money(rsValue), items: rsItems } : null,
  };
}

/** D19 — the head's tie line over every listed item. */
export function tieOfRun(rows: readonly ItemRunRow[], todayOnly: boolean): SummaryTie {
  if (!todayOnly) return { checked: false, items: 0, equal: 0, differ: 0, valueChecked: false };
  let equal = 0;
  let valueChecked = true;
  for (const r of rows) {
    if (r.wire.tie?.equal) equal += 1;
    if (r.wire.tie?.valueEqual === null) valueChecked = false;
  }
  return { checked: true, items: rows.length, equal, differ: rows.length - equal, valueChecked };
}

// ── views (no SQL) ────────────────────────────────────────────────────────

export interface ViewSpec {
  sort: SortKey;
  dir: 'asc' | 'desc';
  page: number;
  limit: number;
  hideZero: boolean;
  onlyNegative: boolean;
  show: ShowChoice;
  find: string;
  groupBy: GroupBy | null;
  groupKey: string | null;
}

export function viewOf(q: {
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
  hideZero?: boolean;
  onlyNegative?: boolean;
  show?: string;
  find?: string;
  groupBy?: string;
  groupKey?: string;
}): ViewSpec {
  return {
    sort: (q.sort ?? 'name') as SortKey,
    dir: q.dir === 'desc' ? 'desc' : 'asc',
    page: q.page ?? 1,
    limit: q.limit ?? DEFAULT_LIMIT,
    hideZero: q.hideZero ?? true,
    onlyNegative: q.onlyNegative ?? false,
    show: (q.show ?? 'ALL') as ShowChoice,
    find: (q.find ?? '').trim(),
    groupBy: (q.groupBy as GroupBy | undefined) ?? null,
    groupKey: q.groupBy && q.groupKey !== undefined ? q.groupKey : null,
  };
}

export function viewEcho(v: ViewSpec): ViewEcho {
  return {
    sort: v.sort,
    dir: v.dir,
    hideZero: v.hideZero,
    onlyNegative: v.onlyNegative,
    show: v.show,
    find: v.find,
    groupBy: v.groupBy,
    groupKey: v.groupKey,
  };
}

type SortValue = Dec | string | null;

function compareValues(a: SortValue, b: SortValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'string' || typeof b === 'string') {
    const x = String(a);
    const y = String(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return a.comparedTo(b);
}

/**
 * Stable sort: the chosen key (nulls last in either direction), then the
 * name, then the item id (§5.3).
 */
export function sortRows<T extends { nameKey: string; itemId: string }>(
  rows: readonly T[],
  key: (r: T) => SortValue,
  dir: 'asc' | 'desc',
): T[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null || kb === null) {
      const c = compareValues(ka, kb);
      if (c !== 0) return c;
    } else {
      const c = compareValues(ka, kb) * sign;
      if (c !== 0) return c;
    }
    if (a.nameKey !== b.nameKey) return a.nameKey < b.nameKey ? -1 : 1;
    return a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0;
  });
}

export function itemSortValue(r: ItemRunRow, key: SortKey): SortValue {
  switch (key) {
    case 'name':
      return r.nameKey;
    case 'code':
      return r.codeKey;
    case 'group':
      return r.groupNameKey;
    case 'brand':
      return r.brandNameKey;
    case 'lastSale':
      return r.lastSale;
    case 'opening':
    case 'inward':
    case 'outward':
    case 'closing':
    case 'reserved':
    case 'available':
    case 'inTransit':
    case 'rate':
    case 'value':
      return r.num[key];
    default:
      return r.nameKey;
  }
}

/** The filters of a view (D26, show, find, the group drill) — before sort and page. */
export function filterItemRows(
  rows: readonly ItemRunRow[],
  v: Pick<ViewSpec, 'hideZero' | 'onlyNegative' | 'show' | 'find' | 'groupBy' | 'groupKey'>,
): ItemRunRow[] {
  const find = v.find.toLowerCase();
  const drillKey = v.groupKey === NO_KEY ? null : v.groupKey;
  return rows.filter((r) => {
    // The NON-SALEABLE click lists what its tile counts (user 2026-11-14): Hide zero
    // keeps a row with non-saleable stock there, as it keeps a row in transit.
    const keptNonSaleable = v.show === 'NON_SALEABLE' && r.flags.nonSaleable;
    if (v.hideZero && r.flags.zero && !keptNonSaleable) return false;
    if (v.onlyNegative && !r.flags.negative) return false;
    switch (v.show) {
      case 'NEGATIVE':
        if (!r.flags.negative) return false;
        break;
      case 'NON_SALEABLE':
        if (!r.flags.nonSaleable) return false;
        break;
      case 'IN_TRANSIT':
        if (!r.flags.inTransit) return false;
        break;
      case 'RESERVED':
        if (!r.flags.reserved) return false;
        break;
      case 'NO_SALE':
        if (!r.flags.noSale) return false;
        break;
      case 'NOT_TIED':
        if (!r.flags.notTied) return false;
        break;
      default:
        break;
    }
    if (v.groupBy && v.groupKey !== null && r.keys[v.groupBy] !== drillKey) return false;
    if (find && !r.findText.includes(find)) return false;
    return true;
  });
}

export function itemView(rows: readonly ItemRunRow[], v: ViewSpec): ItemRunRow[] {
  return sortRows(filterItemRows(rows, v), (r) => itemSortValue(r, v.sort), v.dir);
}

export function pageOf<T>(
  rows: readonly T[],
  v: Pick<ViewSpec, 'page' | 'limit'>,
): {
  slice: T[];
  page: PageInfo;
} {
  const start = (v.page - 1) * v.limit;
  const slice = rows.slice(start, start + v.limit);
  return {
    slice,
    page: {
      page: v.page,
      limit: v.limit,
      totalRows: rows.length,
      hasMore: start + slice.length < rows.length,
    },
  };
}

// ── Group summary (SS-18) ─────────────────────────────────────────────────

const NO_NAME: Record<GroupBy, string> = {
  GROUP: '(No group)',
  BRAND: '(No brand)',
  SECTION: '(No section)',
  CATEGORY: '(No category)',
};

const BY_WORD: Record<GroupBy, string> = {
  GROUP: 'Group',
  BRAND: 'Brand',
  SECTION: 'Section',
  CATEGORY: 'Category',
};

/** The group drill as words for printedAs ("Brand: Daily Choice", "Group: (No group)"); null without one. */
export function drillText(
  rows: readonly ItemRunRow[],
  by: GroupBy | null,
  key: string | null,
): string | null {
  if (!by || key === null) return null;
  const k = key === NO_KEY ? null : key;
  const name = k === null ? NO_NAME[by] : (rows.find((r) => r.keys[by] === k)?.names[by] ?? k);
  return `${BY_WORD[by]}: ${name}`;
}

/** One line per group / brand / section / category of the rows; by closing value, then name. */
export function groupRows(
  rows: readonly ItemRunRow[],
  by: GroupBy,
): { rows: GroupRow[]; total: ValueTotals & { items: number } } {
  const groups = new Map<string, { key: string | null; name: string; rows: ItemRunRow[] }>();
  for (const r of rows) {
    const key = r.keys[by];
    const k = key ?? '';
    const g = groups.get(k) ?? { key, name: r.names[by] ?? NO_NAME[by], rows: [] };
    g.rows.push(r);
    groups.set(k, g);
  }
  const total = sumValues(rows);
  const totalValue = dec(total.closingValue);
  const out = [...groups.values()].map((g) => {
    const t = sumValues(g.rows);
    const closing = g.rows.reduce((s, r) => s.plus(r.vals.value), D0);
    return {
      line: {
        key: g.key,
        name: g.name,
        items: g.rows.length,
        ...t,
        share: totalValue.isZero() ? '0.00' : closing.dividedBy(totalValue).times(100).toFixed(2),
      },
      closing,
    };
  });
  out.sort((a, b) => {
    const c = b.closing.comparedTo(a.closing);
    if (c !== 0) return c;
    if (a.line.key === null) return 1;
    if (b.line.key === null) return -1;
    return a.line.name.toLowerCase() < b.line.name.toLowerCase() ? -1 : 1;
  });
  return { rows: out.map((o) => o.line), total: { items: rows.length, ...total } };
}

// ── Godown-wise (SS-19) ───────────────────────────────────────────────────

/** The godowns with any non-zero cell in the run, in the branch's order (gdl_sort, name). */
export function godownColumns(
  rows: readonly ItemRunRow[],
  branchGodowns: readonly { godownId: string; name: string }[],
): { godownId: string; name: string }[] {
  const used = new Set<string>();
  for (const r of rows) {
    for (const g of r.godowns) {
      if (!g.qty.isZero() || !g.value.isZero()) used.add(g.godownId);
    }
  }
  const known = branchGodowns.filter((g) => used.has(g.godownId));
  const extra = [...used]
    .filter((id) => !branchGodowns.some((g) => g.godownId === id))
    .sort()
    .map((godownId) => ({ godownId, name: godownId }));
  return [...known, ...extra];
}

export function godownRow(r: ItemRunRow, columns: readonly { godownId: string }[]): GodownRow {
  let q = D0;
  let v = D0;
  const cells = columns.map((c) => {
    const g = r.godowns.find((x) => x.godownId === c.godownId);
    q = q.plus(g?.qty ?? D0);
    v = v.plus(g?.value ?? D0);
    return { godownId: c.godownId, qty: qty(g?.qty ?? D0, r.factor), value: money(g?.value ?? D0) };
  });
  return {
    itemId: r.itemId,
    code: r.wire.code,
    name: r.wire.name,
    otherCompany: r.wire.otherCompany,
    defaultUnitId: r.wire.defaultUnitId,
    unit: r.wire.unit,
    cells,
    qty: qty(q, r.factor),
    value: money(v),
  };
}

export function godownTotals(
  rows: readonly ItemRunRow[],
  columns: readonly { godownId: string }[],
): { byGodown: { godownId: string; value: string }[]; value: string } {
  let all = D0;
  const byGodown = columns.map((c) => {
    let v = D0;
    for (const r of rows) {
      const g = r.godowns.find((x) => x.godownId === c.godownId);
      if (g) v = v.plus(g.value);
    }
    all = all.plus(v);
    return { godownId: c.godownId, value: money(v) };
  });
  return { byGodown, value: money(all) };
}

// ── Branch-wise (SS-20) ───────────────────────────────────────────────────

export interface BranchRunRow {
  readonly wire: BranchRow;
  readonly itemId: string;
  readonly nameKey: string;
  readonly codeKey: string;
  readonly groupNameKey: string;
  readonly brandNameKey: string;
  readonly findText: string;
  readonly chainQty: Dec;
  readonly chainValue: Dec;
  readonly transitQty: Dec;
  readonly transitValue: Dec;
  readonly cells: readonly { branchId: string; qty: Dec; value: Dec }[];
  readonly flags: { zero: boolean; negative: boolean; inTransit: boolean };
}

export interface BranchCellDb {
  branch: string;
  item: string;
  q: Dec;
  v: Dec;
}

/**
 * Branch-wise rows: one column per branch with anything in scope (each at its
 * own pool rate), + goods in transit (D21, added once into the Chain).
 */
export function buildBranchRows(input: {
  cells: readonly BranchCellDb[];
  transit: readonly TransitDbRow[];
  facts: readonly FactRow[];
  columns: readonly { branchId: string }[];
  qtyIn: QtyIn;
  companyId: string;
}): BranchRunRow[] {
  const byItem = new Map<string, { cells: Map<string, { q: Dec; v: Dec }>; tq: Dec; tv: Dec }>();
  const get = (item: string) => {
    let x = byItem.get(item);
    if (!x) {
      x = { cells: new Map(), tq: D0, tv: D0 };
      byItem.set(item, x);
    }
    return x;
  };
  for (const c of input.cells) {
    const x = get(c.item);
    const prev = x.cells.get(c.branch) ?? { q: D0, v: D0 };
    x.cells.set(c.branch, { q: prev.q.plus(c.q), v: prev.v.plus(c.v) });
  }
  for (const t of input.transit) {
    const x = get(t.item);
    x.tq = x.tq.plus(t.q);
    x.tv = x.tv.plus(t.v);
  }
  const facts = new Map(input.facts.map((f) => [f.item_id, f]));
  const rows: BranchRunRow[] = [];
  for (const [itemId, x] of byItem) {
    const f = facts.get(itemId);
    const { unit, factor } = unitOf(f, input.qtyIn);
    let cq = D0;
    let cv = D0;
    let anyNeg = false;
    const cells: { branchId: string; qty: Dec; value: Dec }[] = input.columns.map((col) => {
      const c = x.cells.get(col.branchId) ?? { q: D0, v: D0 };
      cq = cq.plus(c.q);
      cv = cv.plus(c.v);
      if (c.q.lessThan(0)) anyNeg = true;
      return { branchId: col.branchId, qty: c.q, value: c.v };
    });
    const chainQty = cq.plus(x.tq);
    const chainValue = cv.plus(x.tv);
    const wireCells: BranchCell[] = cells.map((c) => ({
      branchId: c.branchId,
      qty: qty(c.qty, factor),
      value: money(c.value),
    }));
    const wire: BranchRow = Object.freeze({
      itemId,
      code: f?.code ?? null,
      name: f?.name ?? '',
      groupName: f?.group_name ?? null,
      brandName: f?.brand_name ?? null,
      unit,
      otherCompany: !!f?.company_id && f.company_id !== input.companyId,
      defaultUnitId: f?.default_iuc_id ?? null,
      cells: wireCells,
      inTransit: { qty: qty(x.tq, factor), value: money(x.tv) },
      chain: { qty: qty(chainQty, factor), value: money(chainValue) },
    });
    rows.push(
      Object.freeze({
        wire,
        itemId,
        nameKey: (f?.name ?? '').toLowerCase(),
        codeKey: (f?.code ?? '').toLowerCase(),
        groupNameKey: (f?.group_name ?? '').toLowerCase(),
        brandNameKey: (f?.brand_name ?? '').toLowerCase(),
        findText: [f?.code, f?.name, f?.barcode, f?.sku]
          .filter(Boolean)
          .join('\u0001')
          .toLowerCase(),
        chainQty,
        chainValue,
        transitQty: x.tq,
        transitValue: x.tv,
        cells,
        flags: {
          zero: cells.every((c) => c.qty.isZero() && c.value.isZero()) && x.tq.isZero(),
          negative: anyNeg || chainQty.lessThan(0),
          inTransit: !x.tq.isZero(),
        },
      }),
    );
  }
  return rows;
}

/**
 * The view of a BRANCHES run: hideZero, onlyNegative (chain < 0), show
 * NEGATIVE / IN_TRANSIT (any other show is ALL), find; sort name / code /
 * group / brand, closing = chain qty, value = chain value, inTransit = the
 * transit qty (any other key sorts by name).
 */
export function branchView(rows: readonly BranchRunRow[], v: ViewSpec): BranchRunRow[] {
  const find = v.find.toLowerCase();
  const kept = rows.filter((r) => {
    if (v.hideZero && r.flags.zero) return false;
    if (v.onlyNegative && !r.chainQty.lessThan(0)) return false;
    if (v.show === 'NEGATIVE' && !r.flags.negative) return false;
    if (v.show === 'IN_TRANSIT' && !r.flags.inTransit) return false;
    if (find && !r.findText.includes(find)) return false;
    return true;
  });
  const key = (r: BranchRunRow): SortValue => {
    switch (v.sort) {
      case 'code':
        return r.codeKey;
      case 'group':
        return r.groupNameKey;
      case 'brand':
        return r.brandNameKey;
      case 'closing':
        return r.chainQty;
      case 'value':
        return r.chainValue;
      case 'inTransit':
        return r.transitQty;
      default:
        return r.nameKey;
    }
  };
  return sortRows(kept, key, v.dir);
}

export function branchTotals(
  rows: readonly BranchRunRow[],
  columns: readonly { branchId: string }[],
  transfers: number,
): {
  byBranch: { branchId: string; value: string }[];
  inTransit: { value: string; transfers: number };
  chain: { value: string };
} {
  let tv = D0;
  let chain = D0;
  const sums = new Map<string, Dec>();
  for (const r of rows) {
    tv = tv.plus(r.transitValue);
    chain = chain.plus(r.chainValue);
    for (const c of r.cells) sums.set(c.branchId, (sums.get(c.branchId) ?? D0).plus(c.value));
  }
  return {
    byBranch: columns.map((c) => ({
      branchId: c.branchId,
      value: money(sums.get(c.branchId) ?? D0),
    })),
    inTransit: { value: money(tv), transfers },
    chain: { value: money(chain) },
  };
}

// ── words ─────────────────────────────────────────────────────────────────

/** The applied filters as one sentence (the print heading, the CSV's first line). */
export function printedAsOf(p: {
  branchName: string | null;
  from: string;
  to: string;
  godownName: string | null;
  groupName: string | null;
  brandName: string | null;
  bucket: string;
  valueAt: string;
  qtyIn: string;
  hideZero: boolean;
  onlyNegative: boolean;
  show: string;
  find: string;
  tab?: string;
  /** The Group summary drill applied ("Brand: Daily Choice"), or null. */
  drill?: string | null;
}): string {
  return [
    p.branchName,
    `${dmy(p.from)} → ${dmy(p.to)}`,
    p.godownName ?? 'All godowns',
    p.groupName ? `Group: ${p.groupName}` : null,
    p.brandName ? `Brand: ${p.brandName}` : null,
    p.drill ?? null,
    p.bucket === 'ALL' ? 'All buckets' : bucketLabel(p.bucket),
    p.valueAt === 'WITH_TAX' ? 'cost with tax' : 'cost without tax',
    p.qtyIn === 'DEFAULT' ? 'qty in default unit' : null,
    p.hideZero ? 'hide zero' : null,
    p.onlyNegative ? 'only negative' : null,
    p.show && p.show !== 'ALL' ? `show ${p.show.toLowerCase().replace(/_/g, ' ')}` : null,
    p.find ? `find "${p.find}"` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The chips as words (print / CSV). */
export function chipsText(chips: readonly Chip[]): string {
  return chips
    .map((c) => {
      switch (c.kind) {
        case 'NEGATIVE':
          return 'NEGATIVE';
        case 'EXPIRY':
          return `EXP ${c.date ? `${c.date.slice(8, 10)}/${c.date.slice(5, 7)}` : ''}`.trim();
        case 'NO_SALE':
          return `NO SALE ${c.days ?? ''} D`.replace('  ', ' ');
        case 'NEVER_SOLD':
          return 'NEVER SOLD';
        case 'OTHER_COMPANY':
          return 'OTHER COMPANY';
        case 'NOT_TIED':
          return 'NOT TIED';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join(' · ');
}
