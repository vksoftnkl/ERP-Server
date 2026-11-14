import { D, ZERO, zeroParts, type BillLineFacts, type LineMoney } from './sale-return-money';
import {
  checkAdjust,
  checkRefund,
  defaultSettleMode,
  proRataBack,
  loyaltyBackOf,
  proposeAdjust,
  refundableOf,
  roundPoints,
  schemeShorts,
  sharesOf,
  startTenders,
} from './sale-return-settlement';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import type { OpenBillFacts, SchemeFacts } from './sale-return-bill-reader';

/** Plan v5 P2b — settlement, points / voucher share, scheme short: the pure parts. */

const S = (v: { toString(): string }) => v.toString();

const openBill = (over: Partial<OpenBillFacts> = {}): OpenBillFacts => ({
  ablId: 'abl-this',
  ablAccYear: '2026-2027',
  billType: 'SALES',
  refno: 'bil00042',
  docDate: '2026-11-01',
  dueDate: '2026-11-15',
  billAmount: D(1000),
  pending: D(600),
  alloc: D(400),
  srcDocType: 'SALE_BILL',
  srcDocId: 'sb-this',
  srcAccYear: '2026-2027',
  ...over,
});

describe('sharesOf (D48 / D74)', () => {
  const base = {
    creditNote: D(500),
    billAmt: D(1000),
    billPoints: D(200),
    billPointsUnits: D(400),
    billVoucher: D(100),
    priorPointsBackAmt: ZERO,
    priorVoucherShare: ZERO,
    emptiesBill: false,
  };

  it('gives back as points the note’s share the bill paid in points, at the bill’s own rate', () => {
    const s = sharesOf(base);

    expect([S(s.pointsBackAmt), S(s.points), S(s.rate), S(s.voucherShare)]).toEqual([
      '100',
      '200',
      '0.5',
      '50',
    ]);
  });

  it('caps each share at what is left of it, and the emptying return takes the rest', () => {
    const left = sharesOf({ ...base, priorPointsBackAmt: D(150), priorVoucherShare: D(90) });
    const last = sharesOf({
      ...base,
      priorPointsBackAmt: D(130),
      priorVoucherShare: D(25),
      emptiesBill: true,
    });

    expect([S(left.pointsBackAmt), S(left.voucherShare)]).toEqual(['50', '10']);
    expect([S(last.pointsBackAmt), S(last.voucherShare)]).toEqual(['70', '75']);
  });

  it('gives nothing back for a bill paid without points or vouchers', () => {
    const s = sharesOf({ ...base, billPoints: ZERO, billPointsUnits: ZERO, billVoucher: ZERO });

    expect([S(s.pointsBackAmt), S(s.points), S(s.voucherShare)]).toEqual(['0', '0', '0']);
  });
});

describe('refund (D3 / D33 / D34)', () => {
  it('refunds at most the note less the points / voucher share, and never over the money cap', () => {
    expect(
      S(
        refundableOf({
          creditNote: D(500),
          pointsBackAmt: D(100),
          voucherShare: D(50),
          cap: D(1000),
        }),
      ),
    ).toBe('350');
    expect(
      S(refundableOf({ creditNote: D(500), pointsBackAmt: ZERO, voucherShare: ZERO, cap: D(120) })),
    ).toBe('120');
    expect(
      S(refundableOf({ creditNote: D(500), pointsBackAmt: ZERO, voucherShare: ZERO, cap: null })),
    ).toBe('500');
  });

  it('allows cash, UPI and bank only; UPI / bank need their reference; the total within the cap', () => {
    const t = (tenderTypeId: number, amount: number, refNo: string | null = null, index = 0) => ({
      index,
      tenderId: null,
      tenderTypeId,
      amount: D(amount),
      refNo,
    });

    expect(checkRefund([t(1, 100), t(3, 50, 'UTR', 1), t(6, 25, 'NEFT', 2)], D(175))).toEqual([]);
    expect(checkRefund([t(10, 10)], D(100)).map((i) => i.code)).toEqual([
      'SALES_RETURN_REFUND_TENDER',
    ]);
    expect(checkRefund([t(6, 10, '  ')], D(100)).map((i) => i.code)).toEqual([
      'SALES_RETURN_REFUND_REF',
    ]);
    expect(checkRefund([t(1, 101)], D(100))).toEqual([
      expect.objectContaining({
        code: 'SALES_RETURN_REFUND_OVER_PAID',
        params: { value: '100.00' },
      }),
    ]);
  });

  it('starts the refund grid as the bill was paid, pro rata, the last row taking the rest', () => {
    const row = (tenderTypeId: number, amount: number) => ({
      tdId: `t${tenderTypeId}`,
      tenderId: `tnd${tenderTypeId}`,
      tenderTypeId,
      name: null,
      ledgerId: null,
      amount: D(amount),
      unitsUsed: ZERO,
      conversionRate: ZERO,
    });

    expect(
      startTenders([row(1, 600), row(3, 300), row(10, 100)], D(100)).map((r) => [
        r.tenderTypeId,
        r.amount,
      ]),
    ).toEqual([
      [1, 66.67],
      [3, 33.33],
    ]);
    expect(startTenders([row(9, 1000)], D(40))).toEqual([
      { tenderId: null, tenderTypeId: 1, name: 'Cash', ledgerId: null, amount: 40 },
    ]);
  });
});

describe('adjust (D1 / D2)', () => {
  const bills = [
    openBill(),
    openBill({ ablId: 'abl-old', refno: 'bil00007', srcDocId: 'sb-old', pending: D(300) }),
  ];

  it('fills this bill first, then the next, until the note is used', () => {
    const lines = proposeAdjust(bills, D(750), 'sb-this');

    expect(lines.map((l) => [l.bill.ablId, l.isThisBill, S(l.amount)])).toEqual([
      ['abl-this', true, '600'],
      ['abl-old', false, '150'],
    ]);
  });

  it('checks the operator’s split: a bill over its due, the total over the note, a bill that moved', () => {
    const ok = checkAdjust(
      [{ index: 0, ablId: 'abl-old', ablAccYear: '2026-2027', amount: D(300), dueNow: D(300) }],
      bills,
      D(500),
      'sb-this',
    );
    expect(ok.issues).toEqual([]);
    expect(S(ok.lines[0].amount)).toBe('300');

    const over = checkAdjust(
      [
        { index: 0, ablId: 'abl-this', ablAccYear: '2026-2027', amount: D(450), dueNow: null },
        { index: 1, ablId: 'abl-old', ablAccYear: '2026-2027', amount: D(301), dueNow: null },
      ],
      bills,
      D(700),
      'sb-this',
    );
    expect(over.issues.map((i) => i.code)).toEqual([
      'SALES_RETURN_ADJUST_OVER',
      'SALES_RETURN_ADJUST_OVER',
    ]);

    const stale = checkAdjust(
      [
        { index: 0, ablId: 'abl-this', ablAccYear: '2026-2027', amount: D(10), dueNow: D(650) },
        { index: 1, ablId: 'abl-gone', ablAccYear: '2026-2027', amount: D(10), dueNow: null },
      ],
      bills,
      D(700),
      'sb-this',
    );
    expect(stale.issues.map((i) => i.code)).toEqual([
      'SALES_RETURN_ADJUST_STALE',
      'SALES_RETURN_ADJUST_STALE',
    ]);
  });

  it('starts from the branch default, but a settled or other-branch bill proposes a credit note; never a refund (D4)', () => {
    expect(defaultSettleMode('ADJUST', { adjustable: true, billDue: D(10) })).toBe('ADJUST');
    expect(defaultSettleMode('ADJUST', { adjustable: true, billDue: ZERO })).toBe('ADVANCE');
    expect(defaultSettleMode('ADJUST', { adjustable: false, billDue: D(10) })).toBe('ADVANCE');
    expect(defaultSettleMode('CASH', { adjustable: true, billDue: D(10) })).toBe('ADJUST');
    expect(defaultSettleMode('ADVANCE', { adjustable: true, billDue: D(10) })).toBe('ADVANCE');
  });
});

describe('proRataBack (D22 / D9)', () => {
  it('takes the part pro rata, never more than is left; the emptying return takes the rest', () => {
    expect(
      S(
        proRataBack({
          onBill: D(90),
          prior: ZERO,
          part: D(100),
          whole: D(300),
          emptiesBill: false,
        }),
      ),
    ).toBe('30');
    expect(
      S(
        proRataBack({
          onBill: D(90),
          prior: D(70),
          part: D(100),
          whole: D(300),
          emptiesBill: false,
        }),
      ),
    ).toBe('20');
    expect(
      S(proRataBack({ onBill: D(90), prior: D(30), part: D(1), whole: D(300), emptiesBill: true })),
    ).toBe('60');
  });
});

describe('schemeShorts (D47)', () => {
  const bl = (
    over: Omit<Partial<BillLineFacts>, 'parts'> & { parts?: Partial<LineMoney['parts']> },
  ): BillLineFacts & {
    netAmt: typeof ZERO;
  } => {
    const parts = zeroParts();
    Object.assign(parts, over.parts ?? {});
    return {
      billItemId: 'paid',
      accYear: '2026-2027',
      lineNo: 1,
      itemId: 'i',
      itemUnitId: 'u',
      qty: D(10),
      factor: D(1),
      perUnit: {
        rate: D(50),
        ratePreTax: D(50),
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
      percent: {} as BillLineFacts['percent'],
      copy: {
        hsnCode: null,
        taxId: null,
        isTaxIncl: false,
        isFree: false,
        freeType: null,
        isService: false,
        schemeId: 'prm-1',
        schemeName: 'Buy 10 get 1',
        priceLevel: 1,
        eanCode: null,
        lotId: null,
        batchNo: null,
        batchDate: null,
        expiryDate: null,
        serialNo: null,
        salesmanId: null,
        promoUsageId: null,
        qtyPriceId: null,
        size: null,
        sizeUom: null,
      },
      netAmt: ZERO,
      ...(over as Partial<BillLineFacts>),
      parts,
    };
  };
  const scheme: SchemeFacts = {
    prmId: 'prm-1',
    code: 'B10G1',
    name: 'Buy 10 get 1',
    applyOn: 'ITEM_QTY',
    benefit: 'FREE_ITEM',
    includeTax: false,
    minQty: ZERO,
    minBillAmount: ZERO,
    slabs: [{ exceeds: D(9), upto: ZERO, benefit: 'FREE_ITEM' }],
  };
  const paid = bl({ parts: { taxableAmt: D(500), schDiscAmt: D(20) } });
  const free = bl({ billItemId: 'free', qty: D(1), copy: { ...paid.copy, isFree: true } });
  const ret = (qtyBase: number, billItemId = 'paid') =>
    ({ billItemId, qtyBase: D(qtyBase), overQty: false }) as unknown as LineMoney;

  it('warns when a part return takes the bill below the scheme, with the benefit the customer keeps', () => {
    const shorts = schemeShorts(
      { billLines: [paid, free] as never, prior: new Map(), lines: [ret(2)], emptiesBill: false },
      new Map([['prm-1', scheme]]),
    );

    // 8 of 10 left (needs > 9): the free one (50.00) and 80 % of the 20.00 discount stay.
    expect(shorts).toEqual([
      expect.objectContaining({ schemeId: 'prm-1', kind: 'ITEM_QTY/FREE_ITEM', keptValue: D(66) }),
    ]);
  });

  it('is quiet when the free goods come back too, when the scheme still holds, or when the bill is emptied', () => {
    const scheme1 = new Map([['prm-1', scheme]]);
    expect(
      schemeShorts(
        {
          billLines: [paid, free] as never,
          prior: new Map(),
          lines: [ret(2), ret(1, 'free')],
          emptiesBill: false,
        },
        scheme1,
      ).map((s) => S(s.keptValue)),
    ).toEqual(['16']);
    expect(
      schemeShorts(
        { billLines: [paid, free] as never, prior: new Map(), lines: [], emptiesBill: false },
        scheme1,
      ),
    ).toEqual([]);
    expect(
      schemeShorts(
        { billLines: [paid, free] as never, prior: new Map(), lines: [ret(2)], emptiesBill: true },
        scheme1,
      ),
    ).toEqual([]);
  });
});

describe('review 11-14 N5 — points given back are counted the way the scheme redeems (D74)', () => {
  // Bill 1,400.00 paid 14 points at 1.00 each; a 590.00 note's share is 5.90.
  const base = {
    creditNote: D(590),
    billAmt: D(1400),
    billPoints: D(14),
    billPointsUnits: D(14),
    billVoucher: ZERO,
    priorPointsBackAmt: ZERO,
    priorVoucherShare: ZERO,
    emptiesBill: false,
  };

  it('rounds half up to the scheme’s precision and makes the money points × rate to the paisa', () => {
    // 5.90 of points money → 6 whole points, 6.00 (the note's other 584.00 stays credit).
    const whole = sharesOf({ ...base, pointsDecimals: 0, priorPoints: ZERO });
    expect([S(whole.points), S(whole.pointsBackAmt)]).toEqual(['6', '6']);
    // 4.20 (a 420.00 note) → 4 points, 4.00.
    const down = sharesOf({ ...base, creditNote: D(420), pointsDecimals: 0, priorPoints: ZERO });
    expect([S(down.points), S(down.pointsBackAmt)]).toEqual(['4', '4']);

    const twoDp = sharesOf({ ...base, pointsDecimals: 2, priorPoints: ZERO });
    expect([S(twoDp.points), S(twoDp.pointsBackAmt)]).toEqual(['5.9', '5.9']);
  });

  it('never gives back more points money than the bill has left, nor more than the note', () => {
    // 13.00 of the 14 already back: 5.90 → 6 points would be 6.00 > the 1.00 left → 1 point.
    const s = sharesOf({
      ...base,
      priorPointsBackAmt: D(13),
      priorPoints: D(13),
      pointsDecimals: 0,
    });
    expect([S(s.points), S(s.pointsBackAmt)]).toEqual(['1', '1']);
    // A 0.70 note: 0.0070 of points money rounds to 0 points.
    const tiny = sharesOf({ ...base, creditNote: D('0.70'), pointsDecimals: 0, priorPoints: ZERO });
    expect([S(tiny.points), S(tiny.pointsBackAmt)]).toEqual(['0', '0']);
  });

  it('the return that empties the bill gives back exactly the points and money left', () => {
    const last = sharesOf({
      ...base,
      creditNote: D(810),
      emptiesBill: true,
      priorPointsBackAmt: D(5),
      priorPoints: D(5),
      pointsDecimals: 0,
    });
    expect([S(last.points), S(last.pointsBackAmt)]).toEqual(['9', '9']);
  });

  it('keeps the 4 dp points of the money share when the bill names no scheme', () => {
    const s = sharesOf({ ...base, pointsDecimals: null });
    expect([S(s.points), S(s.pointsBackAmt)]).toEqual(['5.9', '5.9']);
  });

  it('gives nothing back on a 0.00 note (B1)', () => {
    const s = sharesOf({ ...base, creditNote: ZERO, pointsDecimals: 0 });
    expect([S(s.points), S(s.pointsBackAmt), S(s.voucherShare)]).toEqual(['0', '0', '0']);
  });
});

describe('review 11-14 N3 — the loyalty a return takes back (D9 / D74)', () => {
  const rule = { lscId: 'lsc', decimals: 0, rounding: 'ROUND', returnMode: 'REVERSE' };

  it('shares by LINE taxable, so the bill’s taxed after-tax charges never keep points back', () => {
    // 14 earned; lines 1,250.00 (sb_taxable_amt 1,350.00 with a taxed charge).
    // Half the lines back = 7, not 14 × 625 / 1,350 = 6.48.
    expect(
      S(
        loyaltyBackOf({
          earned: D(14),
          priorReversed: ZERO,
          lineTaxable: D(625),
          billLineTaxable: D(1250),
          emptiesBill: false,
          rule,
        }),
      ),
    ).toBe('7');
  });

  it('the return that empties the bill takes exactly the rest, whatever the earlier ones took', () => {
    expect(
      S(
        loyaltyBackOf({
          earned: D(14),
          priorReversed: D(7),
          lineTaxable: D(625),
          billLineTaxable: D(1250),
          emptiesBill: true,
          rule,
        }),
      ),
    ).toBe('7');
    // A free line that empties the bill (no taxable of its own) still takes the rest.
    expect(
      S(
        loyaltyBackOf({
          earned: D(11),
          priorReversed: D(4),
          lineTaxable: ZERO,
          billLineTaxable: D(843.69),
          emptiesBill: true,
          rule,
        }),
      ),
    ).toBe('7');
  });

  it('rounds the way the scheme earns, never more than is left', () => {
    const at = (rounding: string) =>
      S(
        loyaltyBackOf({
          earned: D(11),
          priorReversed: ZERO,
          lineTaxable: D('338.98'),
          billLineTaxable: D('843.69'),
          emptiesBill: false,
          rule: { ...rule, rounding },
        }),
      );
    // 11 × 0.401784… = 4.4196
    expect([at('ROUND'), at('FLOOR'), at('CEIL'), at('NONE')]).toEqual(['4', '4', '5', '4.4196']);
    expect(
      S(
        loyaltyBackOf({
          earned: D(11),
          priorReversed: D(9),
          lineTaxable: D(500),
          billLineTaxable: D(843.69),
          emptiesBill: false,
          rule,
        }),
      ),
    ).toBe('2');
  });

  it('takes nothing back under a scheme whose return mode is IGNORE, or when the bill earned none', () => {
    const args = {
      earned: D(14),
      priorReversed: ZERO,
      lineTaxable: D(625),
      billLineTaxable: D(1250),
      emptiesBill: false,
    };
    expect(S(loyaltyBackOf({ ...args, rule: { ...rule, returnMode: 'IGNORE' } }))).toBe('0');
    expect(S(loyaltyBackOf({ ...args, earned: ZERO, rule }))).toBe('0');
  });

  it('roundPoints keeps the ledger’s 4 dp at most', () => {
    expect(S(roundPoints(D('1.23456'), 'NONE', 0))).toBe('1.2346');
    expect(S(roundPoints(D('1.23456'), 'ROUND', 9))).toBe('1.2346');
  });
});

describe('review 11-14 N9 — a bill of a closed year is not adjusted', () => {
  it('refuses a split row naming a closed-year bill (SALES_YEAR_LOCKED, field adjustments)', () => {
    const old = openBill({ ablId: 'abl-old', ablAccYear: '2025-2026', refno: 'bil00007' });
    const { lines, issues } = checkAdjust(
      [
        { index: 0, ablId: 'abl-this', ablAccYear: '2026-2027', amount: D(100), dueNow: null },
        { index: 1, ablId: 'abl-old', ablAccYear: '2025-2026', amount: D(50), dueNow: null },
      ],
      [openBill()],
      D(500),
      'sb-this',
      new Map([[old.ablId, old]]),
    );
    expect(lines.map((l) => [l.bill.ablId, S(l.amount)])).toEqual([['abl-this', '100']]);
    expect(issues).toEqual([
      expect.objectContaining({
        level: 'REFUSE',
        code: SALES_ERROR_CODES.YEAR_LOCKED,
        field: 'adjustments',
        params: { bill: 'bil00007', year: '2025-2026' },
      }),
    ]);
  });
});
