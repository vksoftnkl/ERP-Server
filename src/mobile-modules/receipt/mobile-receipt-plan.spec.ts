import { Prisma } from '@prisma/client';
import {
  adjustedAgainstPlan,
  assertPhoneLimits,
  billKeyOf,
  reconcilePhonePlan,
  type BillNow,
  type CreditNow,
  type PlanCredit,
  type PlanInput,
  type PlanLine,
} from './mobile-receipt-plan';

const D = (v: string | number) => new Prisma.Decimal(v);
const YEAR = '2026-2027';
const DOC_DATE = new Date('2026-11-01T00:00:00.000Z');

const line = (billId: string, amount: number, discount = 0, roundoff = 0): PlanLine => ({
  billId,
  billAccYear: YEAR,
  amount: D(amount),
  discount: D(discount),
  roundoff: D(roundoff),
});
const credit = (billId: string, amount: number): PlanCredit => ({
  billId,
  billAccYear: YEAR,
  amount: D(amount),
});
const bill = (billId: string, pending: number, live = pending > 0): BillNow => ({
  billId,
  billAccYear: YEAR,
  docRefno: `bil-${billId}`,
  docDate: DOC_DATE,
  pending: D(pending),
  live,
});
const held = (billId: string, amount: number, live = amount > 0): CreditNow => ({
  billId,
  billAccYear: YEAR,
  docRefno: `adv-${billId}`,
  held: D(amount),
  live,
});
const byKey = <T extends { billId: string; billAccYear: string }>(rows: T[]) =>
  new Map(rows.map((row) => [billKeyOf(row), row]));

/** The plan's figures as text, for a readable expectation. */
function run(input: Partial<PlanInput> & Pick<PlanInput, 'lines' | 'money'>) {
  const out = reconcilePhonePlan({
    credits: [],
    billsNow: new Map(),
    creditsNow: new Map(),
    openOrder: [],
    ...input,
  });
  return {
    allocations: out.allocations.map((l) => [
      l.billId,
      l.amount.toFixed(2),
      l.discount.toFixed(2),
      l.roundoff.toFixed(2),
    ]),
    credits: out.creditsApplied.map((c) => [c.billId, c.amount.toFixed(2)]),
    onAccount: out.onAccount.toFixed(2),
  };
}

describe('reconcilePhonePlan (D1)', () => {
  it('nothing moved: the phone plan posts as sent, its own on-account kept', () => {
    const bills = [bill('a', 300), bill('b', 500)];
    expect(
      run({
        lines: [line('a', 290, 6, 0.4), line('b', 200)],
        billsNow: byKey(bills),
        openOrder: bills,
        money: D(600),
      }),
    ).toEqual({
      allocations: [
        ['a', '290.00', '6.00', '0.40'],
        ['b', '200.00', '0.00', '0.00'],
      ],
      credits: [],
      onAccount: '110.00',
    });
  });

  it('a bill settled since Sync frees its line (discount dropped); the money goes to the next open bill', () => {
    const bills = [bill('a', 0, false), bill('b', 500), bill('c', 80)];
    expect(
      run({
        lines: [line('a', 294, 6), line('b', 200)],
        billsNow: byKey(bills),
        openOrder: [bills[1], bills[2]],
        money: D(494),
      }),
    ).toEqual({
      // b had room for 300 more: the freed 294 goes there first, then nothing is left.
      allocations: [['b', '494.00', '0.00', '0.00']],
      credits: [],
      onAccount: '0.00',
    });
  });

  it('a bill that owes less now is capped after its discount and round-off; the excess spills over, then on account', () => {
    const bills = [bill('a', 100), bill('c', 30)];
    expect(
      run({
        lines: [line('a', 290, 6, 0.4)],
        billsNow: byKey(bills),
        openOrder: bills,
        money: D(290),
      }),
    ).toEqual({
      allocations: [
        ['a', '93.60', '6.00', '0.40'],
        ['c', '30.00', '0.00', '0.00'],
      ],
      credits: [],
      onAccount: '166.40',
    });
  });

  it('a bill that now owes less than its discount keeps only what it owes', () => {
    const bills = [bill('a', 4)];
    expect(
      run({
        lines: [line('a', 290, 6, 0.4)],
        billsNow: byKey(bills),
        openOrder: bills,
        money: D(290),
      }),
    ).toEqual({
      allocations: [['a', '0.00', '3.60', '0.40']],
      credits: [],
      onAccount: '290.00',
    });
  });

  it('a credit is capped at what it holds; the bills it was to pay give that much back, last line first', () => {
    const bills = [bill('a', 300), bill('b', 200)];
    expect(
      run({
        lines: [line('a', 300), line('b', 200)],
        credits: [credit('adv', 150)],
        billsNow: byKey(bills),
        creditsNow: byKey([held('adv', 100)]),
        openOrder: bills,
        money: D(350),
      }),
    ).toEqual({
      allocations: [
        ['a', '300.00', '0.00', '0.00'],
        ['b', '150.00', '0.00', '0.00'],
      ],
      credits: [['adv', '100.00']],
      onAccount: '0.00',
    });
  });

  it('a credit spent elsewhere applies nothing; freed money still fills before on account', () => {
    const bills = [bill('a', 0, false), bill('b', 118)];
    expect(
      run({
        lines: [line('a', 68), line('b', 118)],
        credits: [credit('adv', 150)],
        billsNow: byKey(bills),
        creditsNow: byKey([held('adv', 100)]),
        openOrder: [bills[1]],
        money: D(36),
      }),
    ).toEqual({
      // the live run on :3011 (rct00129): b 118 = credit 100 + cash 18, 18 on account
      allocations: [['b', '118.00', '0.00', '0.00']],
      credits: [['adv', '100.00']],
      onAccount: '18.00',
    });
    expect(
      run({
        lines: [line('b', 118)],
        credits: [credit('adv', 100)],
        billsNow: byKey(bills),
        creditsNow: byKey([held('adv', 0, false)]),
        openOrder: [bills[1]],
        money: D(18),
      }),
    ).toEqual({
      allocations: [['b', '18.00', '0.00', '0.00']],
      credits: [],
      onAccount: '0.00',
    });
  });

  it('credits never go on account: beyond what the bills take they are cut, the last first', () => {
    const bills = [bill('a', 0, false)];
    expect(
      run({
        lines: [line('a', 150)],
        credits: [credit('adv', 100), credit('ret', 50)],
        billsNow: byKey(bills),
        creditsNow: byKey([held('adv', 100), held('ret', 50)]),
        money: D(0),
      }),
    ).toEqual({ allocations: [], credits: [], onAccount: '0.00' });
  });

  it('fillAll (credits but no allocations key): money and credits fill the open bills oldest first', () => {
    const bills = [bill('a', 100), bill('b', 500)];
    expect(
      run({
        lines: [],
        credits: [credit('adv', 120)],
        creditsNow: byKey([held('adv', 120)]),
        openOrder: bills,
        money: D(50),
        fillAll: true,
      }),
    ).toEqual({
      allocations: [
        ['a', '100.00', '0.00', '0.00'],
        ['b', '70.00', '0.00', '0.00'],
      ],
      credits: [['adv', '120.00']],
      onAccount: '0.00',
    });
  });

  it('allocations [] with money: everything on account (an advance)', () => {
    expect(run({ lines: [], openOrder: [bill('a', 100)], money: D(250) })).toEqual({
      allocations: [],
      credits: [],
      onAccount: '250.00',
    });
  });

  it('more allocated than collected (a phone fault): a negative on-account the engine refuses', () => {
    const bills = [bill('a', 500)];
    expect(
      run({ lines: [line('a', 300)], billsNow: byKey(bills), openOrder: bills, money: D(200) })
        .onAccount,
    ).toBe('-100.00');
  });
});

describe('assertPhoneLimits (D4, D5)', () => {
  const SLABS = [
    { days: 7, perc: 2 },
    { days: 15, perc: 1 },
  ];
  const on = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it('D5: a round-off above 0.99 is 422 MOBILE_RECEIPT_ROUNDOFF_TOO_BIG', () => {
    const bills = byKey([bill('a', 100)]);
    expect(() =>
      assertPhoneLimits([line('a', 99, 0, 0.99)], bills, on('2026-11-02'), []),
    ).not.toThrow();
    expect(() => assertPhoneLimits([line('a', 98, 0, 1)], bills, on('2026-11-02'), [])).toThrow(
      expect.objectContaining({
        status: 422,
        response: expect.objectContaining({
          errors: [
            expect.objectContaining({
              field: 'allocations.0.roundoff',
              code: 'MOBILE_RECEIPT_ROUNDOFF_TOO_BIG',
            }),
          ],
        }),
      }),
    );
  });

  it('D4: up to the slab for the receipt date on what is pending; one paisa more is 422', () => {
    const bills = byKey([bill('a', 1180)]);
    // 2026-11-05 is 4 days after the bill: the 2% slab, 23.60.
    expect(() =>
      assertPhoneLimits([line('a', 1156.4, 23.6)], bills, on('2026-11-05'), SLABS),
    ).not.toThrow();
    // the phone's floor(pending × perc / 100) is never above it
    expect(() =>
      assertPhoneLimits([line('a', 500, 23.6)], bills, on('2026-11-05'), SLABS),
    ).not.toThrow();
    expect(() =>
      assertPhoneLimits([line('a', 1156.39, 23.61)], bills, on('2026-11-05'), SLABS),
    ).toThrow(
      expect.objectContaining({
        status: 422,
        response: expect.objectContaining({
          errors: [
            expect.objectContaining({
              field: 'allocations.0.discount',
              code: 'MOBILE_RECEIPT_DISCOUNT_ABOVE_PPD',
            }),
          ],
        }),
      }),
    );
    // 2026-11-10 is 9 days: only the 1% slab, 11.80
    expect(() =>
      assertPhoneLimits([line('a', 1156.4, 23.6)], bills, on('2026-11-10'), SLABS),
    ).toThrow();
    expect(() =>
      assertPhoneLimits([line('a', 1168.2, 11.8)], bills, on('2026-11-10'), SLABS),
    ).not.toThrow();
    // no slabs: no discount at all
    expect(() => assertPhoneLimits([line('a', 1179, 1)], bills, on('2026-11-05'), [])).toThrow();
  });

  it('D4 on a bill paid down since Sync: measured on what the line settles, not refused', () => {
    // The phone saw 1180 and settles it all with 2% off; the office has since taken 500.
    const bills = byKey([bill('a', 680)]);
    expect(() =>
      assertPhoneLimits([line('a', 1156.4, 23.6)], bills, on('2026-11-05'), SLABS),
    ).not.toThrow();
  });

  it('a line on a bill no longer open is not checked for D4 (D1 drops it), D5 still applies', () => {
    const bills = byKey([bill('a', 0, false)]);
    expect(() =>
      assertPhoneLimits([line('a', 100, 50)], bills, on('2026-11-05'), SLABS),
    ).not.toThrow();
    expect(() =>
      assertPhoneLimits([line('a', 100, 0, 5)], bills, on('2026-11-05'), SLABS),
    ).toThrow();
  });
});

describe('adjustedAgainstPlan', () => {
  const figure = (amount: number, discount = 0, roundoff = 0) => ({
    amount: D(amount),
    discount: D(discount),
    roundoff: D(roundoff),
  });

  it('reports a bill that got nothing, one that got less, and a credit that applied less', () => {
    const out = adjustedAgainstPlan(
      {
        lines: [line('a', 68), line('b', 118), line('c', 50, 2), line('d', 40)],
        credits: [credit('adv', 150), credit('ret', 20)],
      },
      {
        bills: new Map([
          [`b|${YEAR}`, figure(118)],
          [`c|${YEAR}`, figure(50, 1)],
          [`d|${YEAR}`, figure(30)],
        ]),
        credits: new Map([
          [`adv|${YEAR}`, D(100)],
          [`ret|${YEAR}`, D(20)],
        ]),
      },
      (key) => `no-${key.split('|')[0]}`,
    );
    expect(out).toEqual([
      {
        billId: 'a',
        billAccYear: YEAR,
        docRefno: 'no-a',
        planned: '68.00',
        applied: '0.00',
        reason: 'BILL_SETTLED',
      },
      {
        billId: 'c',
        billAccYear: YEAR,
        docRefno: 'no-c',
        planned: '50.00',
        applied: '50.00',
        reason: 'BILL_REDUCED',
      },
      {
        billId: 'd',
        billAccYear: YEAR,
        docRefno: 'no-d',
        planned: '40.00',
        applied: '30.00',
        reason: 'BILL_REDUCED',
      },
      {
        billId: 'adv',
        billAccYear: YEAR,
        docRefno: 'no-adv',
        planned: '150.00',
        applied: '100.00',
        reason: 'CREDIT_REDUCED',
      },
    ]);
  });

  it('a bill that got more (freed money) is not a change to report', () => {
    expect(
      adjustedAgainstPlan(
        { lines: [line('a', 10)], credits: [] },
        { bills: new Map([[`a|${YEAR}`, figure(25)]]), credits: new Map() },
        () => '',
      ),
    ).toEqual([]);
  });
});
