import { Prisma } from '@prisma/client';
import { judgeLines, type LineFact, type RateRef } from './purchase-invoice-checks';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const fact = (over: Partial<LineFact> = {}): LineFact => ({
  index: 0, lineNo: 1, itemId: 'item-1', itemName: 'Surf', factor: D(1), billed: D(10), taxable: D(1000), costInclUnit: D(118),
  pieces: D(10), srcType: null, srcItemId: null, serials: [], mrps: [], sellA: null,
  pendingShort: D(0), shortValue: D(0), gstOnShort: D(0), priceUpdateResult: null, ...over,
});
const none = { tracked: new Set<string>(), onHand: new Set<string>() };

describe('purchase invoice checks (S4 / S7)', () => {
  it('rate over the PO beyond tolerance: WARN that needs OVERRIDE, Check shows the % and the PO', () => {
    const refs = new Map<number, RateRef>([[1, { basis: 'PO', refno: 'PO/1', refBase: D(96.9) }]]);
    const { issues, checks } = judgeLines([fact()], refs, 2, none, new Map());
    expect(issues.map((i) => [i.code, i.level, i.needsRight])).toEqual([['PUR_RATE_ABOVE_PO', 'WARN', 'OVERRIDE']]);
    expect(checks.get(1)!.rate).toMatchObject({ basis: 'PO', refno: 'PO/1', billRate: '100.00', diffPct: '3.20', over: true });
  });

  it('within tolerance: no entry, Check still carries the comparison', () => {
    const refs = new Map<number, RateRef>([[1, { basis: 'LAST', refno: 'PUR/9', refBase: D(99) }]]);
    const { issues, checks } = judgeLines([fact()], refs, 2, none, new Map());
    expect(issues).toEqual([]);
    expect(checks.get(1)!.rate!.over).toBe(false);
  });

  it('over the last purchase: information only (no right, no hold)', () => {
    const refs = new Map<number, RateRef>([[1, { basis: 'LAST', refno: 'PUR/9', refBase: D(90) }]]);
    const { issues } = judgeLines([fact()], refs, 2, none, new Map());
    expect(issues.map((i) => [i.code, i.needsRight])).toEqual([['PUR_RATE_ABOVE_LAST', null]]);
  });

  it('short qty parked: WARN with value and GST', () => {
    const { issues } = judgeLines([fact({ pendingShort: D(2), shortValue: D(900), gstOnShort: D(45) })], new Map(), 2, none, new Map());
    expect(issues[0]).toMatchObject({ code: 'PUR_SHORT_QTY', level: 'WARN', lineNo: 1 });
    expect(issues[0].message).toContain('900.00 + GST 45.00');
  });

  it('serial-tracked line: count must equal pieces; duplicates (case-folded, or on hand) refuse', () => {
    const tracked = { tracked: new Set(['item-1']), onHand: new Set(['item-1|SN9']) };
    const { issues, checks } = judgeLines([fact({ pieces: D(3), serials: ['sn1', 'SN1', 'sn9'] })], new Map(), 2, tracked, new Map());
    expect(issues.map((i) => i.code).sort()).toEqual(['PUR_SERIAL_DUPLICATE', 'PUR_SERIAL_DUPLICATE']);
    expect(checks.get(1)!.serials).toEqual({ have: 3, need: '3' });
    const short = judgeLines([fact({ pieces: D(5), serials: ['a', 'b', 'c', 'd'] })], new Map(), 2, tracked, new Map());
    expect(short.issues).toEqual([expect.objectContaining({ code: 'PUR_SERIAL_COUNT', level: 'REFUSE' })]);
  });

  it('a GRN line is not serial-counted here (its serials came on the GRN)', () => {
    const { issues } = judgeLines([fact({ srcType: 'GRN', pieces: D(3) })], new Map(), 2, { tracked: new Set(['item-1']), onHand: new Set() }, new Map());
    expect(issues).toEqual([]);
  });

  it('NEW MRP when the line MRP is not among the MRPs on hand; PRICE KEPT from the stored result', () => {
    const { checks } = judgeLines([fact({ mrps: [D(16)], priceUpdateResult: 'KEPT_NEWER' })], new Map(), 2, none, new Map([['item-1', [D(14)]]]));
    expect(checks.get(1)!.newMrp).toEqual({ mrp: '16.00', stockMrps: ['14.00'] });
    expect(checks.get(1)!.priceKept).toBe(true);
    const same = judgeLines([fact({ mrps: [D(14)] })], new Map(), 2, none, new Map([['item-1', [D(14)]]]));
    expect(same.checks.get(1)!.newMrp).toBeNull();
  });

  it('Sell A below cost / above MRP warn', () => {
    const { issues } = judgeLines([fact({ sellA: D(200), mrps: [D(150)], costInclUnit: D(118) }), fact({ index: 1, lineNo: 2, sellA: D(100) })], new Map(), 2, none, new Map());
    expect(issues.map((i) => [i.lineNo, i.code])).toEqual([[1, 'PUR_PRICE_ABOVE_MRP'], [2, 'PUR_PRICE_BELOW_COST']]);
  });
});
