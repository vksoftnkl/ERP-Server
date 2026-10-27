import { calcPurchase, marginOf, markupOf, priceFromMarkup, rateFromInclusiveCost, spread } from './purchase-calc';
import { Prisma } from '@prisma/client';

// Every expected figure below is worked out by hand from the rules in the file
// header — not read back from the function.
const s = (v: Prisma.Decimal) => v.toFixed(2);
const s6 = (v: Prisma.Decimal) => v.toFixed(6);

describe('purchase-calc', () => {
  it('T1 — plain local line: 10 × 100 @ 18 %', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 10, rate: 100, gstPct: 18 }] });
    const l = r.lines[0];
    expect([s(l.gross), s(l.taxable), s(l.cgst), s(l.sgst), s(l.igst), s(l.total)]).toEqual(['1000.00', '1000.00', '90.00', '90.00', '0.00', '1180.00']);
    expect(s(r.netPayable)).toBe('1180.00');
    expect(s(r.roundOff)).toBe('0.00');
    expect(s6(l.landedCostWot)).toBe('100.000000');
    expect(s(l.itcEligible)).toBe('180.00');
  });

  it('T2 — discount 2 % and free qty share the cost (Atta: 20 × 245, free 2, 5 %)', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 20, freeQty: 2, rate: 245, discPct: 2, gstPct: 5 }] });
    const l = r.lines[0];
    expect([s(l.gross), s(l.discAmt), s(l.netGross), s(l.cgst), s(l.sgst), s(l.total)]).toEqual(['4900.00', '98.00', '4802.00', '120.05', '120.05', '5042.10']);
    expect(s6(l.landedCostWot)).toBe('218.272727'); // 4802 / 22
  });

  it('T3 — scheme % is taken after the discount (Surf: 48 × 118, sch 5 %, 18 %)', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 48, rate: 118, schPct: 5, gstPct: 18 }] });
    const l = r.lines[0];
    expect([s(l.gross), s(l.schAmt), s(l.taxable), s(l.cgst), s(l.total)]).toEqual(['5664.00', '283.20', '5380.80', '484.27', '6349.34']);
  });

  it('T3b — discount per qty and typed amounts, scheme per qty, extra discount', () => {
    const r = calcPurchase({ interState: false, lines: [
      { key: 'a', billedQty: 10, rate: 50, discPerQty: 2, schPerQty: 1, extraDiscAmt: 5, gstPct: 0 },
      { key: 'b', billedQty: 10, rate: 50, discAmt: 15, schAmt: 4, gstPct: 0 },
    ] });
    expect([s(r.lines[0].discAmt), s(r.lines[0].schAmt), s(r.lines[0].netGross)]).toEqual(['20.00', '10.00', '465.00']);
    expect([s(r.lines[1].discAmt), s(r.lines[1].schAmt), s(r.lines[1].netGross)]).toEqual(['15.00', '4.00', '481.00']);
  });

  it('T4 — short beyond the shortage %: value → receivable, GST → pending (Salt: 10 cases billed, 8 received, 5 %)', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 10, receivedQty: 8, toBaseFactor: 25, rate: 450, gstPct: 5 }] });
    const l = r.lines[0];
    expect([s(l.shortQty), s(l.pendingShortQty), s(l.absorbedShortQty)]).toEqual(['2.00', '2.00', '0.00']);
    expect([s(l.taxable), s(l.cgst), s(l.sgst)]).toEqual(['4500.00', '112.50', '112.50']);
    expect([s(l.itcEligible), s(l.itcPending), s(l.itcIneligible)]).toEqual(['180.00', '45.00', '0.00']);
    expect([s(l.shortValue), s(l.landedValue)]).toEqual(['900.00', '3600.00']);
    expect(s6(l.landedCostWot)).toBe('18.000000'); // 3600 / (8 × 25)
    expect(s(r.netPayable)).toBe('4725.00'); // the supplier bills all 10
  });

  it('T5 — short within the item shortage % is absorbed into cost; its GST is lost (ineligible)', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 100, receivedQty: 99, shortagePct: 2, rate: 10, gstPct: 5 }] });
    const l = r.lines[0];
    expect([s(l.absorbedShortQty), s(l.pendingShortQty)]).toEqual(['1.00', '0.00']);
    expect([s(l.itcEligible), s(l.itcIneligible), s(l.itcPending)]).toEqual(['49.50', '0.50', '0.00']);
    expect(s(l.landedValue)).toBe('1000.50');
    expect(s6(l.landedCostWot)).toBe('10.106061'); // 1000.50 / 99
  });

  it('T5b — damaged qty is in stock and earns ITC; only short is pending', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 48, receivedQty: 46, damagedQty: 2, rate: 100, gstPct: 18 }] });
    const l = r.lines[0];
    expect([s(l.shortQty), s(l.itcPending), s(l.itcEligible)]).toEqual(['0.00', '0.00', '864.00']);
    expect(s6(l.landedCostWot)).toBe('100.000000'); // 4800 / 48 (46 + 2)
  });

  it('T6 — charges: before-tax freight taxed at the line rate, cash discount after tax, coolie off the bill split per loadman', () => {
    const r = calcPurchase({
      interState: false,
      lines: [
        { key: 'a', billedQty: 6, rate: 100, gstPct: 18 },
        { key: 'b', billedQty: 4, rate: 100, gstPct: 18 },
      ],
      charges: [
        { key: 'frt', type: 'ADD', method: 'FIXED', rate: 100, alloc: 'VALUE', beforeTax: true, onBill: true, landingCost: true },
        { key: 'cd', type: 'DEDUCT', method: 'FIXED', rate: 50, alloc: 'VALUE', beforeTax: false, onBill: true, landingCost: true },
        { key: 'coolie', type: 'ADD', method: 'QTY', rate: 2, alloc: 'VALUE', beforeTax: false, onBill: false, landingCost: true,
          payees: [{ partyId: 'ravi' }, { partyId: 'kumar' }] },
      ],
    });
    const [a, b] = r.lines;
    expect([s(a.chrgBeforeTax), s(b.chrgBeforeTax)]).toEqual(['60.00', '40.00']);
    expect([s(a.taxable), s(a.cgst), s(b.taxable), s(b.cgst)]).toEqual(['660.00', '59.40', '440.00', '39.60']);
    expect([s(a.chrgAfterTax), s(b.chrgAfterTax)]).toEqual(['-30.00', '-20.00']);
    expect([s(a.offbillShare), s(b.offbillShare)]).toEqual(['12.00', '8.00']);
    expect(s(r.netPayable)).toBe('1248.00'); // 778.80 + 519.20 − 50; coolie NOT in it
    expect(s(r.offbillCharges)).toBe('20.00');
    expect(r.charges[2].payees.map((p) => s(p.amount))).toEqual(['10.00', '10.00']);
    expect([s6(a.landedCostWot), s6(b.landedCostWot)]).toEqual(['107.000000', '107.000000']); // (660 − 30 + 12) / 6, (440 − 20 + 8) / 4
  });

  it('T6b — given payee amounts win, the rest is split', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 10, rate: 10 }],
      charges: [{ key: 'c', type: 'ADD', method: 'FIXED', rate: 100, alloc: 'VALUE', beforeTax: false, onBill: false, landingCost: true,
        payees: [{ partyId: 'x', amount: 40 }, { partyId: 'y' }, { partyId: 'z' }] }] });
    expect(r.charges[0].payees.map((p) => s(p.amount))).toEqual(['40.00', '30.00', '30.00']);
  });

  it('T6c — an after-tax, tax-applicable on-bill charge carries its own GST', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 1, rate: 1000, gstPct: 5 }],
      charges: [{ key: 'pack', type: 'ADD', method: 'FIXED', rate: 100, alloc: 'VALUE', beforeTax: false, onBill: true, landingCost: true, taxPct: 18 }] });
    expect([s(r.charges[0].cgst), s(r.charges[0].sgst), s(r.chargeTax)]).toEqual(['9.00', '9.00', '18.00']);
    expect(s(r.netPayable)).toBe('1168.00'); // 1050 + 100 + 18
  });

  it('T7 — inter-state is IGST; a composition supplier bills without tax', () => {
    const i = calcPurchase({ interState: true, lines: [{ key: 'a', billedQty: 10, rate: 100, gstPct: 18 }] });
    expect([s(i.lines[0].igst), s(i.lines[0].cgst)]).toEqual(['180.00', '0.00']);
    const c = calcPurchase({ interState: false, supplierTaxMode: 'COMPOSITION', lines: [{ key: 'a', billedQty: 10, rate: 100, gstPct: 18 }] });
    expect([s(c.lines[0].cgst), s(c.netPayable), c.lines[0].itcClass]).toEqual(['0.00', '1000.00', 'COMPOSITION']);
  });

  it('T7b — blocked credit goes into cost', () => {
    const r = calcPurchase({ interState: false, lines: [{ key: 'a', billedQty: 1, rate: 1000, gstPct: 18, itcClass: 'BLOCKED_17_5' }] });
    expect([s(r.lines[0].itcIneligible), s(r.lines[0].itcEligible), s(r.lines[0].landedValue)]).toEqual(['180.00', '0.00', '1180.00']);
  });

  it('T8 — rounds to the rupee; cess % + cess per unit; TCS in the payable', () => {
    const r = calcPurchase({ interState: false, roundOffStep: 1, tcsAmount: 1.1,
      lines: [{ key: 'a', billedQty: 3, rate: 33.47, gstPct: 12, cessPct: 1, cessPerUnit: 0.5 }] });
    const l = r.lines[0];
    // taxable 100.41 · cgst 6.02 · sgst 6.02 · cess 1.00 + 1.50 = 2.50 · total 114.95 · + tcs 1.10 = 116.05 → 116
    expect([s(l.taxable), s(l.cgst), s(l.cess), s(l.total)]).toEqual(['100.41', '6.02', '2.50', '114.95']);
    expect([s(r.netPayable), s(r.roundOff)]).toEqual(['116.00', '-0.05']);
  });

  it('spread puts the residue on the last weighted share', () => {
    expect(spread(new Prisma.Decimal(100), [1, 1, 1].map((n) => new Prisma.Decimal(n))).map(s)).toEqual(['33.33', '33.33', '33.34']);
    expect(spread(new Prisma.Decimal(10), [0, 2, 0].map((n) => new Prisma.Decimal(n))).map(s)).toEqual(['0.00', '10.00', '0.00']);
  });

  it('price helpers: markup on cost w/o tax, rounding step, margin, inclusive back-solve', () => {
    expect(priceFromMarkup(220.35, 12, 1).toFixed(2)).toBe('247.00'); // 246.79 → 247
    expect(priceFromMarkup(100, 15, 0).toFixed(2)).toBe('115.00');
    expect(markupOf(100, 125).toFixed(4)).toBe('25.0000');
    expect(marginOf(100, 125).toFixed(4)).toBe('20.0000');
    expect(rateFromInclusiveCost(118, 18).toFixed(6)).toBe('100.000000');
    expect(rateFromInclusiveCost(12.5, 18, 0, 0.7).toFixed(6)).toBe('10.000000'); // (12.50 − 0.70) / 1.18
  });
});
