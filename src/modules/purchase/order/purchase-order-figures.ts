import { Prisma } from '@prisma/client';
import { calcPurchase, type CalcLineIn, type CalcOut } from '../common/purchase-calc';

/**
 * The PO's figures from ONE calcPurchase run over its lines AND its charges (user 2026-11-02: the PO applies its
 * charges "full, like Sale Entry"). Everything ordered is taken as received (received = ordered, free = free, nothing
 * damaged or short), so the landed figures are those of the whole order.
 *
 * Per line (money 2 places, landed costs 6 places like the calc's own landedCostWot and the poi_rate column):
 *   taxable        = net gross + before-tax on-bill charge shares       (the GST base — sec 15(2)(c))
 *   tax            = GST + cess on that taxable
 *   total          = taxable + tax                                       (poi_total_amt)
 *   amount         = taxable + tax + after-tax on-bill charge shares     (Sale Entry's line Total)
 *   landedValue    = taxable − before-tax non-landing shares + after-tax landing shares + off-bill shares
 *   landedCost     = landedValue ÷ (qty + free), per the line's OWN unit (the unit its Rate is in), without GST
 *   landedCostIncl = (landedValue + tax) ÷ (qty + free), same unit, with the line's GST
 *
 * Totals (nothing counted twice):
 *   net (= orderedValue, po_net_amt)  = Σ line total = taxable + tax       (holds the before-tax charges and their GST)
 *   chargesTotal                      = Σ every charge's signed amount     (ADD − DEDUCT, on- and off-bill, as keyed)
 *   chargesEstimate (po_charges_amt)  = chargesTotal − Σ before-tax shares on the lines + chargeTax
 *                                     = after-tax on-bill + their own GST + off-bill (+ a before-tax charge no line could take)
 *   poTotal                           = net + chargesEstimate
 *
 * Approval is NOT on these: it stays on the goods alone (poGoodsValue).
 */
const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);
const ZERO = D(0);
const r6 = (v: Prisma.Decimal) => v.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);

export interface PoLineFigures {
  key: string;
  gross: Prisma.Decimal; discAmt: Prisma.Decimal; netGross: Prisma.Decimal;
  chrgBeforeTax: Prisma.Decimal; chrgAfterTax: Prisma.Decimal; offbillShare: Prisma.Decimal;
  taxable: Prisma.Decimal; gstPct: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal; amount: Prisma.Decimal;
  landedValue: Prisma.Decimal; landedCost: Prisma.Decimal; landedCostIncl: Prisma.Decimal;
}
export interface PoTotals {
  gross: Prisma.Decimal; netGross: Prisma.Decimal; chrgBeforeTax: Prisma.Decimal; taxable: Prisma.Decimal; tax: Prisma.Decimal; net: Prisma.Decimal;
  chrgAfterTax: Prisma.Decimal; chargeTax: Prisma.Decimal; offbill: Prisma.Decimal; chargesTotal: Prisma.Decimal; chargesEstimate: Prisma.Decimal;
  amount: Prisma.Decimal; landedValue: Prisma.Decimal; poTotal: Prisma.Decimal;
}

/**
 * The GOODS value of PO lines — the same calc with NO charge: net gross + its GST. The approval basis only (user
 * 2026-10-29: the charges estimate never counts towards approval), never a figure that is shown as the PO's or stored.
 */
export function poGoodsValue(lines: CalcLineIn[], interState: boolean) {
  const g = calcPurchase({ interState, roundOffStep: 0, lines });
  return { taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, igst: g.igst, cess: g.cess, value: g.taxable.plus(g.cgst).plus(g.sgst).plus(g.igst).plus(g.cess) };
}

/** `lines[i]` is the keyed line calc.lines[i] came from (its qty and free qty, in the line's own unit). */
export function poFigures(calc: CalcOut, lines: { qty: Prisma.Decimal.Value; freeQty?: Prisma.Decimal.Value | null }[]): { lines: PoLineFigures[]; totals: PoTotals } {
  const out: PoLineFigures[] = calc.lines.map((o, i) => {
    const tax = o.cgst.plus(o.sgst).plus(o.igst).plus(o.cess);
    const inQty = D(lines[i]?.qty).plus(D(lines[i]?.freeQty));
    return {
      key: o.key, gross: o.gross, discAmt: o.discAmt, netGross: o.netGross,
      chrgBeforeTax: o.chrgBeforeTax, chrgAfterTax: o.chrgAfterTax, offbillShare: o.offbillShare,
      taxable: o.taxable, gstPct: o.gstPct, tax, total: o.total, amount: o.total.plus(o.chrgAfterTax),
      landedValue: o.landedValue,
      landedCost: inQty.isZero() ? ZERO : r6(o.landedValue.dividedBy(inQty)),
      landedCostIncl: inQty.isZero() ? ZERO : r6(o.landedValue.plus(tax).dividedBy(inQty)),
    };
  });
  const sum = (f: (l: PoLineFigures) => Prisma.Decimal) => out.reduce((a, l) => a.plus(f(l)), ZERO);
  const taxable = sum((l) => l.taxable), tax = sum((l) => l.tax), net = taxable.plus(tax);
  const chrgBeforeTax = sum((l) => l.chrgBeforeTax);
  const chargesTotal = calc.charges.reduce((a, c) => a.plus(c.amount), ZERO);
  const chargesEstimate = chargesTotal.minus(chrgBeforeTax).plus(calc.chargeTax);
  return {
    lines: out,
    totals: {
      gross: calc.gross, netGross: sum((l) => l.netGross), chrgBeforeTax, taxable, tax, net,
      chrgAfterTax: sum((l) => l.chrgAfterTax), chargeTax: calc.chargeTax, offbill: calc.offbillCharges, chargesTotal, chargesEstimate,
      amount: sum((l) => l.amount), landedValue: sum((l) => l.landedValue), poTotal: net.plus(chargesEstimate),
    },
  };
}
