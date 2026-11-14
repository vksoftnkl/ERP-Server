import { Prisma } from '@prisma/client';
import {
  D,
  ZERO,
  baseOf,
  basisOf,
  basisTotals,
  cashDiscShare,
  emptiesBill,
  everyChargeBack,
  lastSaleLine,
  mirrorBilledLines,
  resplitGst,
  mirrorCharges,
  resolveFactor,
  roundOffFor,
  todayPriceLine,
  totalsOf,
  zeroParts,
  type BillChargeFacts,
  type BillLineFacts,
  type LineMoney,
  type LineParts,
  type PriorBack,
} from './sale-return-money';

/**
 * Plan v5 D45 / D46 / D52 / D54 / D56 / D68–D71 — the money mirror, pure.
 * Every figure is a Prisma.Decimal compared EXACTLY: no epsilons.
 */

const S = (v: Prisma.Decimal | null) => (v === null ? null : v.toString());

function line(
  over: Omit<Partial<BillLineFacts>, 'parts'> & { parts?: Partial<LineParts> } = {},
): BillLineFacts {
  const parts = zeroParts();
  Object.assign(parts, over.parts ?? {});
  return {
    billItemId: 'bl-1',
    accYear: '2026-2027',
    lineNo: 1,
    itemId: 'item-1',
    itemUnitId: 'unit-dz',
    qty: D('24.889'),
    factor: D('0.1'),
    perUnit: {
      rate: D(40),
      ratePreTax: D('33.8983'),
      maxPrice: null,
      minPrice: null,
      actPrice: null,
      itemDiscQty: null,
      splDiscQty: null,
      schDiscQty: null,
      billSchQty: null,
      cessPerUnit: null,
      acessPerUnit: null,
    },
    percent: {
      itemDiscPerc: D(0),
      splDiscPerc: D(0),
      schDiscPerc: D(0),
      billSchPerc: D(0),
      addlDisc1Perc: D(0),
      addlDisc2Perc: D(0),
      cashDiscPerc: D(0),
      taxPerc: D(18),
      cgstPerc: D(9),
      sgstPerc: D(9),
      igstPerc: D(0),
      cessPerc: D(0),
      acessPerc: D(0),
    },
    copy: {
      hsnCode: '1006',
      taxId: 'tax-18',
      isTaxIncl: true,
      isFree: false,
      freeType: null,
      isService: false,
      schemeId: null,
      schemeName: null,
      priceLevel: 1,
      eanCode: null,
      lotId: 'lot-1',
      batchNo: 'B1',
      batchDate: null,
      expiryDate: null,
      serialNo: null,
      salesmanId: null,
      promoUsageId: null,
      qtyPriceId: null,
      size: null,
      sizeUom: null,
    },
    ...(over as Partial<BillLineFacts>),
    parts,
  };
}

/** bil00054's line: 24.889 DZ, tax-inclusive 40.00, taxable 843.69 + 75.93 + 75.93. */
const BIL54 = () =>
  line({
    parts: {
      grossAmt: D('843.69'),
      netGross: D('843.69'),
      taxableAmt: D('843.69'),
      cgstAmt: D('75.93'),
      sgstAmt: D('75.93'),
    },
  });

const ask = (qty: string, over: Record<string, unknown> = {}) => ({
  index: 0,
  lineNo: 1,
  splitNo: 1,
  itemId: 'item-1',
  itemUnitId: 'unit-dz',
  qty: D(qty),
  factor: D('0.1'),
  billItemId: 'bl-1',
  ...over,
});

const BILL = { refno: 'bil00054', date: '2026-10-28' };
const noPrior = new Map<string, PriorBack>();

describe('resolveFactor (D68)', () => {
  it("takes the line's own factor, else the unit's, else 1", () => {
    expect(S(resolveFactor('0.1', '12'))).toBe('0.1');
    expect(S(resolveFactor(0, '12'))).toBe('12');
    expect(S(resolveFactor(0, 0))).toBe('1');
    expect(S(resolveFactor(null, null))).toBe('1');
  });
});

describe('mirrorBilledLines — the money mirror (D45)', () => {
  it('takes 10 of 24.889 DZ of a tax-inclusive line pro rata by base qty: 338.98 + 30.51 + 30.51 = 400.00', () => {
    const [m] = mirrorBilledLines(BILL, [BIL54()], noPrior, [ask('10')]);

    expect(S(m.qtyBase)).toBe('1');
    expect(S(m.parts.taxableAmt)).toBe('338.98');
    expect(S(m.parts.cgstAmt)).toBe('30.51');
    expect(S(m.parts.sgstAmt)).toBe('30.51');
    expect(S(m.netAmt)).toBe('400');
    expect(m.takesRemainder).toBe(false);
    expect(m.rateSource).toEqual({
      kind: 'BILL',
      sbRefno: 'bil00054',
      sbDate: '2026-10-28',
      billItemId: 'bl-1',
      accYear: '2026-2027',
    });
  });

  it('adds three part returns of one discounted line up to the bill line to the paisa; the last takes the rest', () => {
    // 3 units at 33.33 less a 10 % discount: shares do not divide evenly.
    const bl = line({
      qty: D(3),
      factor: D(1),
      parts: {
        grossAmt: D(100),
        itemDiscAmt: D(10),
        netGross: D(90),
        taxableAmt: D(90),
        cgstAmt: D('8.10'),
        sgstAmt: D('8.10'),
        cogsAmt: D('61.01'),
      },
    });
    const prior = new Map<string, PriorBack>();
    const taken: LineMoney[] = [];
    for (let i = 0; i < 3; i++) {
      const [m] = mirrorBilledLines(BILL, [bl], prior, [ask('1', { factor: D(1) })]);
      taken.push(m);
      const before = prior.get('bl-1') ?? { base: ZERO, parts: zeroParts() };
      const parts = zeroParts();
      for (const k of Object.keys(parts) as (keyof LineParts)[]) {
        parts[k] = before.parts[k].plus(m.parts[k]);
      }
      prior.set('bl-1', { base: before.base.plus(m.qtyBase), parts });
    }
    const sum = (k: keyof LineParts) => taken.reduce((t, m) => t.plus(m.parts[k]), ZERO).toString();

    expect(taken.map((m) => m.parts.taxableAmt.toString())).toEqual(['30', '30', '30']);
    expect(taken.map((m) => m.parts.cgstAmt.toString())).toEqual(['2.7', '2.7', '2.7']);
    expect(taken.map((m) => m.parts.cogsAmt.toString())).toEqual(['20.34', '20.34', '20.33']);
    expect(taken.map((m) => m.takesRemainder)).toEqual([false, false, true]);
    expect(sum('grossAmt')).toBe('100');
    expect(sum('itemDiscAmt')).toBe('10');
    expect(sum('taxableAmt')).toBe('90');
    expect(sum('cogsAmt')).toBe('61.01');
  });

  it('never gives a part more than is left when rounding up keeps winning (0.15 over 10 units)', () => {
    const bl = line({ qty: D(10), factor: D(1), parts: { cessAmt: D('0.15'), taxableAmt: D(10) } });
    let prior = new Map<string, PriorBack>();
    let total = ZERO;
    for (let i = 0; i < 10; i++) {
      const [m] = mirrorBilledLines(BILL, [bl], prior, [ask('1', { factor: D(1) })]);
      total = total.plus(m.parts.cessAmt);
      expect(total.lte(D('0.15'))).toBe(true);
      const p = zeroParts();
      p.cessAmt = total;
      p.taxableAmt = D(i + 1);
      prior = new Map([['bl-1', { base: D(i + 1), parts: p }]]);
    }
    expect(total.toString()).toBe('0.15');
  });

  it('runs Ctrl+D splits one after another: the split that empties the line takes the rest', () => {
    const bl = line({ qty: D(3), factor: D(1), parts: { taxableAmt: D(100) } });
    const out = mirrorBilledLines(BILL, [bl], noPrior, [
      ask('2', { factor: D(1), lineNo: 2, splitNo: 1, index: 0 }),
      ask('1', { factor: D(1), lineNo: 3, splitNo: 2, index: 1 }),
    ]);

    expect(out.map((m) => m.parts.taxableAmt.toString())).toEqual(['66.67', '33.33']);
    expect(out.map((m) => m.takesRemainder)).toEqual([false, true]);
  });

  it('checks in base units: BOX billed, PCS back (D52); over in base is refused, with nothing taken', () => {
    // 2 BOX of 12 = 24 base; 30 PCS back is over, 12 PCS is half the line.
    const bl = line({ qty: D(2), factor: D(12), itemUnitId: 'box', parts: { taxableAmt: D(480) } });
    const [over] = mirrorBilledLines(BILL, [bl], noPrior, [
      ask('30', { factor: D(1), itemUnitId: 'pcs' }),
    ]);
    const [half] = mirrorBilledLines(BILL, [bl], noPrior, [
      ask('12', { factor: D(1), itemUnitId: 'pcs' }),
    ]);

    expect(over.overQty).toBe(true);
    expect(S(over.leftBaseBefore)).toBe('24');
    expect(S(over.parts.taxableAmt)).toBe('0');
    expect(half.overQty).toBe(false);
    expect(S(half.parts.taxableAmt)).toBe('240');
    // The rate follows the unit: per PCS = per BOX ÷ 12.
    expect(S(half.perUnit.rate)).toBe('3.3333');
  });

  it("quotes the bill line's own COGS per base unit, and none when the bill had none (D54 / D69)", () => {
    const costed = line({
      qty: D(4),
      factor: D(1),
      parts: { taxableAmt: D(400), cogsAmt: D(320) },
    });
    const [m] = mirrorBilledLines(BILL, [costed], noPrior, [ask('1', { factor: D(1) })]);
    const [none] = mirrorBilledLines(BILL, [line({ qty: D(4), factor: D(1) })], noPrior, [
      ask('1', { factor: D(1) }),
    ]);

    expect(S(m.costPerBase)).toBe('80');
    expect(S(m.parts.cogsAmt)).toBe('80');
    expect(none.costPerBase).toBeNull();
  });

  it('keeps the signed before-tax charge share inside the line (CD before tax comes back as minus)', () => {
    const bl = line({
      qty: D(10),
      factor: D(1),
      parts: { grossAmt: D(1250), netGross: D(1250), chrgBeforeTax: D(-25), taxableAmt: D(1225) },
    });
    const [m] = mirrorBilledLines(BILL, [bl], noPrior, [ask('3', { factor: D(1) })]);

    expect(S(m.parts.chrgBeforeTax)).toBe('-7.5');
    expect(S(m.parts.taxableAmt)).toBe('367.5');
  });
});

describe('emptiesBill', () => {
  it('is true only when every line of the bill is back after this return', () => {
    const a = line({ billItemId: 'a', qty: D(2), factor: D(1) });
    const b = line({ billItemId: 'b', qty: D(1), factor: D(1) });
    const prior = new Map<string, PriorBack>([['b', { base: D(1), parts: zeroParts() }]]);
    const lines = mirrorBilledLines(BILL, [a, b], prior, [
      ask('2', { billItemId: 'a', factor: D(1) }),
    ]);

    expect(emptiesBill([a, b], prior, lines)).toBe(true);
    expect(emptiesBill([a, b], noPrior, lines)).toBe(false);
  });
});

describe('the no-bill rate (D56)', () => {
  it('prices from the last sale pro rata, no remainder, no COGS (today’s average costs it)', () => {
    const src = line({
      qty: D(10),
      factor: D(1),
      parts: { taxableAmt: D(500), cgstAmt: D(45), sgstAmt: D(45), cogsAmt: D(300) },
    });
    const m = lastSaleLine(
      src,
      { refno: 'bil00010', date: '2026-11-01' },
      ask('2', { factor: D(1) }),
    );

    expect(S(m.parts.taxableAmt)).toBe('100');
    expect(S(m.parts.cogsAmt)).toBe('0');
    expect(m.billItemId).toBeNull();
    expect(m.copy?.lotId).toBeNull();
    expect(m.rateSource).toMatchObject({
      kind: 'LAST_SALE',
      sbRefno: 'bil00010',
      billItemId: 'bl-1',
    });
  });

  it("prices a never-sold item at today's price without tax, GST split by the supply nature", () => {
    const price = {
      rateWot: D('84.7458'),
      rate: D(100),
      taxId: 't',
      hsnCode: null,
      taxPerc: D(18),
      cessPerc: D(0),
      priceLevel: 1,
    };
    const intra = todayPriceLine(price, ask('3', { factor: D(1) }), 'INTRA');
    const inter = todayPriceLine(price, ask('3', { factor: D(1) }), 'INTER');

    expect(S(intra.parts.taxableAmt)).toBe('254.24');
    expect([S(intra.parts.cgstAmt), S(intra.parts.sgstAmt), S(intra.parts.igstAmt)]).toEqual([
      '22.88',
      '22.88',
      '0',
    ]);
    expect(S(inter.parts.igstAmt)).toBe('45.76');
    expect(intra.rateSource.kind).toBe('TODAY_PRICE');
  });
});

describe('mirrorCharges (D46 / D70 / D71)', () => {
  const charge = (over: Partial<BillChargeFacts> = {}): BillChargeFacts => ({
    cdId: 'cd-1',
    accYear: '2026-2027',
    chgId: 'chg-1',
    name: 'FREIGHT CHARGE',
    type: 'ADD',
    beforeTax: false,
    sepPost: true,
    taxApl: true,
    method: 'FIXED',
    role: 'FREIGHT',
    applyOn: null,
    ledgerId: 'led-f',
    ledgerName: null,
    taxCode: 'gst12',
    hsn: null,
    unit: null,
    taxPerc: D(12),
    cgstPerc: D(6),
    sgstPerc: D(6),
    igstPerc: D(0),
    cessPerc: D(0),
    onBill: { amount: D(100), cgst: D(6), sgst: D(6), igst: D(0), cess: D(0) },
    backBefore: { amount: D(0), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
    ...over,
  });
  const billBasis = { qtyBase: D(10), weight: D(50), value: D(1250) };
  const run = (charges: BillChargeFacts[], over: Record<string, unknown> = {}) =>
    mirrorCharges({
      charges,
      asks: new Map(),
      billBasis,
      returnBasis: { qtyBase: D(3), weight: D(20), value: D(375) },
      emptiesBill: false,
      manual: { freight: false, loading: false },
      defaultGiveBack: true,
      ...over,
    });

  it('takes a carried charge back pro rata by its own basis, with its own GST (value / qty / weight)', () => {
    const [value, qty, weight] = run([
      charge(),
      charge({ cdId: 'q', method: 'QTY' }),
      charge({ cdId: 'w', method: 'KG' }),
    ]);

    expect(value).toMatchObject({ kind: 'CARRIED', basis: 'VALUE', sign: 1 });
    expect([S(value.back.amount), S(value.back.cgst)]).toEqual(['30', '1.8']);
    expect(S(qty.back.amount)).toBe('30');
    expect(weight.basis).toBe('WEIGHT');
    expect(S(weight.back.amount)).toBe('40');
  });

  it('gives a deduction back always, signed minus, whatever the tick (D70)', () => {
    const asks = new Map([['cd', { giveBack: false }]]);
    const [cd] = run(
      [
        charge({
          cdId: 'cd',
          type: 'DEDUCT',
          role: 'CASH_DISC',
          taxApl: false,
          onBill: { amount: D(40), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
        }),
      ],
      { asks },
    );

    expect(cd).toMatchObject({ sign: -1, giveBack: true });
    expect(S(cd.back.amount)).toBe('12');
  });

  it('keeps an unticked addition with us', () => {
    const [f] = run([charge()], { asks: new Map([['cd-1', { giveBack: false }]]) });

    expect(f.giveBack).toBe(false);
    expect(S(f.back.amount)).toBe('0');
    expect(S(f.back.cgst)).toBe('0');
  });

  it('marks a before-tax row IN_LINES: worked out for its ledger, never carried into the note', () => {
    const [b] = run([
      charge({
        beforeTax: true,
        taxApl: false,
        sepPost: false,
        type: 'DEDUCT',
        method: 'PERCENT',
        onBill: { amount: D(25), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
      }),
    ]);
    const t = totalsOf({
      lines: [],
      charges: [b],
      cashDisc: ZERO,
      roundOffStep: ZERO,
      billRoundOffLeft: null,
    });

    expect(b.kind).toBe('IN_LINES');
    expect(S(b.back.amount)).toBe('7.5');
    expect(S(t.chargesNet)).toBe('0');
  });

  it('caps at what is left, and the return that empties the bill takes the rest with its GST', () => {
    const half = charge({
      backBefore: { amount: D(70), cgst: D('4.2'), sgst: D('4.2'), igst: D(0), cess: D(0) },
    });
    const [capped] = run([half], { returnBasis: { qtyBase: D(5), weight: D(0), value: D(625) } });
    const [rest] = run([half], { emptiesBill: true });

    expect(S(capped.back.amount)).toBe('30');
    expect(rest).toMatchObject({ takesRemainder: true });
    expect([S(rest.back.amount), S(rest.back.cgst), S(rest.back.sgst)]).toEqual([
      '30',
      '1.8',
      '1.8',
    ]);
  });

  it('takes a typed figure under a manual calc type (D20), and flags one over the cap', () => {
    const manual = { freight: true, loading: false };
    const [typed] = run([charge()], { manual, asks: new Map([['cd-1', { amount: D(20) }]]) });
    const [over] = run([charge()], { manual, asks: new Map([['cd-1', { amount: D(150) }]]) });
    const [auto] = run([charge()], { asks: new Map([['cd-1', { amount: D(20) }]]) });

    expect(typed).toMatchObject({ manual: true, typed: true, overCap: false });
    expect([S(typed.back.amount), S(typed.back.cgst)]).toEqual(['20', '1.2']);
    expect(over.overCap).toBe(true);
    expect(S(auto.back.amount)).toBe('30');
  });

  it('reads the basis from the method, and falls back to value when the bill has none of it', () => {
    expect([
      basisOf('QTY'),
      basisOf('NET_QTY'),
      basisOf('TON'),
      basisOf('PERCENT'),
      basisOf(null),
    ]).toEqual(['QTY', 'QTY', 'WEIGHT', 'VALUE', 'VALUE']);
    const [w] = run([charge({ method: 'KG' })], { billBasis: { ...billBasis, weight: D(0) } });
    expect(w.basis).toBe('VALUE');
  });

  it('knows when every carried charge is fully back', () => {
    expect(everyChargeBack(run([charge()], { emptiesBill: true }))).toBe(true);
    expect(everyChargeBack(run([charge()]))).toBe(false);
  });
});

describe('totals and round off', () => {
  it('rounds to the step half-up, and a step of 0 turns it off', () => {
    expect(S(roundOffFor(D('467.26'), D(1)))).toBe('-0.26');
    expect(S(roundOffFor(D('1090.50'), D(1)))).toBe('0.5');
    expect(S(roundOffFor(D('10.07'), D('0.05')))).toBe('-0.02');
    expect(S(roundOffFor(D('10.07'), ZERO))).toBe('0');
  });

  it('adds goods, carried charges and round off into the credit note; the emptying return takes the bill’s round off', () => {
    const bl = line({
      qty: D(10),
      factor: D(1),
      parts: {
        grossAmt: D(1250),
        netGross: D(1250),
        chrgBeforeTax: D(-25),
        taxableAmt: D(1225),
        cgstAmt: D('110.25'),
        sgstAmt: D('110.25'),
      },
    });
    const freight = {
      cdId: 'f',
      accYear: '2026-2027',
      chgId: 'c',
      name: 'FREIGHT',
      type: 'ADD' as const,
      beforeTax: false,
      sepPost: true,
      taxApl: true,
      method: 'FIXED',
      role: 'FREIGHT',
      applyOn: null,
      ledgerId: 'lf',
      ledgerName: null,
      taxCode: 't',
      hsn: null,
      unit: null,
      taxPerc: D(12),
      cgstPerc: D(6),
      sgstPerc: D(6),
      igstPerc: D(0),
      cessPerc: D(0),
      onBill: { amount: D(100), cgst: D(6), sgst: D(6), igst: D(0), cess: D(0) },
      backBefore: { amount: D(0), cgst: D(0), sgst: D(0), igst: D(0), cess: D(0) },
    };
    const first = mirrorBilledLines(BILL, [bl], noPrior, [ask('3', { factor: D(1) })]);
    const c1 = mirrorCharges({
      charges: [freight],
      asks: new Map(),
      billBasis: basisTotals([{ qtyBase: baseOf(bl), parts: bl.parts }]),
      returnBasis: basisTotals(first),
      emptiesBill: false,
      manual: { freight: false, loading: false },
      defaultGiveBack: true,
    });
    const t1 = totalsOf({
      lines: first,
      charges: c1,
      cashDisc: ZERO,
      roundOffStep: D(1),
      billRoundOffLeft: null,
    });

    expect([S(t1.goods), S(t1.chargesNet), S(t1.roundOff), S(t1.creditNote)]).toEqual([
      '433.66',
      '33.6',
      '-0.26',
      '467',
    ]);
    // The bill's taxable convention: lines + the carried charge that has its own GST.
    expect(S(t1.taxable)).toBe('397.5');
    expect(S(t1.cgst)).toBe('34.88');

    const p = zeroParts();
    for (const k of Object.keys(p) as (keyof LineParts)[]) {
      p[k] = first[0].parts[k];
    }
    const prior = new Map([['bl-1', { base: D(3), parts: p }]]);
    const rest = mirrorBilledLines(BILL, [bl], prior, [ask('7', { factor: D(1) })]);
    const c2 = mirrorCharges({
      charges: [
        {
          ...freight,
          backBefore: { amount: D(30), cgst: D('1.8'), sgst: D('1.8'), igst: D(0), cess: D(0) },
        },
      ],
      asks: new Map(),
      billBasis: basisTotals([{ qtyBase: baseOf(bl), parts: bl.parts }]),
      returnBasis: basisTotals(rest),
      emptiesBill: emptiesBill([bl], prior, rest),
      manual: { freight: false, loading: false },
      defaultGiveBack: true,
    });
    // Bill round off 0.00 − the first return's −0.26.
    const t2 = totalsOf({
      lines: rest,
      charges: c2,
      cashDisc: ZERO,
      roundOffStep: D(1),
      billRoundOffLeft: D('0.26'),
    });
    expect(t2.creditNote.plus(t1.creditNote).toString()).toBe('1557.5');
    expect(t2.takesBillRoundOff).toBe(true);
  });

  it('shares the header cash discount by line taxable; the emptying return takes what is left', () => {
    expect(
      S(
        cashDiscShare({
          billCashDisc: D(10),
          priorCashDisc: ZERO,
          billLineTaxable: D(300),
          returnLineTaxable: D(100),
          emptiesBill: false,
        }),
      ),
    ).toBe('3.33');
    expect(
      S(
        cashDiscShare({
          billCashDisc: D(10),
          priorCashDisc: D('6.66'),
          billLineTaxable: D(300),
          returnLineTaxable: D(100),
          emptiesBill: true,
        }),
      ),
    ).toBe('3.34');
  });
});

describe('review 11-14 S5 — a LAST_SALE line is split by the RETURN’s supply nature', () => {
  const src = () =>
    line({
      qty: D(10),
      factor: D(1),
      parts: { taxableAmt: D(500), cgstAmt: D(45), sgstAmt: D(45), cessAmt: D(5) },
    });

  it('re-splits an intra-state source line IGST for an inter-state return, as todayPriceLine does', () => {
    const m = lastSaleLine(src(), BILL, ask('2', { factor: D(1) }), 'INTER');

    expect(S(m.parts.taxableAmt)).toBe('100');
    expect([
      S(m.parts.cgstAmt),
      S(m.parts.sgstAmt),
      S(m.parts.igstAmt),
      S(m.parts.cessAmt),
    ]).toEqual(['0', '0', '18', '1']);
    expect([S(m.percent.cgstPerc), S(m.percent.sgstPerc), S(m.percent.igstPerc)]).toEqual([
      '0',
      '0',
      '18',
    ]);
    expect(S(m.taxAmt)).toBe('19');
    expect(S(m.netAmt)).toBe('119');
  });

  it('leaves a source line already split the return’s way exactly as scaled', () => {
    const m = lastSaleLine(src(), BILL, ask('2', { factor: D(1) }), 'INTRA');

    expect([S(m.parts.cgstAmt), S(m.parts.sgstAmt), S(m.parts.igstAmt)]).toEqual(['9', '9', '0']);
    expect(S(m.percent.cgstPerc)).toBe('9');
  });

  it('splits an inter-state source line in half for an intra-state return', () => {
    const parts = { ...zeroParts(), taxableAmt: D('100.01'), igstAmt: D(18) };
    const percent = {
      ...line().percent,
      cgstPerc: D(0),
      sgstPerc: D(0),
      igstPerc: D(18),
    };
    resplitGst(parts, percent, 'INTRA');

    expect([S(parts.cgstAmt), S(parts.sgstAmt), S(parts.igstAmt)]).toEqual(['9', '9', '0']);
    expect([S(percent.cgstPerc), S(percent.sgstPerc), S(percent.igstPerc)]).toEqual([
      '9',
      '9',
      '0',
    ]);
  });
});

describe('review 11-14 B1 — a return worth nothing takes no bill round off', () => {
  it('a 0.00 return that empties the bill stays 0.00 (no leftover round off, no negative note)', () => {
    const free = mirrorBilledLines(
      BILL,
      [line({ qty: D(2), factor: D(1), parts: { cogsAmt: D(80) } })],
      noPrior,
      [ask('2', { factor: D(1) })],
    );
    for (const left of [D('0.45'), D('-0.30')]) {
      const t = totalsOf({
        lines: free,
        charges: [],
        cashDisc: ZERO,
        roundOffStep: D(1),
        billRoundOffLeft: left,
      });
      expect([S(t.roundOff), S(t.creditNote), t.takesBillRoundOff]).toEqual(['0', '0', false]);
    }
  });
});
