import { Prisma } from '@prisma/client';

/**
 * The purchase calculation — ONE pure function for the PO, GRN, bill and return
 * (plan-purchase-backend.md §4; addendum 2 B1, B2, B4, R8, R11).
 *
 * Decimal end to end: every figure is a `Prisma.Decimal`, money is rounded to 2
 * places HALF_UP at the points the bill prints it, never earlier. No `number`
 * arithmetic on money (the sale-order float leak is what this avoids).
 *
 * The Qt client mirrors this function; `purchase-calc.vectors.json` holds the
 * cases both sides must agree on to the paisa. The server's figures are the ones
 * saved — the client's are a preview.
 *
 * Rules, in the order they apply:
 *
 *   LINE      gross     = billed × rate
 *             discount  = disc % of gross | per-qty × billed | typed amount
 *             scheme    = sch % of (gross − discount) | per-qty × billed | typed
 *             net gross = gross − discount − scheme − extra discount
 *   CHARGES   amount by method (FIXED / PERCENT of Σ net gross / QTY, NET_QTY per
 *             billed qty / KG, QTL, TON per weight), ADD or DEDUCT, spread by the
 *             charge's allocation (VALUE default / QTY / WEIGHT), the rounding
 *             residue on the last line that takes a share.
 *             Before-tax on-bill charges join the taxable value (taxed at the
 *             line's own rate — sec 15(2)(c)). After-tax on-bill charges carry
 *             their own GST when tax-applicable. Off-bill charges (our own cost)
 *             never touch the supplier's figures — cost only.
 *   TAX       none for a composition / unregistered supplier (bill of supply) or
 *             an RCM line; else IGST across states, CGST + SGST halves within.
 *             Cess = cess % of taxable + cess per unit × billed.
 *   ITC       eligible on what arrived (received + damaged — owner, B1); pending
 *             on the short qty still owed; ineligible on blocked / ineligible
 *             lines and on a short the item's shortage % absorbs (lost goods).
 *   SHORT     short = billed − received − damaged (≥ 0). Within the item's
 *             shortage % of received it is ABSORBED (no shortage row; its value
 *             stays in the cost of what came — B4). Beyond, the whole short qty is
 *             PENDING: its value → shortage receivable, its GST → pending.
 *   COST      landed value (without recoverable GST) of what entered stock =
 *             taxable + landing charges (on- and off-bill, cash discount as a
 *             deduction — B2) + ineligible tax − the pending short's share;
 *             per base unit over (received + damaged + free) × factor. Free
 *             qty shares the cost (one lot, one cost — D2).
 *   BILL      net payable = Σ (taxable + GST + cess) + after-tax on-bill charges
 *             (+ their GST) + supplier TCS, rounded to the round-off step.
 */

const D = (v: Prisma.Decimal.Value | null | undefined): Prisma.Decimal => new Prisma.Decimal(v ?? 0);
const ZERO = D(0);
const HUNDRED = D(100);
const r2 = (v: Prisma.Decimal): Prisma.Decimal => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const r6 = (v: Prisma.Decimal): Prisma.Decimal => v.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
const max0 = (v: Prisma.Decimal): Prisma.Decimal => (v.isNegative() ? ZERO : v);

export type ItcClass = 'ELIGIBLE' | 'INELIGIBLE' | 'BLOCKED_17_5' | 'RCM' | 'COMPOSITION' | 'UNREGISTERED';
export type ChargeMethod = 'FIXED' | 'PERCENT' | 'QTY' | 'NET_QTY' | 'KG' | 'QTL' | 'TON';
export type ChargeAlloc = 'VALUE' | 'QTY' | 'WEIGHT' | 'NONE';

export interface CalcLineIn {
  key: string;
  billedQty: Prisma.Decimal.Value;
  /** Defaults to billed − damaged when omitted (direct bill, nothing short). */
  receivedQty?: Prisma.Decimal.Value | null;
  damagedQty?: Prisma.Decimal.Value | null;
  freeQty?: Prisma.Decimal.Value | null;
  toBaseFactor?: Prisma.Decimal.Value | null;
  rate: Prisma.Decimal.Value;
  discPct?: Prisma.Decimal.Value | null;
  discPerQty?: Prisma.Decimal.Value | null;
  discAmt?: Prisma.Decimal.Value | null;
  schPct?: Prisma.Decimal.Value | null;
  schPerQty?: Prisma.Decimal.Value | null;
  schAmt?: Prisma.Decimal.Value | null;
  extraDiscAmt?: Prisma.Decimal.Value | null;
  gstPct?: Prisma.Decimal.Value | null;
  cessPct?: Prisma.Decimal.Value | null;
  cessPerUnit?: Prisma.Decimal.Value | null;
  weight?: Prisma.Decimal.Value | null;
  /** Line / item ITC class; the supplier's type overrides (composition / unregistered). */
  itcClass?: ItcClass | null;
  /** item_shortage_pct — normal transit loss absorbed into cost. */
  shortagePct?: Prisma.Decimal.Value | null;
}

export interface CalcChargeIn {
  key: string;
  type: 'ADD' | 'DEDUCT';
  method: ChargeMethod;
  /** FIXED: the amount; PERCENT: the %; per-unit methods: the rate. */
  rate: Prisma.Decimal.Value;
  /** A typed amount wins over the method (rate ignored) — the operator priced it. */
  amount?: Prisma.Decimal.Value | null;
  alloc: ChargeAlloc;
  beforeTax: boolean;
  onBill: boolean;
  landingCost: boolean;
  /** Own GST of an after-tax, tax-applicable, on-bill charge. */
  taxPct?: Prisma.Decimal.Value | null;
  /** Off-bill payees (coolie per loadman): given amounts win, the rest is split equally. */
  payees?: { partyId: string; amount?: Prisma.Decimal.Value | null }[];
  /** Restrict the charge to these line keys (default: every line). */
  lineKeys?: string[] | null;
}

export interface CalcIn {
  interState: boolean;
  /** COMPOSITION | UNREGISTERED supplier → bill of supply, no tax on any line. */
  supplierTaxMode?: 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED' | null;
  lines: CalcLineIn[];
  charges?: CalcChargeIn[];
  tcsAmount?: Prisma.Decimal.Value | null;
  /** 1.00 rounds to the rupee; 0 = no rounding. */
  roundOffStep?: Prisma.Decimal.Value | null;
}

export interface CalcLineOut {
  key: string;
  gross: Prisma.Decimal;
  discAmt: Prisma.Decimal;
  schAmt: Prisma.Decimal;
  extraDiscAmt: Prisma.Decimal;
  netGross: Prisma.Decimal;
  chrgBeforeTax: Prisma.Decimal;
  chrgAfterTax: Prisma.Decimal;
  offbillShare: Prisma.Decimal;
  taxable: Prisma.Decimal;
  gstPct: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  cess: Prisma.Decimal;
  total: Prisma.Decimal;
  shortQty: Prisma.Decimal;
  absorbedShortQty: Prisma.Decimal;
  pendingShortQty: Prisma.Decimal;
  itcClass: ItcClass;
  itcEligible: Prisma.Decimal;
  itcPending: Prisma.Decimal;
  itcIneligible: Prisma.Decimal;
  shortValue: Prisma.Decimal;
  landedValue: Prisma.Decimal;
  landedCostWot: Prisma.Decimal;
}

export interface CalcChargeOut {
  key: string;
  amount: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  lineShares: Record<string, Prisma.Decimal>;
  payees: { partyId: string; amount: Prisma.Decimal }[];
}

export interface CalcOut {
  lines: CalcLineOut[];
  charges: CalcChargeOut[];
  gross: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxable: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  cess: Prisma.Decimal;
  chargesOnBill: Prisma.Decimal;
  chargeTax: Prisma.Decimal;
  tcs: Prisma.Decimal;
  roundOff: Prisma.Decimal;
  netPayable: Prisma.Decimal;
  offbillCharges: Prisma.Decimal;
  shortValue: Prisma.Decimal;
  itcEligible: Prisma.Decimal;
  itcPending: Prisma.Decimal;
  itcIneligible: Prisma.Decimal;
}

/** Splits `amount` over `weights` (≥ 0), 2 places, the residue on the last weighted entry. */
export function spread(amount: Prisma.Decimal, weights: Prisma.Decimal[]): Prisma.Decimal[] {
  const total = weights.reduce((a, w) => a.plus(w), ZERO);
  const out = weights.map(() => ZERO);
  if (total.isZero() || amount.isZero()) return out;
  let last = -1;
  let given = ZERO;
  weights.forEach((w, i) => {
    if (w.isZero()) return;
    out[i] = r2(amount.times(w).dividedBy(total));
    given = given.plus(out[i]);
    last = i;
  });
  if (last >= 0) out[last] = out[last].plus(amount.minus(given));
  return out;
}

/** GST of `taxable` at `pct`: IGST, or CGST + SGST halves each rounded on its own. */
function gst(taxable: Prisma.Decimal, pct: Prisma.Decimal, interState: boolean) {
  if (pct.isZero() || taxable.isZero()) return { cgst: ZERO, sgst: ZERO, igst: ZERO };
  if (interState) return { cgst: ZERO, sgst: ZERO, igst: r2(taxable.times(pct).dividedBy(HUNDRED)) };
  const half = r2(taxable.times(pct).dividedBy(2).dividedBy(HUNDRED));
  return { cgst: half, sgst: half, igst: ZERO };
}

export function calcPurchase(input: CalcIn): CalcOut {
  const noTaxSupplier = input.supplierTaxMode === 'COMPOSITION' || input.supplierTaxMode === 'UNREGISTERED';

  // ── 1 · lines to net gross ──────────────────────────────────────────────
  const base = input.lines.map((l) => {
    const billed = D(l.billedQty);
    const damaged = D(l.damagedQty);
    const received = l.receivedQty === null || l.receivedQty === undefined ? max0(billed.minus(damaged)) : D(l.receivedQty);
    const rate = D(l.rate);
    const gross = r2(billed.times(rate));
    const discAmt = !D(l.discPct).isZero()
      ? r2(gross.times(D(l.discPct)).dividedBy(HUNDRED))
      : !D(l.discPerQty).isZero()
        ? r2(billed.times(D(l.discPerQty)))
        : r2(D(l.discAmt));
    const afterDisc = gross.minus(discAmt);
    const schAmt = !D(l.schPct).isZero()
      ? r2(afterDisc.times(D(l.schPct)).dividedBy(HUNDRED))
      : !D(l.schPerQty).isZero()
        ? r2(billed.times(D(l.schPerQty)))
        : r2(D(l.schAmt));
    const extraDiscAmt = r2(D(l.extraDiscAmt));
    const netGross = afterDisc.minus(schAmt).minus(extraDiscAmt);
    const itcClass: ItcClass = noTaxSupplier
      ? (input.supplierTaxMode as ItcClass)
      : ((l.itcClass ?? 'ELIGIBLE') as ItcClass);
    return { l, billed, received, damaged, free: D(l.freeQty), factor: D(l.toBaseFactor ?? 1), weight: D(l.weight),
      gross, discAmt, schAmt, extraDiscAmt, netGross, itcClass };
  });

  // ── 2 · charges: amount, then spread ────────────────────────────────────
  const sumNetGross = base.reduce((a, b) => a.plus(b.netGross), ZERO);
  const chargesOut: CalcChargeOut[] = [];
  const share = new Map<string, { before: Prisma.Decimal; after: Prisma.Decimal; offbill: Prisma.Decimal; beforeNotLanding: Prisma.Decimal; afterNotLanding: Prisma.Decimal }>();
  base.forEach((b) => share.set(b.l.key, { before: ZERO, after: ZERO, offbill: ZERO, beforeNotLanding: ZERO, afterNotLanding: ZERO }));

  for (const c of input.charges ?? []) {
    const lines = base.filter((b) => !c.lineKeys || c.lineKeys.includes(b.l.key));
    const rate = D(c.rate);
    const qty = lines.reduce((a, b) => a.plus(b.billed), ZERO);
    const wt = lines.reduce((a, b) => a.plus(b.weight), ZERO);
    let amount: Prisma.Decimal;
    if (c.amount !== null && c.amount !== undefined && !D(c.amount).isZero()) amount = r2(D(c.amount).abs());
    else if (c.method === 'FIXED') amount = r2(rate.abs());
    else if (c.method === 'PERCENT') amount = r2(lines.reduce((a, b) => a.plus(b.netGross), ZERO).times(rate).dividedBy(HUNDRED));
    else if (c.method === 'QTY' || c.method === 'NET_QTY') amount = r2(qty.times(rate));
    else if (c.method === 'KG') amount = r2(wt.times(rate));
    else if (c.method === 'QTL') amount = r2(wt.times(rate).dividedBy(100));
    else amount = r2(wt.times(rate).dividedBy(1000));
    const signed = c.type === 'DEDUCT' ? amount.negated() : amount;

    const weights = lines.map((b) =>
      c.alloc === 'QTY' ? b.billed.times(b.factor) : c.alloc === 'WEIGHT' ? b.weight : b.netGross,
    );
    const parts = spread(signed, weights.some((w) => !w.isZero()) ? weights : lines.map((b) => b.netGross));
    const lineShares: Record<string, Prisma.Decimal> = {};
    lines.forEach((b, i) => {
      lineShares[b.l.key] = parts[i];
      const s = share.get(b.l.key)!;
      if (!c.onBill) s.offbill = s.offbill.plus(parts[i]);
      else if (c.beforeTax) {
        s.before = s.before.plus(parts[i]);
        if (!c.landingCost) s.beforeNotLanding = s.beforeNotLanding.plus(parts[i]);
      } else {
        s.after = s.after.plus(parts[i]);
        if (!c.landingCost) s.afterNotLanding = s.afterNotLanding.plus(parts[i]);
      }
    });

    // own GST: after-tax, on-bill, tax-applicable (never on a bill of supply)
    const own = c.onBill && !c.beforeTax && !noTaxSupplier && !D(c.taxPct).isZero()
      ? gst(signed, D(c.taxPct), input.interState)
      : { cgst: ZERO, sgst: ZERO, igst: ZERO };

    // payees of an off-bill charge: given amounts win, the rest split equally
    let payees: { partyId: string; amount: Prisma.Decimal }[] = [];
    if (!c.onBill && c.payees && c.payees.length) {
      const fixed = c.payees.filter((p) => p.amount !== null && p.amount !== undefined);
      const given = fixed.reduce((a, p) => a.plus(r2(D(p.amount))), ZERO);
      const open = c.payees.filter((p) => p.amount === null || p.amount === undefined);
      const rest = spread(amount.minus(given), open.map(() => D(1)));
      payees = c.payees.map((p) =>
        p.amount !== null && p.amount !== undefined
          ? { partyId: p.partyId, amount: r2(D(p.amount)) }
          : { partyId: p.partyId, amount: rest[open.indexOf(p)] },
      );
    }
    chargesOut.push({ key: c.key, amount: signed, ...own, lineShares, payees });
  }

  // ── 3 · tax, ITC, short, cost per line ──────────────────────────────────
  const linesOut: CalcLineOut[] = base.map((b) => {
    const s = share.get(b.l.key)!;
    const taxable = b.netGross.plus(s.before);
    const taxed = !(b.itcClass === 'COMPOSITION' || b.itcClass === 'UNREGISTERED' || b.itcClass === 'RCM');
    const gstPct = taxed ? D(b.l.gstPct) : ZERO;
    const t = gst(taxable, gstPct, input.interState);
    const cess = taxed
      ? r2(taxable.times(D(b.l.cessPct)).dividedBy(HUNDRED).plus(b.billed.times(D(b.l.cessPerUnit))))
      : ZERO;
    const tax = t.cgst.plus(t.sgst).plus(t.igst).plus(cess);
    const total = taxable.plus(tax);

    // short: absorbed within the item's shortage %, else wholly pending
    const short = max0(b.billed.minus(b.received).minus(b.damaged));
    const allowance = b.received.times(D(b.l.shortagePct)).dividedBy(HUNDRED);
    const absorbed = short.isZero() || short.greaterThan(allowance) ? ZERO : short;
    const pending = short.minus(absorbed);

    // ITC: arrived → eligible; pending short → pending; blocked / absorbed loss → ineligible
    let eligible = ZERO, pendingTax = ZERO, ineligible = ZERO;
    if (!b.billed.isZero() && !tax.isZero()) {
      const pendingPart = r2(tax.times(pending).dividedBy(b.billed));
      const lostPart = r2(tax.times(absorbed).dividedBy(b.billed));
      if (b.itcClass === 'INELIGIBLE' || b.itcClass === 'BLOCKED_17_5') {
        ineligible = tax.minus(pendingPart);
        pendingTax = pendingPart;
      } else {
        pendingTax = pendingPart;
        ineligible = lostPart;
        eligible = tax.minus(pendingPart).minus(lostPart);
      }
    }

    // cost of what entered stock (received + damaged + free), without recoverable GST
    const shortValue = b.billed.isZero() ? ZERO : r2(taxable.times(pending).dividedBy(b.billed));
    // a charge that is not landing cost goes to its own ledger, not into stock (an off-bill one is always landing — D13)
    const landedValue = r2(taxable.minus(s.beforeNotLanding).plus(s.after.minus(s.afterNotLanding)).plus(s.offbill).plus(ineligible).minus(shortValue));
    const inQtyBase = b.received.plus(b.damaged).plus(b.free).times(b.factor);
    const landedCostWot = inQtyBase.isZero() ? ZERO : r6(landedValue.dividedBy(inQtyBase));

    return {
      key: b.l.key, gross: b.gross, discAmt: b.discAmt, schAmt: b.schAmt, extraDiscAmt: b.extraDiscAmt, netGross: b.netGross,
      chrgBeforeTax: s.before, chrgAfterTax: s.after, offbillShare: s.offbill, taxable, gstPct, ...t, cess, total,
      shortQty: short, absorbedShortQty: absorbed, pendingShortQty: pending, itcClass: b.itcClass,
      itcEligible: eligible, itcPending: pendingTax, itcIneligible: ineligible, shortValue, landedValue, landedCostWot,
    };
  });

  // ── 4 · bill totals ─────────────────────────────────────────────────────
  const sum = (f: (l: CalcLineOut) => Prisma.Decimal) => linesOut.reduce((a, l) => a.plus(f(l)), ZERO);
  const onBillAfter = chargesOut
    .filter((c, i) => (input.charges ?? [])[i].onBill && !(input.charges ?? [])[i].beforeTax)
    .reduce((a, c) => a.plus(c.amount), ZERO);
  const chargeTax = chargesOut.reduce((a, c) => a.plus(c.cgst).plus(c.sgst).plus(c.igst), ZERO);
  const offbill = chargesOut.filter((c, i) => !(input.charges ?? [])[i].onBill).reduce((a, c) => a.plus(c.amount), ZERO);
  const tcs = r2(D(input.tcsAmount));
  const raw = sum((l) => l.total).plus(onBillAfter).plus(chargeTax).plus(tcs);
  const step = D(input.roundOffStep ?? 1);
  const rounded = step.isZero() ? raw : raw.dividedBy(step).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).times(step);
  const itcChargeTax = chargeTax; // own GST of on-bill charges: eligible (no blocked charges in phase 1)

  return {
    lines: linesOut,
    charges: chargesOut,
    gross: sum((l) => l.gross),
    discount: sum((l) => l.discAmt.plus(l.schAmt).plus(l.extraDiscAmt)),
    taxable: sum((l) => l.taxable),
    cgst: sum((l) => l.cgst),
    sgst: sum((l) => l.sgst),
    igst: sum((l) => l.igst),
    cess: sum((l) => l.cess),
    chargesOnBill: onBillAfter.plus(sum((l) => l.chrgBeforeTax)),
    chargeTax,
    tcs,
    roundOff: r2(rounded.minus(raw)),
    netPayable: r2(rounded),
    offbillCharges: offbill,
    shortValue: sum((l) => l.shortValue),
    itcEligible: sum((l) => l.itcEligible).plus(itcChargeTax),
    itcPending: sum((l) => l.itcPending),
    itcIneligible: sum((l) => l.itcIneligible),
  };
}

/** Selling price from a markup % on cost WITHOUT tax, rounded to the item's step (owner U10). */
export function priceFromMarkup(costWot: Prisma.Decimal.Value, markupPct: Prisma.Decimal.Value, step?: Prisma.Decimal.Value | null): Prisma.Decimal {
  const raw = D(costWot).times(HUNDRED.plus(D(markupPct))).dividedBy(HUNDRED);
  const st = D(step ?? 0);
  return st.isZero() ? r2(raw) : r2(raw.dividedBy(st).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).times(st));
}

/** Markup % = (sell − cost) ÷ cost; margin % = (sell − cost) ÷ sell. Both on figures without tax. */
export function markupOf(costWot: Prisma.Decimal.Value, sellWot: Prisma.Decimal.Value): Prisma.Decimal {
  const c = D(costWot);
  return c.isZero() ? ZERO : D(sellWot).minus(c).times(HUNDRED).dividedBy(c).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}
export function marginOf(costWot: Prisma.Decimal.Value, sellWot: Prisma.Decimal.Value): Prisma.Decimal {
  const s = D(sellWot);
  return s.isZero() ? ZERO : s.minus(D(costWot)).times(HUNDRED).dividedBy(s).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

/** Back-solve the rate from a typed cost WITH tax (3.0's tax-inclusive entry): rate = (cost − cess/unit) ÷ (1 + (gst + cess)%). */
export function rateFromInclusiveCost(costIncl: Prisma.Decimal.Value, gstPct: Prisma.Decimal.Value, cessPct?: Prisma.Decimal.Value | null, cessPerUnit?: Prisma.Decimal.Value | null): Prisma.Decimal {
  const div = HUNDRED.plus(D(gstPct)).plus(D(cessPct)).dividedBy(HUNDRED);
  return r6(D(costIncl).minus(D(cessPerUnit)).dividedBy(div));
}
