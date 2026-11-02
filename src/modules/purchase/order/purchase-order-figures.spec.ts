import { Prisma } from '@prisma/client';
import { calcPurchase, type CalcLineIn } from '../common/purchase-calc';
import { purchaseChargeInput, type PurchaseChargeMaster } from '../common/purchase-charges';
import { poFigures, poGoodsValue } from './purchase-order-figures';
import { poApprovalStatus } from './purchase-order';

// The PO's one calc (2026-11-02, "full, like Sale Entry"): lines + charges with the master's real flags.
// Every expected figure is worked by hand from the rules — not read back from the function.
const s = (v: Prisma.Decimal) => v.toFixed(2);
const s6 = (v: Prisma.Decimal) => v.toFixed(6);

const master = (m: Partial<PurchaseChargeMaster>): PurchaseChargeMaster => ({
  chg_id: 'c', chg_name: 'charge', chg_type: 'ADD', chg_method: 'FIXED', chg_default_rate: null, chg_cost_alloc: 'VALUE',
  chg_before_tax: false, chg_tax_apl: false, chg_landing_cost: true, chg_on_bill: true, chg_ledger_code: 'l', chg_role: null,
  tax_rate_perc: null, chg_tax_id: null, ...m,
});
type PoLine = { qty: number; freeQty?: number; rate: number; discPct?: number; gstPct: number; factor?: number };
/** As compute() builds it: everything ordered counts as received, nothing damaged. */
function po(lines: PoLine[], charges: { m: PurchaseChargeMaster; rate?: number; amount?: number }[], interState = false) {
  const ins: CalcLineIn[] = lines.map((l, i) => ({ key: String(i + 1), billedQty: l.qty, receivedQty: l.qty, damagedQty: 0, freeQty: l.freeQty ?? 0,
    rate: l.rate, discPct: l.discPct, gstPct: l.gstPct, toBaseFactor: l.factor ?? 1 }));
  const calc = calcPurchase({ interState, roundOffStep: 0, lines: ins,
    charges: charges.map((c, i) => purchaseChargeInput(c.m, { rate: c.rate, amount: c.amount }, String(i))) });
  return { calc, ...poFigures(calc, lines) };
}

describe('PO figures — charges spread on the lines (one calc)', () => {
  it('no charges: the figures are the goods only (today\'s PO)', () => {
    const r = po([{ qty: 10, rate: 100, gstPct: 18 }], []);
    const l = r.lines[0];
    expect([s(l.taxable), s(l.tax), s(l.total), s(l.amount), s6(l.landedCost), s6(l.landedCostIncl)]).toEqual(['1000.00', '180.00', '1180.00', '1180.00', '100.000000', '118.000000']);
    expect([s(r.totals.net), s(r.totals.chargesEstimate), s(r.totals.poTotal)]).toEqual(['1180.00', '0.00', '1180.00']);
  });

  it('before-tax on-bill charge joins each line\'s taxable and its GST (100 by value over two lines of 1000)', () => {
    const r = po([{ qty: 10, rate: 100, gstPct: 18 }, { qty: 5, rate: 200, gstPct: 5 }],
                 [{ m: master({ chg_before_tax: true, chg_default_rate: new Prisma.Decimal(100) }) }]);
    const [a, b] = r.lines;
    // line 1: 1000 + 50 = 1050; GST 9 % + 9 % of 1050 = 94.50 + 94.50
    expect([s(a.netGross), s(a.chrgBeforeTax), s(a.taxable), s(a.tax), s(a.total), s(a.amount)]).toEqual(['1000.00', '50.00', '1050.00', '189.00', '1239.00', '1239.00']);
    expect([s(a.landedValue), s6(a.landedCost), s6(a.landedCostIncl)]).toEqual(['1050.00', '105.000000', '123.900000']);   // 1050 / 10; 1239 / 10
    // line 2: 1000 + 50 = 1050; GST 2.5 % + 2.5 % = 26.25 + 26.25
    expect([s(b.taxable), s(b.tax), s(b.total), s6(b.landedCost), s6(b.landedCostIncl)]).toEqual(['1050.00', '52.50', '1102.50', '210.000000', '220.500000']);
    // goods 1180 + 1050 = 2230, + freight 100 = 2330 before; now + GST on the freight shares (9 + 2.50)
    expect([s(r.totals.chrgBeforeTax), s(r.totals.net), s(r.totals.chargesTotal), s(r.totals.chargesEstimate), s(r.totals.poTotal)])
      .toEqual(['100.00', '2341.50', '100.00', '0.00', '2341.50']);
  });

  it('after-tax on-bill charge with its own GST: in the line amount and landed cost, its GST in the PO total', () => {
    const r = po([{ qty: 10, rate: 100, gstPct: 18 }],
                 [{ m: master({ chg_tax_apl: true, tax_rate_perc: new Prisma.Decimal(18), chg_default_rate: new Prisma.Decimal(50) }) }]);
    const l = r.lines[0];
    expect([s(l.taxable), s(l.tax), s(l.total), s(l.chrgAfterTax), s(l.amount)]).toEqual(['1000.00', '180.00', '1180.00', '50.00', '1230.00']);
    expect([s(l.landedValue), s6(l.landedCost), s6(l.landedCostIncl)]).toEqual(['1050.00', '105.000000', '123.000000']);   // (1050 + 180) / 10
    // own GST 9 % + 9 % of 50 = 4.50 + 4.50
    expect([s(r.totals.chargeTax), s(r.totals.chargesEstimate), s(r.totals.poTotal)]).toEqual(['9.00', '59.00', '1239.00']);
    expect(s(r.totals.poTotal)).toBe(s(r.calc.netPayable));   // the bill's own sum (no round off on a PO)
  });

  it('off-bill charge: landing cost even when the master says not (D13), no GST, not on the supplier\'s figures, still in the PO total', () => {
    const r = po([{ qty: 10, rate: 100, gstPct: 18 }, { qty: 10, rate: 50, gstPct: 18 }],
                 [{ m: master({ chg_on_bill: false, chg_landing_cost: false, chg_tax_apl: true, tax_rate_perc: new Prisma.Decimal(18), chg_default_rate: new Prisma.Decimal(150) }) }]);
    const [a, b] = r.lines;
    expect([s(a.offbillShare), s(a.taxable), s(a.total), s(a.amount), s(a.landedValue), s6(a.landedCost), s6(a.landedCostIncl)])
      .toEqual(['100.00', '1000.00', '1180.00', '1180.00', '1100.00', '110.000000', '128.000000']);
    expect([s(b.offbillShare), s(b.landedValue), s6(b.landedCost), s6(b.landedCostIncl)]).toEqual(['50.00', '550.00', '55.000000', '64.000000']);
    expect([s(r.totals.net), s(r.totals.offbill), s(r.totals.chargeTax), s(r.totals.chargesEstimate), s(r.totals.poTotal)])
      .toEqual(['1770.00', '150.00', '0.00', '150.00', '1920.00']);   // = goods 1770 + 150, as today
  });

  it('not-landing charges: in the line figures, out of the landed cost', () => {
    // after-tax, untaxed, on-bill: the PO total is exactly today's (goods + charge)
    const after = po([{ qty: 10, rate: 100, gstPct: 18 }], [{ m: master({ chg_landing_cost: false, chg_default_rate: new Prisma.Decimal(40) }) }]);
    const a = after.lines[0];
    expect([s(a.chrgAfterTax), s(a.amount), s(a.landedValue), s6(a.landedCost), s6(a.landedCostIncl)]).toEqual(['40.00', '1220.00', '1000.00', '100.000000', '118.000000']);
    expect([s(after.totals.net), s(after.totals.chargesEstimate), s(after.totals.poTotal)]).toEqual(['1180.00', '40.00', '1220.00']);
    // before-tax: taxed with the line (1020 → 91.80 + 91.80) but not landing
    const before = po([{ qty: 10, rate: 100, gstPct: 18 }], [{ m: master({ chg_before_tax: true, chg_landing_cost: false, chg_default_rate: new Prisma.Decimal(20) }) }]);
    const b = before.lines[0];
    expect([s(b.taxable), s(b.tax), s(b.total), s(b.landedValue), s6(b.landedCost), s6(b.landedCostIncl)]).toEqual(['1020.00', '183.60', '1203.60', '1000.00', '100.000000', '118.360000']);
    expect([s(before.totals.chargesEstimate), s(before.totals.poTotal)]).toEqual(['0.00', '1203.60']);
  });

  it('QTY allocation spreads by base qty; the landed cost is per the line\'s own unit (a box of 12)', () => {
    const r = po([{ qty: 10, rate: 100, gstPct: 0 }, { qty: 2, rate: 1200, gstPct: 0, factor: 12 }],
                 [{ m: master({ chg_cost_alloc: 'QTY', chg_default_rate: new Prisma.Decimal(68) }) }]);
    const [a, b] = r.lines;
    // weights 10 × 1 and 2 × 12 = 10 : 24 → 68 × 10 / 34 = 20, the rest 48
    expect([s(a.chrgAfterTax), s(a.amount), s6(a.landedCost)]).toEqual(['20.00', '1020.00', '102.000000']);
    expect([s(b.chrgAfterTax), s(b.amount), s(b.landedValue), s6(b.landedCost)]).toEqual(['48.00', '2448.00', '2448.00', '1224.000000']);   // per box, not per piece (102)
    expect([s(r.totals.net), s(r.totals.chargesEstimate), s(r.totals.poTotal)]).toEqual(['3400.00', '68.00', '3468.00']);
  });

  it('a free qty shares the landed cost (Atta: 20 + 2 free × 245, disc 2 %, 5 %, freight 98 before tax)', () => {
    const r = po([{ qty: 20, freeQty: 2, rate: 245, discPct: 2, gstPct: 5 }], [{ m: master({ chg_before_tax: true }), rate: 98 }]);
    const l = r.lines[0];
    // net gross 4900 − 98 = 4802; + 98 = 4900; GST 2.5 % + 2.5 % = 122.50 + 122.50
    expect([s(l.netGross), s(l.taxable), s(l.tax), s(l.total), s(l.landedValue)]).toEqual(['4802.00', '4900.00', '245.00', '5145.00', '4900.00']);
    expect([s6(l.landedCost), s6(l.landedCostIncl)]).toEqual(['222.727273', '233.863636']);   // 4900 / 22; 5145 / 22
  });

  it('a before-tax charge no line can take (all lines at 0) still counts once in the PO total', () => {
    const r = po([{ qty: 5, rate: 0, gstPct: 18 }], [{ m: master({ chg_before_tax: true, chg_default_rate: new Prisma.Decimal(100) }) }]);
    expect([s(r.lines[0].chrgBeforeTax), s(r.totals.net), s(r.totals.chargesEstimate), s(r.totals.poTotal)]).toEqual(['0.00', '0.00', '100.00', '100.00']);
  });

  it('a DEDUCT charge after tax lowers the amount and the PO total', () => {
    const r = po([{ qty: 10, rate: 100, gstPct: 18 }], [{ m: master({ chg_type: 'DEDUCT', chg_method: 'PERCENT' }), rate: 2 }]);
    const l = r.lines[0];
    expect([s(l.chrgAfterTax), s(l.amount), s6(l.landedCost)]).toEqual(['-20.00', '1160.00', '98.000000']);
    expect([s(r.totals.chargesTotal), s(r.totals.chargesEstimate), s(r.totals.poTotal)]).toEqual(['-20.00', '-20.00', '1160.00']);
  });
});

describe('PO approval stays on the goods (no charge in it, not even a before-tax one)', () => {
  it('900 @ 18 % + before-tax freight 100: po net 1180, but the approval value is the goods 1062', () => {
    const lines: PoLine[] = [{ qty: 10, rate: 90, gstPct: 18 }];
    const r = po(lines, [{ m: master({ chg_before_tax: true, chg_default_rate: new Prisma.Decimal(100) }) }]);
    expect([s(r.totals.net), s(r.totals.chargesEstimate), s(r.totals.poTotal)]).toEqual(['1180.00', '0.00', '1180.00']);
    const goods = poGoodsValue([{ key: '1', billedQty: 10, rate: 90, gstPct: 18 }], false);
    expect(s(goods.value)).toBe('1062.00');
    const at = (limit: number) => poApprovalStatus({ limit: new Prisma.Decimal(limit), goods, chargesEstimate: r.totals.chargesEstimate, confirming: true, amending: false,
                                                    current: null, currentGoodsValue: null }).status;
    expect([at(1100), at(1000)]).toEqual(['NOT_REQUIRED', 'AWAITING']);
  });
});

describe('purchaseChargeInput — the master\'s flags, as the bill reads them', () => {
  it('on-bill: before / after tax and landing as the master; own GST only after tax and tax-applicable; no payees', () => {
    const i = purchaseChargeInput(master({ chg_before_tax: true, chg_tax_apl: true, tax_rate_perc: new Prisma.Decimal(18), chg_landing_cost: false, chg_cost_alloc: 'NONE' }),
                                  { payees: [{ partyId: 'p' }] }, '0');
    expect([i.beforeTax, i.onBill, i.landingCost, String(i.taxPct), i.alloc, i.payees!.length]).toEqual([true, true, false, '0', 'VALUE', 0]);
    const j = purchaseChargeInput(master({ chg_tax_apl: true, tax_rate_perc: new Prisma.Decimal(12), chg_cost_alloc: 'WEIGHT', chg_default_rate: new Prisma.Decimal(5) }), { rate: 7 }, '1');
    expect([j.beforeTax, String(j.taxPct), j.alloc, String(j.rate)]).toEqual([false, '12', 'WEIGHT', '7']);
  });
  it('off-bill: never before tax, always landing (D13), no GST (D14), payees kept', () => {
    const i = purchaseChargeInput(master({ chg_on_bill: false, chg_before_tax: true, chg_landing_cost: false, chg_tax_apl: true, tax_rate_perc: new Prisma.Decimal(18) }),
                                  { payees: [{ partyId: 'p', amount: 10 }] }, '0');
    expect([i.beforeTax, i.onBill, i.landingCost, String(i.taxPct), i.payees]).toEqual([false, false, true, '0', [{ partyId: 'p', amount: 10 }]]);
  });
});
