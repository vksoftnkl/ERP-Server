import { Prisma } from '@prisma/client';

/**
 * Plan v5 D45 / D46 / D52 / D54 / D56 / D68–D71 — the money of a sale return,
 * worked out by the SERVER from the bill it returns. The client sends qty,
 * unit, condition, godown and notes; every figure below is ours.
 *
 * Pure: no database, no Nest. `SaleReturnBillReader` loads the facts, this
 * file turns them into the return's lines, charge rows and totals, and
 * `/validate`, `/create` and `/post` all run the same function — so the
 * preview the screen shows is the figure the post writes.
 *
 * Prisma.Decimal end to end, no epsilons. Every rounding is half-up at the
 * column's own scale (2 dp money, 4 dp net gross / charges inside the line /
 * points, 3 dp weight).
 *
 * ── The mirror (D45) ──────────────────────────────────────────────────────
 * A return line takes each money part of its bill line pro rata by BASE qty:
 * part × (base back now ÷ base billed), never more than the part still left
 * (bill − Σ earlier posted returns − earlier splits of this return). The
 * return that EMPTIES the line takes exactly what is left, so every return of
 * the line adds up to the bill line to the paisa. The return that empties the
 * whole bill takes the bill's remaining round off too.
 */

export type Dec = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value | null | undefined): Dec =>
  new Prisma.Decimal(v === null || v === undefined || v === '' ? 0 : v);
export const ZERO = D(0);
export const ONE = D(1);
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;
export const r2 = (v: Dec): Dec => v.toDecimalPlaces(2, HALF_UP);
export const r3 = (v: Dec): Dec => v.toDecimalPlaces(3, HALF_UP);
export const r4 = (v: Dec): Dec => v.toDecimalPlaces(4, HALF_UP);
export const r6 = (v: Dec): Dec => v.toDecimalPlaces(6, HALF_UP);

/**
 * D68 — the factor a quantity turns into base units by: the line's own
 * `to_base_factor` when > 0, else the unit conversion's, else 1 (175 bill
 * lines carry 0 today; `sales-stock.service.ts` reads it the same way).
 */
export function resolveFactor(
  lineFactor: Prisma.Decimal.Value | null | undefined,
  unitFactor: Prisma.Decimal.Value | null | undefined,
): Dec {
  const own = D(lineFactor);
  if (own.gt(0)) {
    return own;
  }
  const unit = D(unitFactor);
  return unit.gt(0) ? unit : ONE;
}

// ─── the parts a line is made of ────────────────────────────────────────────

/** Money parts at 2 dp, prorated by base qty. */
export const MONEY_PARTS = [
  'grossAmt',
  'itemDiscAmt',
  'splDiscAmt',
  'schDiscAmt',
  'billSchAmt',
  'addlDisc1Amt',
  'addlDisc2Amt',
  'cashDiscAmt',
  'taxableAmt',
  'cgstAmt',
  'sgstAmt',
  'igstAmt',
  'cessAmt',
  'acessAmt',
  'cogsAmt',
] as const;
/** 4 dp parts (numeric(17,4) / (18,4) on both tables). `chrgBeforeTax` is SIGNED. */
export const FINE_PARTS = ['netGross', 'chrgBeforeTax', 'loyaltyPv', 'loyaltyPoints'] as const;
/** 3 dp. */
export const QTY_PARTS = ['weightQty'] as const;
export type PartKey =
  | (typeof MONEY_PARTS)[number]
  | (typeof FINE_PARTS)[number]
  | (typeof QTY_PARTS)[number];
export const ALL_PARTS: readonly PartKey[] = [...MONEY_PARTS, ...FINE_PARTS, ...QTY_PARTS];
export type LineParts = Record<PartKey, Dec>;

const roundPart = (k: PartKey, v: Dec): Dec =>
  (MONEY_PARTS as readonly string[]).includes(k)
    ? r2(v)
    : (FINE_PARTS as readonly string[]).includes(k)
      ? r4(v)
      : r3(v);

export function zeroParts(): LineParts {
  return Object.fromEntries(ALL_PARTS.map((k) => [k, ZERO])) as LineParts;
}

export function addParts(a: LineParts, b: LineParts): LineParts {
  return Object.fromEntries(ALL_PARTS.map((k) => [k, a[k].plus(b[k])])) as LineParts;
}

/** Per-unit figures of a bill line, converted to the return's unit by the factor ratio. */
export const PER_UNIT_FIGURES = [
  'rate',
  'ratePreTax',
  'maxPrice',
  'minPrice',
  'actPrice',
  'itemDiscQty',
  'splDiscQty',
  'schDiscQty',
  'billSchQty',
  'cessPerUnit',
  'acessPerUnit',
] as const;
/** Percentages, copied as they stand. */
export const PERCENT_FIGURES = [
  'itemDiscPerc',
  'splDiscPerc',
  'schDiscPerc',
  'billSchPerc',
  'addlDisc1Perc',
  'addlDisc2Perc',
  'cashDiscPerc',
  'taxPerc',
  'cgstPerc',
  'sgstPerc',
  'igstPerc',
  'cessPerc',
  'acessPerc',
] as const;
export type PerUnitKey = (typeof PER_UNIT_FIGURES)[number];
export type PercentKey = (typeof PERCENT_FIGURES)[number];

/** The non-money facts a return line copies from its bill line. */
export interface BillLineCopy {
  hsnCode: string | null;
  taxId: string | null;
  isTaxIncl: boolean;
  isFree: boolean;
  freeType: string | null;
  isService: boolean;
  schemeId: string | null;
  schemeName: string | null;
  priceLevel: number | null;
  eanCode: string | null;
  lotId: string | null;
  batchNo: string | null;
  batchDate: string | null;
  expiryDate: string | null;
  serialNo: string | null;
  salesmanId: string | null;
  promoUsageId: string | null;
  qtyPriceId: string | null;
  size: string | null;
  sizeUom: string | null;
}

/** One bill line, as the mirror reads it. */
export interface BillLineFacts {
  billItemId: string;
  accYear: string;
  lineNo: number;
  itemId: string;
  itemUnitId: string;
  /** The bill's own qty in its own unit. */
  qty: Dec;
  /** Resolved (D68). */
  factor: Dec;
  parts: LineParts;
  perUnit: Record<PerUnitKey, Dec | null>;
  percent: Record<PercentKey, Dec>;
  copy: BillLineCopy;
}

/** What the posted returns (other than this one) already took from a bill line. */
export interface PriorBack {
  base: Dec;
  parts: LineParts;
}

export const baseOf = (l: Pick<BillLineFacts, 'qty' | 'factor'>): Dec => l.qty.times(l.factor);

/** D56 — where a line's rate came from. */
export type RateSourceKind = 'BILL' | 'LAST_SALE' | 'TODAY_PRICE';
export interface RateSource {
  kind: RateSourceKind;
  sbRefno: string | null;
  sbDate: string | null;
  billItemId: string | null;
  accYear: string | null;
}

/** A line of the return as the client asked for it. */
export interface ReturnLineAsk {
  /** Its index in the request, so the caller maps the answer back. */
  index: number;
  lineNo: number;
  splitNo: number;
  itemId: string;
  itemUnitId: string;
  /** The qty coming back, in `itemUnitId` (return qty + free qty). */
  qty: Dec;
  /** Resolved for `itemUnitId` (D52 / D68). */
  factor: Dec;
}

/** TODAY_PRICE facts (D56 step 3): the customer's price level today, without tax. */
export interface TodayPriceFacts {
  /** Per unit of the ask's unit, without tax. */
  rateWot: Dec;
  /** Per unit, with tax (what the price master shows). */
  rate: Dec;
  taxId: string | null;
  hsnCode: string | null;
  taxPerc: Dec;
  cessPerc: Dec;
  priceLevel: number | null;
}

/** One return line, worked out. */
export interface LineMoney {
  index: number;
  lineNo: number;
  splitNo: number;
  billItemId: string | null;
  billAccYear: string | null;
  billLineNo: number | null;
  itemId: string;
  itemUnitId: string;
  qty: Dec;
  factor: Dec;
  qtyBase: Dec;
  parts: LineParts;
  perUnit: Record<PerUnitKey, Dec | null>;
  percent: Record<PercentKey, Dec>;
  copy: BillLineCopy | null;
  /** Σ every discount amount on the line. */
  discAmt: Dec;
  /** CGST + SGST + IGST + cess + additional cess. */
  taxAmt: Dec;
  /** Taxable + tax: the goods value of the line. After-tax charges are carried rows, not in here. */
  netAmt: Dec;
  /** The bill line's COGS per base unit; null when the bill had none (D69) or there is no bill line. */
  costPerBase: Dec | null;
  /** Empties its bill line: took the remainder (D45). */
  takesRemainder: boolean;
  rateSource: RateSource;
  /** True when the qty asked is more than the line still has (SALES_RETURN_OVER_QTY). */
  overQty: boolean;
  /** Base qty the bill line had left before this line. */
  leftBaseBefore: Dec | null;
}

function clampTo(share: Dec, remaining: Dec): Dec {
  if (remaining.gte(0)) {
    return Prisma.Decimal.max(ZERO, Prisma.Decimal.min(share, remaining));
  }
  return Prisma.Decimal.min(ZERO, Prisma.Decimal.max(share, remaining));
}

/**
 * The parts one return line takes from its bill line. `already` is what the
 * posted returns AND this return's earlier splits took; `empties` hands it the
 * whole remainder.
 */
export function mirrorParts(
  bill: LineParts,
  already: LineParts,
  billBase: Dec,
  takeBase: Dec,
  empties: boolean,
): LineParts {
  const out = zeroParts();
  for (const k of ALL_PARTS) {
    const remaining = bill[k].minus(already[k]);
    if (empties) {
      out[k] = remaining;
      continue;
    }
    const share = billBase.gt(0) ? roundPart(k, bill[k].times(takeBase).dividedBy(billBase)) : ZERO;
    out[k] = clampTo(share, remaining);
  }
  return out;
}

/** The parts pro rata with no remainder and no cap — a no-bill line priced from a source line (D56 2). */
export function scaleParts(src: LineParts, srcBase: Dec, takeBase: Dec): LineParts {
  const out = zeroParts();
  if (srcBase.lte(0)) {
    return out;
  }
  for (const k of ALL_PARTS) {
    out[k] = roundPart(k, src[k].times(takeBase).dividedBy(srcBase));
  }
  return out;
}

/** A bill line's per-unit figures in another unit: × return factor ÷ bill factor, 4 dp. */
export function convertPerUnit(
  perUnit: Record<PerUnitKey, Dec | null>,
  billFactor: Dec,
  askFactor: Dec,
): Record<PerUnitKey, Dec | null> {
  const same = billFactor.equals(askFactor);
  return Object.fromEntries(
    PER_UNIT_FIGURES.map((k) => {
      const v = perUnit[k];
      if (v === null || same || billFactor.lte(0)) {
        return [k, v];
      }
      return [k, r4(v.times(askFactor).dividedBy(billFactor))];
    }),
  ) as Record<PerUnitKey, Dec | null>;
}

function lineTotals(parts: LineParts): { discAmt: Dec; taxAmt: Dec; netAmt: Dec } {
  const discAmt = parts.itemDiscAmt
    .plus(parts.splDiscAmt)
    .plus(parts.schDiscAmt)
    .plus(parts.billSchAmt)
    .plus(parts.addlDisc1Amt)
    .plus(parts.addlDisc2Amt)
    .plus(parts.cashDiscAmt);
  const taxAmt = parts.cgstAmt
    .plus(parts.sgstAmt)
    .plus(parts.igstAmt)
    .plus(parts.cessAmt)
    .plus(parts.acessAmt);
  return { discAmt, taxAmt, netAmt: parts.taxableAmt.plus(taxAmt) };
}

const NO_PER_UNIT = (): Record<PerUnitKey, Dec | null> =>
  Object.fromEntries(PER_UNIT_FIGURES.map((k) => [k, null])) as Record<PerUnitKey, Dec | null>;
const NO_PERCENT = (): Record<PercentKey, Dec> =>
  Object.fromEntries(PERCENT_FIGURES.map((k) => [k, ZERO])) as Record<PercentKey, Dec>;

// ─── billed lines ───────────────────────────────────────────────────────────

/**
 * Every billed line of a return, in line / split order. Splits of one bill
 * line (Ctrl+D) run one after the other: each takes its pro-rata share, and
 * the split that empties the line takes the rest.
 */
export function mirrorBilledLines(
  bill: { refno: string | null; date: string | null },
  billLines: readonly BillLineFacts[],
  prior: ReadonlyMap<string, PriorBack>,
  asks: readonly (ReturnLineAsk & { billItemId: string })[],
): LineMoney[] {
  const byId = new Map(billLines.map((l) => [l.billItemId, l]));
  const running = new Map<string, PriorBack>();
  const ordered = [...asks].sort((a, b) => a.lineNo - b.lineNo || a.splitNo - b.splitNo);
  const out: LineMoney[] = [];
  for (const ask of ordered) {
    const bl = byId.get(ask.billItemId);
    if (!bl) {
      continue;
    }
    const billBase = baseOf(bl);
    const before = prior.get(bl.billItemId) ?? { base: ZERO, parts: zeroParts() };
    const ours = running.get(bl.billItemId) ?? { base: ZERO, parts: zeroParts() };
    const already = addParts(before.parts, ours.parts);
    const leftBase = billBase.minus(before.base).minus(ours.base);
    const askBase = ask.qty.times(ask.factor);
    const overQty = askBase.gt(leftBase);
    const empties = !overQty && askBase.gt(0) && askBase.equals(leftBase);
    const parts =
      overQty || askBase.lte(0)
        ? zeroParts()
        : mirrorParts(bl.parts, already, billBase, askBase, empties);
    running.set(bl.billItemId, {
      base: ours.base.plus(overQty ? ZERO : askBase),
      parts: addParts(ours.parts, parts),
    });
    const totals = lineTotals(parts);
    out.push({
      index: ask.index,
      lineNo: ask.lineNo,
      splitNo: ask.splitNo,
      billItemId: bl.billItemId,
      billAccYear: bl.accYear,
      billLineNo: bl.lineNo,
      itemId: bl.itemId,
      itemUnitId: ask.itemUnitId,
      qty: ask.qty,
      factor: ask.factor,
      qtyBase: askBase,
      parts,
      perUnit: convertPerUnit(bl.perUnit, bl.factor, ask.factor),
      percent: { ...bl.percent },
      copy: { ...bl.copy },
      ...totals,
      costPerBase:
        bl.parts.cogsAmt.gt(0) && billBase.gt(0) ? bl.parts.cogsAmt.dividedBy(billBase) : null,
      takesRemainder: empties,
      rateSource: {
        kind: 'BILL',
        sbRefno: bill.refno,
        sbDate: bill.date,
        billItemId: bl.billItemId,
        accYear: bl.accYear,
      },
      overQty,
      leftBaseBefore: leftBase,
    });
  }
  return out;
}

/** True when, after these lines, nothing is left on any line of the bill. */
export function emptiesBill(
  billLines: readonly BillLineFacts[],
  prior: ReadonlyMap<string, PriorBack>,
  lines: readonly LineMoney[],
): boolean {
  if (billLines.length === 0 || lines.some((l) => l.overQty)) {
    return false;
  }
  const now = new Map<string, Dec>();
  for (const l of lines) {
    if (l.billItemId) {
      now.set(l.billItemId, (now.get(l.billItemId) ?? ZERO).plus(l.qtyBase));
    }
  }
  return billLines.every((bl) =>
    baseOf(bl)
      .minus(prior.get(bl.billItemId)?.base ?? ZERO)
      .minus(now.get(bl.billItemId) ?? ZERO)
      .lte(0),
  );
}

// ─── no-bill lines (D56) ────────────────────────────────────────────────────

/**
 * Review 11-14 S5 — GST split by the RETURN's own supply nature, as
 * todayPriceLine splits it: IGST at the full rate inter-state, CGST + SGST at
 * half each intra-state, worked out on the line's taxable value. A line
 * already split that way is left exactly as it is (its scaled amounts); cess
 * does not depend on the nature and is never touched.
 */
export function resplitGst(
  parts: LineParts,
  percent: Record<PercentKey, Dec>,
  nature: 'INTRA' | 'INTER',
): void {
  const inter = nature === 'INTER';
  const misplaced = inter
    ? parts.cgstAmt.plus(parts.sgstAmt).gt(0) || percent.cgstPerc.plus(percent.sgstPerc).gt(0)
    : parts.igstAmt.gt(0) || percent.igstPerc.gt(0);
  if (!misplaced) {
    return;
  }
  const rate = percent.taxPerc.gt(0)
    ? percent.taxPerc
    : percent.cgstPerc.plus(percent.sgstPerc).plus(percent.igstPerc);
  if (inter) {
    percent.igstPerc = rate;
    percent.cgstPerc = ZERO;
    percent.sgstPerc = ZERO;
    parts.igstAmt = r2(parts.taxableAmt.times(rate).dividedBy(100));
    parts.cgstAmt = ZERO;
    parts.sgstAmt = ZERO;
  } else {
    const half = rate.dividedBy(2);
    percent.cgstPerc = half;
    percent.sgstPerc = half;
    percent.igstPerc = ZERO;
    parts.cgstAmt = r2(parts.taxableAmt.times(half).dividedBy(100));
    parts.sgstAmt = r2(parts.taxableAmt.times(half).dividedBy(100));
    parts.igstAmt = ZERO;
  }
}

/**
 * D56 step 2 — priced from the customer's last sale of the item (a source bill
 * line). Its tax is split by THIS return's supply nature (S5): the source bill
 * may have gone to the customer intra-state under another place of supply.
 */
export function lastSaleLine(
  source: BillLineFacts,
  sourceBill: { refno: string | null; date: string | null },
  ask: ReturnLineAsk,
  nature?: 'INTRA' | 'INTER',
): LineMoney {
  const askBase = ask.qty.times(ask.factor);
  const parts = scaleParts(source.parts, baseOf(source), askBase);
  // No bill to reverse: no COGS taken back (today's average prices the stock,
  // D54), no loyalty to claw back.
  parts.cogsAmt = ZERO;
  parts.loyaltyPv = ZERO;
  parts.loyaltyPoints = ZERO;
  const percent = { ...source.percent };
  if (nature) {
    resplitGst(parts, percent, nature);
  }
  const totals = lineTotals(parts);
  return {
    index: ask.index,
    lineNo: ask.lineNo,
    splitNo: ask.splitNo,
    billItemId: null,
    billAccYear: null,
    billLineNo: null,
    itemId: ask.itemId,
    itemUnitId: ask.itemUnitId,
    qty: ask.qty,
    factor: ask.factor,
    qtyBase: askBase,
    parts,
    perUnit: convertPerUnit(source.perUnit, source.factor, ask.factor),
    percent,
    copy: {
      ...source.copy,
      // The goods come back into whatever lot the operator picks (F12), not
      // the source bill's.
      lotId: null,
      batchNo: null,
      batchDate: null,
      expiryDate: null,
      serialNo: null,
      promoUsageId: null,
      qtyPriceId: null,
      schemeId: null,
      schemeName: null,
      isFree: false,
      freeType: null,
    },
    ...totals,
    costPerBase: null,
    takesRemainder: false,
    rateSource: {
      kind: 'LAST_SALE',
      sbRefno: sourceBill.refno,
      sbDate: sourceBill.date,
      billItemId: source.billItemId,
      accYear: source.accYear,
    },
    overQty: false,
    leftBaseBefore: null,
  };
}

/**
 * D56 step 3 — never sold to them: today's price at their price level, the
 * item's own GST, split by the supply nature.
 */
export function todayPriceLine(
  price: TodayPriceFacts,
  ask: ReturnLineAsk,
  nature: 'INTRA' | 'INTER',
): LineMoney {
  const askBase = ask.qty.times(ask.factor);
  const parts = zeroParts();
  parts.grossAmt = r2(ask.qty.times(price.rateWot));
  parts.netGross = r4(parts.grossAmt);
  parts.taxableAmt = parts.grossAmt;
  const percent = NO_PERCENT();
  percent.taxPerc = price.taxPerc;
  percent.cessPerc = price.cessPerc;
  if (nature === 'INTER') {
    percent.igstPerc = price.taxPerc;
    parts.igstAmt = r2(parts.taxableAmt.times(price.taxPerc).dividedBy(100));
  } else {
    const half = price.taxPerc.dividedBy(2);
    percent.cgstPerc = half;
    percent.sgstPerc = half;
    parts.cgstAmt = r2(parts.taxableAmt.times(half).dividedBy(100));
    parts.sgstAmt = r2(parts.taxableAmt.times(half).dividedBy(100));
  }
  parts.cessAmt = r2(parts.taxableAmt.times(price.cessPerc).dividedBy(100));
  const perUnit = NO_PER_UNIT();
  perUnit.rate = r4(price.rate);
  perUnit.ratePreTax = r4(price.rateWot);
  return {
    index: ask.index,
    lineNo: ask.lineNo,
    splitNo: ask.splitNo,
    billItemId: null,
    billAccYear: null,
    billLineNo: null,
    itemId: ask.itemId,
    itemUnitId: ask.itemUnitId,
    qty: ask.qty,
    factor: ask.factor,
    qtyBase: askBase,
    parts,
    perUnit,
    percent,
    copy: {
      hsnCode: price.hsnCode,
      taxId: price.taxId,
      isTaxIncl: false,
      isFree: false,
      freeType: null,
      isService: false,
      schemeId: null,
      schemeName: null,
      priceLevel: price.priceLevel,
      eanCode: null,
      lotId: null,
      batchNo: null,
      batchDate: null,
      expiryDate: null,
      serialNo: null,
      salesmanId: null,
      promoUsageId: null,
      qtyPriceId: null,
      size: null,
      sizeUom: null,
    },
    ...lineTotals(parts),
    costPerBase: null,
    takesRemainder: false,
    rateSource: {
      kind: 'TODAY_PRICE',
      sbRefno: null,
      sbDate: null,
      billItemId: null,
      accYear: null,
    },
    overQty: false,
    leftBaseBefore: null,
  };
}

// ─── charges (D46 / D70 / D71) ──────────────────────────────────────────────

export interface ChargeFigures {
  amount: Dec;
  cgst: Dec;
  sgst: Dec;
  igst: Dec;
  cess: Dec;
}
const GST_KEYS = ['cgst', 'sgst', 'igst', 'cess'] as const;
export const zeroFigures = (): ChargeFigures => ({
  amount: ZERO,
  cgst: ZERO,
  sgst: ZERO,
  igst: ZERO,
  cess: ZERO,
});

/** One bill charge row. Figures are MAGNITUDES (the client stores a DEDUCT row positive). */
export interface BillChargeFacts {
  cdId: string;
  accYear: string;
  chgId: string;
  name: string | null;
  type: 'ADD' | 'DEDUCT';
  beforeTax: boolean;
  sepPost: boolean;
  taxApl: boolean;
  method: string | null;
  role: string | null;
  applyOn: string | null;
  ledgerId: string;
  ledgerName: string | null;
  taxCode: string | null;
  hsn: string | null;
  unit: string | null;
  taxPerc: Dec;
  cgstPerc: Dec;
  sgstPerc: Dec;
  igstPerc: Dec;
  cessPerc: Dec;
  onBill: ChargeFigures;
  /** Σ what posted returns (other than this one) gave back, magnitudes. */
  backBefore: ChargeFigures;
}

/** What the client asked for one bill charge (`charges[]` of /create, keyed by cdSrcCdId). */
export interface ChargeAsk {
  giveBack?: boolean | null;
  /** Typed Back now, a magnitude; read only under a manual calc type (D20). */
  amount?: Dec | null;
}

export type ChargeKind = 'IN_LINES' | 'CARRIED';
export type ChargeBasis = 'QTY' | 'WEIGHT' | 'VALUE';

export interface ChargeBack {
  bill: BillChargeFacts;
  kind: ChargeKind;
  sign: 1 | -1;
  basis: ChargeBasis;
  giveBack: boolean;
  manual: boolean;
  /** What is left to give back (magnitude): on the bill − back before. */
  cap: Dec;
  /** Pro rata by the charge's basis, capped (magnitude). */
  proposed: Dec;
  /** What this return gives back (magnitude). 0 when an addition is unticked. */
  back: ChargeFigures;
  takesRemainder: boolean;
  /** A typed figure over the cap (SALES_CHARGE_OVER_CARRY). */
  overCap: boolean;
  /** Back now was typed (a manual charge, D20) rather than worked out. */
  typed: boolean;
}

/** D71 — the basis a carried charge's give-back is worked out on. */
export function basisOf(method: string | null | undefined): ChargeBasis {
  const m = (method ?? '').toUpperCase();
  if (m === 'QTY' || m === 'NET_QTY') {
    return 'QTY';
  }
  if (m === 'KG' || m === 'QTL' || m === 'TON') {
    return 'WEIGHT';
  }
  return 'VALUE';
}

export interface BasisTotals {
  qtyBase: Dec;
  weight: Dec;
  /** Goods value: NetGross. */
  value: Dec;
}

export function basisTotals(
  lines: readonly {
    qtyBase: Dec;
    parts: Pick<LineParts, 'weightQty' | 'netGross' | 'taxableAmt'>;
  }[],
): BasisTotals {
  let qtyBase = ZERO;
  let weight = ZERO;
  let value = ZERO;
  for (const l of lines) {
    qtyBase = qtyBase.plus(l.qtyBase);
    weight = weight.plus(l.parts.weightQty);
    value = value.plus(l.parts.netGross.gt(0) ? l.parts.netGross : l.parts.taxableAmt);
  }
  return { qtyBase, weight, value };
}

function pickBasis(basis: ChargeBasis, t: BasisTotals): Dec {
  return basis === 'QTY' ? t.qtyBase : basis === 'WEIGHT' ? t.weight : t.value;
}

/**
 * Every bill charge row, given back by this return (D46 / D70 / D71):
 *  - before tax → IN_LINES: already inside the lines (`sbi_chrg_before_tax`);
 *    shown, never added to the note again. Its share is still worked out, so
 *    a separately posted one (New Reg) can come back off its own ledger;
 *  - after tax → CARRIED, pro rata on its own basis, capped at what is left;
 *    the return that empties the bill takes the rest;
 *  - a deduction always comes back (D70); the tick governs additions only.
 */
export function mirrorCharges(input: {
  charges: readonly BillChargeFacts[];
  asks: ReadonlyMap<string, ChargeAsk>;
  billBasis: BasisTotals;
  returnBasis: BasisTotals;
  emptiesBill: boolean;
  manual: { freight: boolean; loading: boolean };
  /** An addition the client says nothing about: the reason's srm_refund_charges, else true. */
  defaultGiveBack: boolean;
}): ChargeBack[] {
  return input.charges.map((c) => {
    const kind: ChargeKind = c.beforeTax ? 'IN_LINES' : 'CARRIED';
    const sign: 1 | -1 = c.type === 'DEDUCT' ? -1 : 1;
    let basis = basisOf(c.method);
    // A basis the bill has none of (no weights keyed) falls back to value, then qty.
    if (pickBasis(basis, input.billBasis).lte(0)) {
      basis = input.billBasis.value.gt(0) ? 'VALUE' : 'QTY';
    }
    const cap = Prisma.Decimal.max(ZERO, c.onBill.amount.minus(c.backBefore.amount));
    const billBasis = pickBasis(basis, input.billBasis);
    const retBasis = pickBasis(basis, input.returnBasis);
    const proposed = input.emptiesBill
      ? cap
      : billBasis.gt(0)
        ? Prisma.Decimal.min(cap, r2(c.onBill.amount.times(retBasis).dividedBy(billBasis)))
        : ZERO;
    const ask = input.asks.get(c.cdId);
    const role = (c.role ?? '').toUpperCase();
    const manual =
      kind === 'CARRIED' &&
      sign > 0 &&
      ((role === 'FREIGHT' && input.manual.freight) ||
        ((role === 'LOADING' || role === 'UNLOADING') && input.manual.loading));
    const giveBack =
      kind === 'IN_LINES' || sign < 0 ? true : (ask?.giveBack ?? input.defaultGiveBack);
    const typed = manual && ask?.amount !== undefined && ask?.amount !== null ? ask.amount : null;
    const overCap = typed !== null && typed.gt(cap);
    const amount = !giveBack ? ZERO : typed !== null ? (overCap ? cap : r2(typed)) : proposed;
    const back = zeroFigures();
    back.amount = amount;
    const full = amount.equals(cap) && cap.gt(0);
    for (const k of GST_KEYS) {
      const left = Prisma.Decimal.max(ZERO, c.onBill[k].minus(c.backBefore[k]));
      back[k] = full
        ? left
        : c.onBill.amount.gt(0)
          ? Prisma.Decimal.min(left, r2(c.onBill[k].times(amount).dividedBy(c.onBill.amount)))
          : ZERO;
    }
    return {
      bill: c,
      kind,
      sign,
      basis,
      giveBack,
      manual,
      cap,
      proposed,
      back,
      takesRemainder: input.emptiesBill && full,
      overCap,
      typed: typed !== null && giveBack,
    };
  });
}

export const signed = (c: ChargeBack, v: Dec): Dec => (c.sign < 0 ? v.negated() : v);

// ─── totals ─────────────────────────────────────────────────────────────────

export interface ReturnTotals {
  /** Σ line gross. */
  gross: Dec;
  itemDisc: Dec;
  splDisc: Dec;
  schDisc: Dec;
  billSchDisc: Dec;
  /** Every line discount + the header cash discount. */
  discAmt: Dec;
  /** The header cash discount share (sb_cash_disc; 0 on every Qt bill). */
  cashDisc: Dec;
  /** Σ line taxable + carried charges with their own GST (the bill's sb_taxable_amt convention). */
  taxable: Dec;
  cgst: Dec;
  sgst: Dec;
  igst: Dec;
  cess: Dec;
  /** Line additional cess. */
  acess: Dec;
  tax: Dec;
  /** Σ line net: the goods value, taxable + GST. */
  goods: Dec;
  /** Σ carried rows, signed, with their own GST. */
  chargesNet: Dec;
  /** Carried rows without their own GST, signed (sr_other_amt). */
  otherAmt: Dec;
  freight: Dec;
  load: Dec;
  unload: Dec;
  roundOff: Dec;
  /** The credit note. */
  creditNote: Dec;
  qty: Dec;
  weight: Dec;
  cogs: Dec;
  /** Took the bill's remaining round off (D45). */
  takesBillRoundOff: boolean;
}

/** Round to the step (half-up); a step of 0 turns rounding off. */
export function roundOffFor(subtotal: Dec, step: Dec): Dec {
  if (step.lte(0)) {
    return ZERO;
  }
  const rounded = subtotal.dividedBy(step).toDecimalPlaces(0, HALF_UP).times(step);
  return r2(rounded.minus(subtotal));
}

export function totalsOf(input: {
  lines: readonly LineMoney[];
  charges: readonly ChargeBack[];
  /** The header cash discount share, already worked out. */
  cashDisc: Dec;
  roundOffStep: Dec;
  /** When the return empties the bill and gives every charge back: bill RO − Σ earlier returns' RO. */
  billRoundOffLeft: Dec | null;
}): ReturnTotals {
  const sum = (f: (l: LineMoney) => Dec) => input.lines.reduce((t, l) => t.plus(f(l)), ZERO);
  const carried = input.charges.filter((c) => c.kind === 'CARRIED');
  const csum = (f: (c: ChargeBack) => Dec) => carried.reduce((t, c) => t.plus(f(c)), ZERO);
  const lineTaxable = sum((l) => l.parts.taxableAmt);
  const taxable = lineTaxable.plus(csum((c) => (c.bill.taxApl ? signed(c, c.back.amount) : ZERO)));
  const cgst = sum((l) => l.parts.cgstAmt).plus(csum((c) => signed(c, c.back.cgst)));
  const sgst = sum((l) => l.parts.sgstAmt).plus(csum((c) => signed(c, c.back.sgst)));
  const igst = sum((l) => l.parts.igstAmt).plus(csum((c) => signed(c, c.back.igst)));
  const cess = sum((l) => l.parts.cessAmt).plus(csum((c) => signed(c, c.back.cess)));
  const acess = sum((l) => l.parts.acessAmt);
  const goods = sum((l) => l.netAmt);
  const chargesNet = csum((c) =>
    signed(
      c,
      c.back.amount.plus(c.back.cgst).plus(c.back.sgst).plus(c.back.igst).plus(c.back.cess),
    ),
  );
  const byRole = (role: string) =>
    csum((c) => ((c.bill.role ?? '').toUpperCase() === role ? signed(c, c.back.amount) : ZERO));
  const subtotal = goods.plus(chargesNet).minus(input.cashDisc);
  // A return worth nothing (a scheme's free line, D6) rounds nothing: it
  // comes back at 0.00 even when it is the one that empties the bill — the
  // bill's leftover round off would make it a note of a few paise, or a
  // negative one (review 11-14 B1).
  const takesBillRoundOff = input.billRoundOffLeft !== null && !subtotal.isZero();
  const roundOff = takesBillRoundOff
    ? input.billRoundOffLeft!
    : roundOffFor(subtotal, input.roundOffStep);
  const itemDisc = sum((l) => l.parts.itemDiscAmt);
  const splDisc = sum((l) => l.parts.splDiscAmt);
  const schDisc = sum((l) => l.parts.schDiscAmt);
  const billSchDisc = sum((l) => l.parts.billSchAmt);
  return {
    gross: sum((l) => l.parts.grossAmt),
    itemDisc,
    splDisc,
    schDisc,
    billSchDisc,
    discAmt: sum((l) => l.discAmt).plus(input.cashDisc),
    cashDisc: input.cashDisc,
    taxable,
    cgst,
    sgst,
    igst,
    cess,
    acess,
    tax: cgst.plus(sgst).plus(igst).plus(cess).plus(acess),
    goods,
    chargesNet,
    otherAmt: csum((c) => (c.bill.taxApl ? ZERO : signed(c, c.back.amount))),
    freight: byRole('FREIGHT'),
    load: byRole('LOADING'),
    unload: byRole('UNLOADING'),
    roundOff,
    creditNote: subtotal.plus(roundOff),
    qty: sum((l) => l.qty),
    weight: sum((l) => l.parts.weightQty),
    cogs: sum((l) => l.parts.cogsAmt),
    takesBillRoundOff,
  };
}

/** True when every carried row gives back all that is left (the bill can then close to the paisa). */
export function everyChargeBack(charges: readonly ChargeBack[]): boolean {
  return charges.filter((c) => c.kind === 'CARRIED').every((c) => c.back.amount.equals(c.cap));
}

/**
 * The header cash discount's share (the bill's sb_cash_disc, after tax):
 * pro rata by line taxable, the emptying return taking the rest.
 */
export function cashDiscShare(input: {
  billCashDisc: Dec;
  priorCashDisc: Dec;
  billLineTaxable: Dec;
  returnLineTaxable: Dec;
  emptiesBill: boolean;
}): Dec {
  const left = Prisma.Decimal.max(ZERO, input.billCashDisc.minus(input.priorCashDisc));
  if (input.emptiesBill) {
    return left;
  }
  if (input.billLineTaxable.lte(0)) {
    return ZERO;
  }
  return Prisma.Decimal.min(
    left,
    r2(input.billCashDisc.times(input.returnLineTaxable).dividedBy(input.billLineTaxable)),
  );
}

/** Decimal → JSON number, the house answer shape. */
export const n = (v: Dec | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v.toString());
