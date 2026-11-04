import { Prisma } from '@prisma/client';
import { returnRowFigures, returnWeightPerUnit, type ReturnStockRow } from './purchase-return';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const IT = 'item-1', GD = 'gd-1', LOT = 'lot-1';
const row = (o: Partial<ReturnStockRow>): ReturnStockRow => ({ item_id: IT, godown_id: GD, bucket: 'SALEABLE', lot_id: LOT, on_hand: D(0), rate: null, ...o });

describe('Purchase return — weight per line unit (plan 2026-11-04 decision 8)', () => {
  it('the source line weight ÷ its basis qty', () => {
    expect(returnWeightPerUnit(D('12.500'), D(10), D(2))!.toString()).toBe('1.25');
  });
  it('no line weight (null / 0) or no basis qty → the unit weight', () => {
    expect(returnWeightPerUnit(null, D(10), D('0.75'))!.toString()).toBe('0.75');
    expect(returnWeightPerUnit(D(0), D(10), D('0.75'))!.toString()).toBe('0.75');
    expect(returnWeightPerUnit(D(5), D(0), D('0.75'))!.toString()).toBe('0.75');
  });
  it('neither stated → null', () => {
    expect(returnWeightPerUnit(null, D(10), D(0))).toBeNull();
    expect(returnWeightPerUnit(null, D(10), null)).toBeNull();
  });
});

describe('Purchase return — Stock / Pur. cost / Return cost (Q2 = a)', () => {
  const stock = [
    row({ on_hand: D(120), rate: D('4.125') }),                          // the row's lot, base units
    row({ lot_id: 'lot-2', on_hand: D(60), rate: D(5) }),                // another lot, same godown + bucket
    row({ lot_id: 'lot-3', bucket: 'DAMAGED', on_hand: D(12), rate: D(5) }),
    row({ lot_id: 'lot-4', godown_id: 'gd-2', on_hand: D(999), rate: D(5) }),
    row({ item_id: 'item-2', on_hand: D(999), rate: D(5) }),
  ];
  const base = { itemId: IT, godownId: GD, bucket: 'SALEABLE', lotId: LOT, factor: D(12), qty: D(2), freeQty: D(1), total: D('100.00') };

  it('godown stock = the item in that godown + bucket; lot stock = its own row; both in the line unit', () => {
    const f = returnRowFigures(stock, base);
    expect(f.godownStock).toBe('15');    // (120 + 60) ÷ 12
    expect(f.lotStock).toBe('10');       // 120 ÷ 12
  });
  it('live cost = the lot\'s avg cost rate × the factor, value for qty + free', () => {
    const f = returnRowFigures(stock, base);
    expect(f.costRate).toBe('49.500000');   // 4.125 × 12
    expect(f.costValue).toBe('148.50');     // 49.5 × 3
  });
  it('return cost = the row total incl. GST ÷ (qty + free), exact to 2 places', () => {
    expect(returnRowFigures(stock, base).returnRate).toBe('33.33');
    expect(returnRowFigures(stock, { ...base, qty: D(0), freeQty: D(0) }).returnRate).toBeNull();
  });
  it('posted: the cost the post took out at, ÷ (qty + free)', () => {
    const f = returnRowFigures(stock, { ...base, postedCost: D('150.00') });
    expect(f.costValue).toBe('150.00');
    expect(f.costRate).toBe('50.000000');
  });
  it('a lot with no balance row there holds 0; no lot / no godown → null figures', () => {
    const none = returnRowFigures(stock, { ...base, lotId: 'lot-x' });
    expect(none.lotStock).toBe('0');
    expect(none.costRate).toBeNull();
    expect(none.costValue).toBeNull();
    const nowhere = returnRowFigures(stock, { ...base, godownId: null, lotId: null });
    expect(nowhere.godownStock).toBeNull();
    expect(nowhere.lotStock).toBeNull();
  });
  it('a zero factor is read as 1', () => {
    const f = returnRowFigures(stock, { ...base, factor: D(0) });
    expect(f.lotStock).toBe('120');
    expect(f.costRate).toBe('4.125000');
  });
});
