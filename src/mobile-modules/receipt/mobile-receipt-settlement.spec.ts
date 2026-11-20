import { Prisma } from '@prisma/client';
import { fillOldestFirst, moneyForBills, type OpenBillRoom } from './mobile-receipt-settlement';
import { settlementOf } from './mobile-receipt.service';

const D = (v: string | number) => new Prisma.Decimal(v);
const bill = (id: string, pending: string, year = '2026-2027'): OpenBillRoom => ({
  billId: id,
  billAccYear: year,
  pending: D(pending),
});
const plain = (r: ReturnType<typeof fillOldestFirst>) => ({
  allocations: r.allocations.map((a) => [a.billId, a.amount.toFixed(2)]),
  onAccount: r.onAccount.toFixed(2),
});

describe('fillOldestFirst', () => {
  it('fills in the order given, each bill up to what it owes, the rest on account', () => {
    const r = fillOldestFirst(
      [bill('a', '300.00'), bill('b', '500.00'), bill('c', '200.00')],
      D('650.00'),
    );
    expect(plain(r)).toEqual({
      allocations: [
        ['a', '300.00'],
        ['b', '350.00'],
      ],
      onAccount: '0.00',
    });
  });

  it('more money than the bills: every bill closed, the remainder on account', () => {
    const r = fillOldestFirst([bill('a', '300.00'), bill('b', '0.50')], D('1000.00'));
    expect(plain(r)).toEqual({
      allocations: [
        ['a', '300.00'],
        ['b', '0.50'],
      ],
      onAccount: '699.50',
    });
  });

  it('no open bill: all of it on account; a bill owing nothing or named twice is passed over', () => {
    expect(plain(fillOldestFirst([], D('250.00')))).toEqual({
      allocations: [],
      onAccount: '250.00',
    });
    const r = fillOldestFirst(
      [bill('a', '0.00'), bill('b', '100.00'), bill('b', '100.00')],
      D('150'),
    );
    expect(plain(r)).toEqual({ allocations: [['b', '100.00']], onAccount: '50.00' });
  });

  it('the same id in two years is two bills', () => {
    const r = fillOldestFirst(
      [bill('a', '100', '2025-2026'), bill('a', '100', '2026-2027')],
      D('150'),
    );
    expect(r.allocations.map((a) => [a.billAccYear, a.amount.toFixed(2)])).toEqual([
      ['2025-2026', '100.00'],
      ['2026-2027', '50.00'],
    ]);
  });

  it('stays in Decimal: paise never drift', () => {
    const bills = Array.from({ length: 30 }, (_, i) => bill(`b${i}`, '0.10'));
    const r = fillOldestFirst(bills, D('2.95'));
    expect(r.allocations).toHaveLength(30);
    expect(r.allocations[29].amount.toString()).toBe('0.05');
    expect(r.onAccount.isZero()).toBe(true);
    expect(r.allocations.reduce((s, a) => s.plus(a.amount), D(0)).toString()).toBe('2.95');
  });
});

describe('moneyForBills', () => {
  it('is the instruments less the CR lines the save seeded (the surcharge inside tdAmount)', () => {
    expect(
      moneyForBills(
        [{ tdAmount: 202 }, { tdAmount: 500 }],
        [
          { drCr: 'CR', amount: 2 },
          { drCr: 'DR', amount: 3.5 }, // BANK_CHARGES: an instrument split, out of the identity
        ],
      ).toFixed(2),
    ).toBe('700.00');
  });
});

describe('settlementOf', () => {
  const row = (over: Record<string, unknown>) => ({
    billId: 'a',
    billAccYear: '2026-2027',
    docRefno: 'bil00001',
    pendingAmount: 80,
    amount: 100,
    adjType: 'ALLOCATION',
    drCr: 'CR',
    againstBillId: null,
    isReversed: false,
    reversalOfId: null,
    ...over,
  });
  it('sums a bill’s live rows, skips mirrors and retracted rows, adds the advance bills', () => {
    const out = settlementOf({
      allocations: [
        row({ amount: 60 }),
        row({ amount: 40 }), // the PDC part of the same bill
        row({ billId: 'b', docRefno: 'bil00002', pendingAmount: 0, amount: 20 }),
        row({ billId: 'c', amount: 5, againstBillId: 'x' }), // not a plain row: ignored here
        row({ billId: 'd', amount: 9, isReversed: true }),
        row({ billId: 'e', amount: -9, reversalOfId: 'r' }),
      ],
      creditsApplied: [],
      advanceBills: [{ billAmount: 12.5 }, { billAmount: 7.5 }],
    } as never);
    expect(out.allocations).toEqual([
      {
        billId: 'a',
        billAccYear: '2026-2027',
        docRefno: 'bil00001',
        amount: '100.00',
        discount: '0.00',
        roundoff: '0.00',
        pendingAmount: '80.00',
      },
      {
        billId: 'b',
        billAccYear: '2026-2027',
        docRefno: 'bil00002',
        amount: '20.00',
        discount: '0.00',
        roundoff: '0.00',
        pendingAmount: '0.00',
      },
    ]);
    expect(out.onAccount).toBe('20.00');
    expect(out.creditsApplied).toEqual([]);
    expect(out.pdcVouchers).toEqual([]);
  });

  it('splits the discount and the round-off out; a credit pair adds to the bill and names the credit', () => {
    const out = settlementOf({
      allocations: [
        row({ amount: 50 }),
        row({ amount: 2, adjType: 'DISCOUNT' }),
        row({ amount: 0.4, adjType: 'ROUND_OFF' }),
        row({ amount: 7, adjType: 'WRITEOFF' }), // a desktop write-off is not money
      ],
      creditsApplied: [
        // the bill side (CR on the receivable) and the mirror (DR on the credit)
        row({ amount: 30, adjType: 'ADVANCE_ADJUST', againstBillId: 'adv' }),
        row({
          billId: 'adv',
          docRefno: 'rct00009',
          pendingAmount: 70,
          amount: 30,
          adjType: 'ADVANCE_ADJUST',
          drCr: 'DR',
          againstBillId: 'a',
        }),
        row({ billId: 'adv', amount: 5, drCr: 'DR', againstBillId: 'a', isReversed: true }),
      ],
      pdcVouchers: [
        { voucherId: 'v2', voucherRefno: 'rct00010', voucherDate: '2026-11-30', docAmount: 1500 },
      ],
      advanceBills: [],
    } as never);
    expect(out.allocations).toEqual([
      expect.objectContaining({ billId: 'a', amount: '80.00', discount: '2.00', roundoff: '0.40' }),
    ]);
    expect(out.creditsApplied).toEqual([
      {
        billId: 'adv',
        billAccYear: '2026-2027',
        docRefno: 'rct00009',
        amount: '30.00',
        pendingAmount: '70.00',
      },
    ]);
    expect(out.pdcVouchers).toEqual([
      { voucherId: 'v2', voucherRefno: 'rct00010', chequeDate: '2026-11-30', amount: '1500.00' },
    ]);
    expect(out.figures.bills.get('a|2026-2027')?.amount.toFixed(2)).toBe('80.00');
    expect(out.figures.credits.get('adv|2026-2027')?.toFixed(2)).toBe('30.00');
  });
});
