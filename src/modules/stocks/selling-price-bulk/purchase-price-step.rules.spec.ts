import { Prisma } from '@prisma/client';
import {
  billCost,
  cardKeptFigure,
  cardPriceFor,
  cardTypeOf,
  chainCost,
  chainKey,
  keyPerBase,
  proposeLevels,
  proposeNewLine,
  purchasePriceModeOf,
  purchaseTargetScope,
  reliableDecimals,
  roundToStep,
  strongestResult,
  weightedLandedWot,
  withoutTax,
  type CurrentLevel,
} from './purchase-price-step.rules';
import { laterMatch, newestLater } from './purchase-price-step.service';
import type { LaterLine } from './purchase-price-step.gateway';

/**
 * Change Selling Price P2 — the golden table (plan 2026-11-24 §4.3 / §4.4, examples E1–E3).
 * The SAME table is the QtTest of ItemPriceRule (plan §9.2 QT15): the server's proposal and
 * menu 30's own maths must agree to the paisa.
 */
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const lv = (prices: number[], stored: (number | null)[] = []): CurrentLevel[] =>
  [1, 2, 3, 4].map((level) => ({
    level: level as 1 | 2 | 3 | 4,
    price: D(prices[level - 1] ?? 0),
    storedMarkup: stored[level - 1] === undefined || stored[level - 1] === null ? null : D(stored[level - 1] as number),
  }));
const prices = (levels: { price: Prisma.Decimal }[]) => levels.map((l) => l.price.toNumber());

describe('purchase-price-step.rules — the card rule ported (ItemPriceRule)', () => {
  it('roundToStep: the nearest step, half away from zero, read to a millionth first', () => {
    expect(roundToStep(D('1627.97565'), D(1)).toNumber()).toBe(1628);
    expect(roundToStep(D('138.93925'), D('0.10')).toNumber()).toBe(138.9);
    expect(roundToStep(D('144.53925'), D('0.10')).toNumber()).toBe(144.5);
    expect(roundToStep(D('12.345'), D('0.01')).toNumber()).toBe(12.35);
    expect(roundToStep(D('12.325'), D('0.05')).toNumber()).toBe(12.35);
    expect(roundToStep(D('12.32'), D('0.05')).toNumber()).toBe(12.3);
    expect(roundToStep(D('102.5'), D(5)).toNumber()).toBe(105);
    expect(roundToStep(D('102.49'), D(5)).toNumber()).toBe(100);
    // a float-noise half (113.36249999…) reads as the half it is
    expect(roundToStep(D('113.362499999'), D('0.05')).toNumber()).toBe(113.35);
    // step 0 = no rounding
    expect(roundToStep(D('12.3456'), D(0)).toString()).toBe('12.3456');
  });

  it('cardTypeOf: By % / By Rs / anything else By User', () => {
    expect(cardTypeOf('By %')).toBe('BY_PERCENT');
    expect(cardTypeOf('By Rs')).toBe('BY_RUPEES');
    expect(cardTypeOf('By User')).toBe('BY_USER');
    expect(cardTypeOf('')).toBe('BY_USER');
    expect(cardTypeOf(null)).toBe('BY_USER');
  });

  it('cardKeptFigure: a stored % that reproduces the price on the old cost is kept as typed (P1 decision 20)', () => {
    const kept = cardKeptFigure({ type: 'BY_PERCENT', price: D(1565), oldCost: D('1361.18'), gstPerc: D(5), step: D(1), storedMarkup: D(15) });
    expect(kept).toEqual({ figure: D(15), typed: true });
  });

  it('cardKeptFigure: a stored % that does not reproduce it gives way to the % the price earns', () => {
    const kept = cardKeptFigure({ type: 'BY_PERCENT', price: D(1565), oldCost: D('1361.18'), gstPerc: D(5), step: D(1), storedMarkup: D(10) })!;
    expect(kept.typed).toBe(false);
    expect(kept.figure.toDecimalPlaces(4).toNumber()).toBe(14.9738);
  });

  it('cardKeptFigure: By Rs keeps price − cost, both WITH tax (the card 11-21 rule)', () => {
    expect(cardKeptFigure({ type: 'BY_RUPEES', price: D('134.40'), oldCost: D('113.43'), gstPerc: D(5), step: D('0.1'), storedMarkup: null })!.figure.toNumber()).toBe(20.97);
  });

  it('cardKeptFigure: no old cost, or no price → no figure (first cost)', () => {
    expect(cardKeptFigure({ type: 'BY_PERCENT', price: D(100), oldCost: null, gstPerc: D(5), step: D(1), storedMarkup: D(10) })).toBeNull();
    expect(cardKeptFigure({ type: 'BY_PERCENT', price: D(100), oldCost: D(0), gstPerc: D(5), step: D(1), storedMarkup: null })).toBeNull();
    expect(cardKeptFigure({ type: 'BY_PERCENT', price: D(0), oldCost: D(90), gstPerc: D(5), step: D(1), storedMarkup: null })).toBeNull();
  });

  it('cardPriceFor: By % on the cost w/o tax then GST; By Rs on the cost with tax', () => {
    expect(cardPriceFor('BY_PERCENT', D('1415.631'), D('1348.22'), D(15), D(1), D(5)).toNumber()).toBe(1628);
    expect(cardPriceFor('BY_RUPEES', D('117.96925'), D('112.351667'), D('20.97'), D('0.1'), D(5)).toNumber()).toBe(138.9);
  });
});

describe('purchase-price-step.rules — the new cost (B2, §4.3)', () => {
  it('E1: BOX landing 1,348.22 (stored per PCS 112.351667) → Cost Wot 1,348.22, Cost 1,415.631000', () => {
    const { cost, costWot } = billCost(D('112.351667'), D(12), D(5));
    expect(costWot.toString()).toBe('1348.22');
    expect(cost.toFixed(6)).toBe('1415.631000');
  });

  it('reliableDecimals: 6 − ⌈log10 factor⌉, at least 2; a factor up to 1 keeps 6', () => {
    expect(reliableDecimals(D(1))).toBe(6);
    expect(reliableDecimals(D('0.5'))).toBe(6);
    expect(reliableDecimals(D(10))).toBe(5);
    expect(reliableDecimals(D(12))).toBe(4);
    expect(reliableDecimals(D(24))).toBe(4);
    expect(reliableDecimals(D(1000))).toBe(3);
    expect(reliableDecimals(D(100000000))).toBe(2);
  });

  it('E1: PCS by the chain (÷ 12): Cost 117.969250, Cost Wot 112.351667', () => {
    const pcs = chainCost({ cost: D('1415.631'), costWot: D('1348.22') }, D(12), D(1));
    expect(pcs.cost.toFixed(6)).toBe('117.969250');
    expect(pcs.costWot.toFixed(6)).toBe('112.351667');
  });

  it('E2: Marie PCS landing 24.152542 at GST 18 % → Cost 28.50; BOX (× 24) 684.00', () => {
    const pcs = billCost(D('24.152542'), D(1), D(18));
    expect(pcs.cost.toFixed(2)).toBe('28.50');
    const box = chainCost(pcs, D(1), D(24));
    expect(box.cost.toFixed(2)).toBe('684.00');
    expect(box.costWot.toFixed(2)).toBe('579.66');
  });

  it('Q6: free goods lower the cost — 10 BOX + 1 free at 1,300.00 → 1,181.82 a BOX', () => {
    // the purchase calc's per-base landed figure: 13,000 ÷ (11 × 12)
    const perPcs = D(13000).dividedBy(132).toDecimalPlaces(6);
    expect(billCost(perPcs, D(12), D(0)).costWot.toDecimalPlaces(2).toNumber()).toBe(1181.82);
  });

  it('decision 13: two lines of one item / unit / key → one cost, Σ landed value ÷ Σ qty in', () => {
    const w = weightedLandedWot([
      { landedCostWot: D(10), baseQty: D(30) },
      { landedCostWot: D(12), baseQty: D(10) },
    ]);
    expect(w.toNumber()).toBe(10.5);
    expect(weightedLandedWot([]).toNumber()).toBe(0);
  });

  it('Q12: an MRP is matched per piece — HAMAM Box MRP 150 ↔ PCS MRP 15', () => {
    expect(chainKey(D(150), D(10), D(1)).toNumber()).toBe(15);
    expect(chainKey(D(15), D(1), D(10)).toNumber()).toBe(150);
    expect(keyPerBase(D(150), D(10))!.toNumber()).toBe(15);
    expect(keyPerBase(null, D(10))).toBeNull();
    expect(keyPerBase(D(0), D(10))).toBeNull();
  });
});

describe('purchase-price-step.rules — the prices (§4.4): the golden table', () => {
  it('E1 BOX (By %, R.Off 1): cost 1,361.18 → 1,415.63, WS 1,565 (15 %) → 1,628, RET 1,633 (20 %) → 1,699', () => {
    const out = proposeLevels({
      levels: lv([1565, 1633, 0, 0], [15, 20]),
      profitType: 'By %',
      roundOff: D(1),
      gstPerc: D(5),
      oldCost: D('1361.18'),
      newCost: D('1415.631'),
      newCostWot: D('1348.22'),
    });
    expect(prices(out)).toEqual([1628, 1699, 0, 0]);
    expect(out.map((l) => l.from)).toEqual(['RULE', 'RULE', 'KEPT', 'KEPT']);
    expect(out[0].keptPercent!.toNumber()).toBe(15);
  });

  it('E1 PCS (By Rs, R.Off 0.10): cost 113.43 → 117.97, WS 134.40 → 138.90, RET 140.00 → 144.50', () => {
    const out = proposeLevels({
      levels: lv([134.4, 140, 0, 0]),
      profitType: 'By Rs',
      roundOff: D('0.10'),
      gstPerc: D(5),
      oldCost: D('113.43'),
      newCost: D('117.96925'),
      newCostWot: D('112.351667'),
    });
    expect(prices(out)).toEqual([138.9, 144.5, 0, 0]);
    expect(out[0].keptPercent).toBeNull();
  });

  it('E2: a price typed on the bill wins for the bought unit (from BILL); the other level by its %', () => {
    const out = proposeLevels({
      levels: lv([31, 33, 0, 0]),
      profitType: 'By %',
      roundOff: D('0.50'),
      gstPerc: D(18),
      oldCost: D('27.20'),
      newCost: D('28.50'),
      newCostWot: D('24.152542'),
      billPrices: [D(32), null, null, null],
    });
    expect(out[0]).toMatchObject({ from: 'BILL' });
    expect(out[0].price.toNumber()).toBe(32);
    expect(out[1].from).toBe('RULE');
    expect(out[1].price.toNumber()).toBe(34.5);
  });

  it('E3: By User keeps the price (BRU WS 515.00), whatever the new cost', () => {
    const out = proposeLevels({
      levels: lv([515, 549, 0, 0]),
      profitType: 'By User',
      roundOff: D(1),
      gstPerc: D(18),
      oldCost: D('470.40'),
      newCost: D('489.22'),
      newCostWot: D('414.59'),
    });
    expect(prices(out)).toEqual([515, 549, 0, 0]);
    expect(out.every((l) => l.from === 'KEPT')).toBe(true);
    expect(out[0].why).toBe('By User keeps the price');
  });

  it('first cost: a line with no old cost keeps its prices (the profit is worked out, not the price)', () => {
    const out = proposeLevels({
      levels: lv([120, 0, 0, 0]),
      profitType: 'By %',
      roundOff: D(1),
      gstPerc: D(5),
      oldCost: null,
      newCost: D(100),
      newCostWot: D('95.238095'),
    });
    expect(out[0]).toMatchObject({ from: 'KEPT', why: 'first cost: the profit is worked out, not the price' });
  });

  it('a sold-at line keeps its fixed default level (a stock-bucket price), the others re-price', () => {
    const out = proposeLevels({
      levels: lv([110, 120, 0, 0]),
      profitType: 'By %',
      roundOff: D(1),
      gstPerc: D(0),
      oldCost: D(100),
      newCost: D(110),
      newCostWot: D(110),
      lockedLevel: 1,
    });
    expect(out[0]).toMatchObject({ from: 'KEPT', why: 'a stock-bucket price is fixed' });
    expect(out[1].price.toNumber()).toBe(132);
  });

  it('Q9: a new line takes the typed levels and the start-from line\'s rule for the rest', () => {
    const out = proposeNewLine({
      startFrom: { levels: lv([262, 275, 0, 0]), profitType: 'By User', roundOff: D(1), lineCost: D(240) },
      billPrices: [D(270), null, null, null],
      gstPerc: D(18),
      newCost: D('252.00'),
      newCostWot: D('213.559322'),
    });
    expect(prices(out)).toEqual([270, 275, 0, 0]);
    expect(out.map((l) => l.from)).toEqual(['BILL', 'KEPT', 'KEPT', 'KEPT']);
    const none = proposeNewLine({ startFrom: null, billPrices: [D(270), null, null, null], gstPerc: D(18), newCost: D(252), newCostWot: D('213.56') });
    expect(prices(none)).toEqual([270, 0, 0, 0]);
  });

  it('withoutTax: 1,415.631 at GST 5 % is 1,348.22', () => {
    expect(withoutTax(D('1415.631'), D(5)).toNumber()).toBe(1348.22);
  });
});

describe('purchase-price-step.rules — who writes which line (§4.2.4, Q10)', () => {
  it.each([
    [true, 'OWN', 'BRANCH', 'BRANCH', 'BRANCH', 'this branch'],
    [false, 'OWN', 'BRANCH', 'BRANCH', 'BRANCH', 'this branch'],
    [true, 'ALL', 'CHAIN', 'CHAIN', 'COMPANY', 'all branches'],
    [false, 'ALL', 'BRANCH', 'CHAIN', 'BRANCH', '→ this branch'],
    [true, 'NONE', 'CHAIN', null, 'COMPANY', 'all branches'],
    [false, 'NONE', 'BRANCH', null, 'BRANCH', 'this branch'],
  ] as const)('HQ %s, target %s → %s (row %s), later bills at %s, "%s"', (isHq, target, scope, rowScope, laterScope, label) => {
    expect(purchaseTargetScope(isHq, target)).toEqual({ scope, rowScope, laterScope, label });
  });
});

describe('purchase-price-step.rules — the mode and the results', () => {
  it.each([
    [{ allowPriceUpdate: false, priceUpdate: 'OFF' }, 'NONE'],
    [{ allowPriceUpdate: false, priceUpdate: 'UPDATE_PRICES' }, 'NONE'],
    [{ allowPriceUpdate: true, priceUpdate: 'UPDATE_PRICES' }, 'UPDATE_PRICES'],
    [{ allowPriceUpdate: true, priceUpdate: 'OPEN_CHANGE_SELLING' }, 'OPEN_CHANGE_SELLING'],
    [{ priceUpdate: 'COST_ONLY' }, 'COST_ONLY'],
    [{ priceUpdate: 'nonsense' }, 'NONE'],
    [null, 'NONE'],
    [{}, 'NONE'],
  ])('pi_policy %j → %s (an old snapshot maps, §4.1)', (policy, mode) => {
    expect(purchasePriceModeOf(policy)).toBe(mode);
  });

  it('strongestResult: one bill line, several keys → the strongest', () => {
    expect(strongestResult(['LATER_BILL', 'UPDATED'])).toBe('UPDATED');
    expect(strongestResult(['NONE', 'NO_LINE'])).toBe('NO_LINE');
    expect(strongestResult(['KEPT_NEWER', 'COST_ONLY'])).toBe('COST_ONLY');
    expect(strongestResult([])).toBe('NONE');
  });
});

describe('B5 — newestLater: the newest of several later bills (afterPurchase.laterBill)', () => {
  const at = (refno: string, docDate: string, time: string, piId = refno) =>
    ({ piId, accYear: '2026-2027', refno, docDate, docDatetime: new Date(`${docDate}T${time}+05:30`), branchId: 'B1', branchName: null,
       itemId: 'I', factor: D(1), mrp: null, salePrice: null, landedCostWot: D(1) }) as LaterLine;
  it('by doc date, then doc datetime, then id; nulls skipped; none → null', () => {
    expect(newestLater([at('PI-131', '2026-11-15', '10:00:00'), null, at('PI-140', '2026-11-20', '09:00:00')])!.refno).toBe('PI-140');
    expect(newestLater([at('PI-141', '2026-11-20', '11:00:00'), at('PI-140', '2026-11-20', '09:00:00')])!.refno).toBe('PI-141');
    expect(newestLater([at('A', '2026-11-20', '09:00:00', 'a1'), at('B', '2026-11-20', '09:00:00', 'b1')])!.refno).toBe('B');
    expect(newestLater([null, null])).toBeNull();
    expect(newestLater([])).toBeNull();
  });
});

describe('B5 — laterMatch (§4.5, C4, Q5)', () => {
  const line = (over: Partial<LaterLine>): LaterLine => ({
    piId: 'p', accYear: '2026-2027', refno: 'PI-00131', docDate: '2026-11-15', docDatetime: new Date('2026-11-15T10:00:00+05:30'), branchId: 'B2', branchName: 'Trichy',
    itemId: 'BRU', factor: D(1), mrp: D(540), salePrice: null, landedCostWot: D('398.31'), ...over,
  });

  it('an MRP item: the same MRP per base unit, any unit (Box 150 = PCS 15)', () => {
    const later = [line({ itemId: 'HAMAM', factor: D(10), mrp: D(150) })];
    expect(laterMatch(later, { itemId: 'HAMAM', trackMrp: true, trackSalePrice: false, mrp: D(15), salePrice: null, factor: D(1), branchId: null })).not.toBeNull();
    expect(laterMatch(later, { itemId: 'HAMAM', trackMrp: true, trackSalePrice: false, mrp: D(16), salePrice: null, factor: D(1), branchId: null })).toBeNull();
  });

  it('a plain item: any later line of the item, any unit', () => {
    const later = [line({ itemId: 'OIL', factor: D(12), mrp: D(1800) })];
    expect(laterMatch(later, { itemId: 'OIL', trackMrp: false, trackSalePrice: false, mrp: null, salePrice: null, factor: D(1), branchId: null })).not.toBeNull();
    expect(laterMatch(later, { itemId: 'SOAP', trackMrp: false, trackSalePrice: false, mrp: null, salePrice: null, factor: D(1), branchId: null })).toBeNull();
  });

  it('C4: an own line counts only its branch\'s later bills; All branches the whole company', () => {
    const later = [line({ branchId: 'B2' })];
    const probe = { itemId: 'BRU', trackMrp: true, trackSalePrice: false, mrp: D(540), salePrice: null, factor: D(1) };
    expect(laterMatch(later, { ...probe, branchId: 'B1' })).toBeNull();
    expect(laterMatch(later, { ...probe, branchId: 'b2' })).not.toBeNull();
    expect(laterMatch(later, { ...probe, branchId: null })).not.toBeNull();
  });

  it('the latest first: the first match of a list ordered latest first', () => {
    const later = [line({ refno: 'PI-00140' }), line({ refno: 'PI-00131' })];
    expect(laterMatch(later, { itemId: 'BRU', trackMrp: true, trackSalePrice: false, mrp: D(540), salePrice: null, factor: D(1), branchId: null })!.refno).toBe('PI-00140');
  });
});
