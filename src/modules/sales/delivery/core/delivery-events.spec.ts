import { Prisma } from '@prisma/client';
import { deliveryEventQty, lineFigures, type DeliveryEventQty } from './delivery-events';

/**
 * The explainer matrix (sales/delivery_stock_explained_v1.png, plan §5) as a
 * ledger model: one holding (ZT rice, one godown, one lot). Owned moves only
 * by stock vouchers (bill, sale return, challan …); BND is Σ (billed − Σ settle)
 * over the eligible bill lines; Physical = Owned + BND after every row.
 */
const D = (v: number) => new Prisma.Decimal(v);
type Line = { billed: Prisma.Decimal; events: DeliveryEventQty[]; eligible: boolean };

class Holding {
  owned = D(0);
  lines: Line[] = [];
  bnd(): Prisma.Decimal {
    return this.lines
      .filter((l) => l.eligible)
      .reduce((a, l) => a.plus(lineFigures(l.billed, l.events).pending), D(0));
  }
  physical(): Prisma.Decimal {
    return this.owned.plus(this.bnd());
  }
  bill(qty: number, mode: 'INSTANT' | 'PICKUP' | 'DISPATCH'): Line {
    this.owned = this.owned.minus(qty); // the bill moves owned stock as today (D1)
    const l: Line = { billed: D(qty), events: [], eligible: mode !== 'INSTANT' };
    this.lines.push(l);
    return l;
  }
  event(l: Line, kind: Parameters<typeof deliveryEventQty>[0], q: number): DeliveryEventQty {
    const e = deliveryEventQty(kind, D(q), D(q));
    l.events.push(e);
    return e;
  }
  expect(owned: number, bnd: number, physical: number): void {
    expect([this.owned.toNumber(), this.bnd().toNumber(), this.physical().toNumber()]).toEqual([owned, bnd, physical]);
    expect(this.physical().equals(this.owned.plus(this.bnd()))).toBe(true);
  }
}

describe('deliveryEventQty — ck_sde_signs', () => {
  it.each([
    ['GIVEN', 1, 1],
    ['CLEANUP', 1, 1],
    ['CANCEL', -1, -1],
    ['GOODS_BACK', -1, -1],
    ['RETURN', 1, 0],
    ['RETURN_CANCEL', -1, 0],
  ] as const)('%s → settle %i·q, out %i·q', (kind, s, o) => {
    const e = deliveryEventQty(kind, D(5), D(50));
    expect([e.settleQty.toNumber(), e.outQty.toNumber()]).toEqual([5 * s, 5 * o]);
    expect([e.settleBaseQty.toNumber(), e.outBaseQty.toNumber()]).toEqual([50 * s, 50 * o]);
  });

  it('refuses a non-positive magnitude (the DB CHECK would)', () => {
    expect(() => deliveryEventQty('GIVEN', D(0), D(0))).toThrow();
    expect(() => deliveryEventQty('CANCEL', D(-1), D(-1))).toThrow();
  });
});

describe('the explainer story (plan §11.1 A) — Physical = Owned + BND at every step', () => {
  const h = new Holding();

  it('0–1 · opening 80, inward 60', () => {
    h.owned = D(80);
    h.expect(80, 0, 80);
    h.owned = h.owned.plus(60); // row 1: purchase / GRN
    h.expect(140, 0, 140);
  });

  let ws40: Line;
  let ws4: Line;
  let ws16: Line;
  it('2 · Instant bill 20 (row 3): owned and physical drop, no BND', () => {
    h.bill(20, 'INSTANT');
    h.expect(120, 0, 120);
  });
  it('4–5 · Pickup 16 and Dispatch 40 (row 4): owned drops, BND rises, physical unchanged', () => {
    ws16 = h.bill(16, 'PICKUP');
    ws40 = h.bill(40, 'DISPATCH');
    h.expect(64, 56, 120);
  });
  it('6 · a note gives 20 of the 40 (row 5): BND and physical drop, owned unchanged', () => {
    h.event(ws40, 'GIVEN', 20);
    h.expect(64, 36, 100);
  });
  it('7 · Pickup 4 → the plan figures Owned 60, BND 40, Physical 100', () => {
    ws4 = h.bill(4, 'PICKUP');
    h.expect(60, 40, 100);
  });
  it('8 · the last 20 given → 60 / 20 / 80, that bill fully given', () => {
    h.event(ws40, 'GIVEN', 20);
    h.expect(60, 20, 80);
    expect(lineFigures(ws40.billed, ws40.events).pending.toNumber()).toBe(0);
  });
  it('9 · sale return of the 4 never taken (row 8): owned +4, BND −4, physical unchanged → 64 / 16 / 80', () => {
    h.owned = h.owned.plus(4); // the return's stock IN, as today
    h.event(ws4, 'RETURN', 4);
    h.expect(64, 16, 80);
    expect(lineFigures(ws4.billed, ws4.events).given.toNumber()).toBe(0); // RETURNED, nothing ever left
  });
  it('10 · partial pickup 14 of 16 → 64 / 2 / 66', () => {
    h.event(ws16, 'GIVEN', 14);
    h.expect(64, 2, 66);
  });
  it('row 7 · goods back 3 of the 14: BND +3, physical +3', () => {
    h.event(ws16, 'GOODS_BACK', 3);
    h.expect(64, 5, 69);
  });
  it('row 6 · the note cancelled for what is still out (11): back where it was before it', () => {
    h.event(ws16, 'CANCEL', 11);
    h.expect(64, 16, 80);
  });
  it('row 9 · a sale return of goods already taken: owned and physical +, no event', () => {
    h.owned = h.owned.plus(5);
    h.expect(69, 16, 85);
  });
  it('row 14 · a bill cancelled with nothing given: owned back, it drops out of BND', () => {
    h.owned = h.owned.plus(16);
    ws16.eligible = false; // a cancelled bill is not an eligible line
    h.expect(85, 0, 85);
  });
  it('row 16 · go-live cleanup settles an old pending line', () => {
    const old = h.bill(7, 'PICKUP');
    h.expect(78, 7, 85);
    h.event(old, 'CLEANUP', 7);
    h.expect(78, 0, 78);
  });
  it('decision 46 · an over-given line shows a negative pending', () => {
    const l = h.bill(5, 'PICKUP');
    h.event(l, 'GIVEN', 5);
    h.event(l, 'GIVEN', 2); // arrived by sync
    expect(lineFigures(l.billed, l.events).pending.toNumber()).toBe(-2);
  });
});
