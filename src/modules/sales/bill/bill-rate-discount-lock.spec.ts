import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  judgeRateDiscount,
  lineDiscountBase,
  linesNeedingNormal,
  lockChargeOf,
  lockHeaderOf,
  lockLineOfDto,
  rateDiscountRefusals,
  readAllowedLevels,
  readLineNormals,
  throwRateDiscountRefusals,
  type ChargeMasterRule,
  type LineNormal,
  type LockInput,
  type LockLine,
  type RateLockUser,
} from './bill-rate-discount-lock';

/**
 * Review step 6 (U6, D7-D12): the Sale Bill rate / discount lock. The judgement is pure;
 * readLineNormals is driven through a mocked shared resolver.
 */
jest.mock('../../Inventory/items-price-master/sale-line-price', () => ({
  resolveSaleLinePrice: jest.fn(),
  rankedQtySlabs: jest.fn(async () => []),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shared = jest.requireMock<{ resolveSaleLinePrice: jest.Mock; rankedQtySlabs: jest.Mock }>(
  '../../Inventory/items-price-master/sale-line-price',
);

const d = (v: string | number) => new Prisma.Decimal(v);
const ITEM = '019c6f6c-be87-7a11-8905-36092c46f601';
const UNIT = '019c6f6c-be87-7a11-8905-36092c46f602';
const CHG = '019c6f6c-be87-7a11-8905-36092c46f603';
const SRC = '019c6f6c-be87-7a11-8905-36092c46f604';

const NO_RIGHT: RateLockUser = { usrId: 'u', editRate: false, maxDiscPerc: null };
const RIGHT_MAX10: RateLockUser = { usrId: 'u', editRate: true, maxDiscPerc: d(10) };
const RIGHT_NO_LIMIT: RateLockUser = { usrId: 'u', editRate: true, maxDiscPerc: null };

/** 2 × 100 (pre-tax 100), no discount. */
const line = (o: Partial<LockLine> = {}): LockLine => ({
  lineNo: 1,
  id: null,
  itemId: ITEM,
  unitId: UNIT,
  priceLevel: 1,
  lotId: null,
  mrp: null,
  isTaxIncl: false,
  taxPerc: d(0),
  billQty: d(2),
  netQty: d(2),
  rate: d(100),
  ratePreTax: d(100),
  isFree: false,
  isPromo: false,
  srcDocType: null,
  srcItemId: null,
  itemDiscPerc: d(0),
  itemDiscQty: d(0),
  itemDiscAmt: d(0),
  splDiscPerc: d(0),
  splDiscQty: d(0),
  splDiscAmt: d(0),
  schDiscAmt: d(0),
  billSchAmt: d(0),
  netGross: null,
  netAmt: d(200),
  ...o,
});

const input = (o: Partial<LockInput> = {}): LockInput => ({
  header: {
    companyId: 'c',
    branchId: 'b',
    deviceId: null,
    custId: null,
    priceLevel: 1,
    billDate: '2026-11-20',
    discAlterBase: false,
    headerDisc: d(0),
  },
  lines: [line()],
  charges: [],
  priorLines: [],
  priorCharges: [],
  priorHeaderDisc: d(0),
  priorHeaderLevel: null,
  ...o,
});

const normal = (o: Partial<LineNormal> = {}): LineNormal => ({
  rates: [d(100)],
  skipRate: false,
  baselines: [{ itemPerc: d(0), itemQty: d(0), splPerc: d(0), splQty: d(0) }],
  sourceLevel: null,
  ...o,
});

const judge = (
  user: RateLockUser,
  inp: LockInput,
  n: LineNormal | null = normal(),
  rules: Map<string, ChargeMasterRule> = new Map(),
  levels: Set<number> = new Set(),
) => judgeRateDiscount(user, inp, new Map(inp.lines.map((_, i) => [i, n])), rules, levels);
const codes = (r: ReturnType<typeof judge>) => r.map((x) => x.code);

describe('bill rate / discount lock — the judgement', () => {
  describe('rate (no right)', () => {
    it('the rate the item gives passes; within a paisa passes', () => {
      expect(judge(NO_RIGHT, input())).toEqual([]);
      expect(judge(NO_RIGHT, input({ lines: [line({ rate: d('100.01') })] }))).toEqual([]);
    });

    it('any other rate, lower or higher, is SALES_RATE_CHANGE_NOT_ALLOWED with {line}', () => {
      for (const rate of ['99.98', '120']) {
        const r = judge(NO_RIGHT, input({ lines: [line({ lineNo: 3, rate: d(rate) })] }));
        expect(r).toEqual([
          expect.objectContaining({
            code: 'SALES_RATE_CHANGE_NOT_ALLOWED',
            line: 3,
            field: 'items',
          }),
        ]);
      }
    });

    it('any of the rates the item may carry passes (customer rate, base, slab, source line)', () => {
      const n = normal({ rates: [d(95), d(100), d(90)] });
      expect(judge(NO_RIGHT, input({ lines: [line({ rate: d(90) })] }), n)).toEqual([]);
    });

    it('no price row / a 0 price (no rates): the cashier types the rate', () => {
      expect(
        judge(NO_RIGHT, input({ lines: [line({ rate: d(37) })] }), normal({ rates: [] })),
      ).toEqual([]);
      expect(judge(NO_RIGHT, input({ lines: [line({ rate: d(37) })] }), null)).toEqual([]);
    });

    it('a weigh-scale item (price barcode), a free line and a promotion line are never judged on rate', () => {
      expect(
        judge(NO_RIGHT, input({ lines: [line({ rate: d(37) })] }), normal({ skipRate: true })),
      ).toEqual([]);
      expect(judge(NO_RIGHT, input({ lines: [line({ rate: d(0), isFree: true })] }))).toEqual([]);
      expect(judge(NO_RIGHT, input({ lines: [line({ rate: d(80), isPromo: true })] }))).toEqual([]);
    });

    it('a line this save did not change (an amend re-sending a posted line) passes at its old rate', () => {
      const old = line({ id: 'L1', rate: d(80) });
      expect(
        judge(NO_RIGHT, input({ lines: [line({ id: 'L1', rate: d(80) })], priorLines: [old] })),
      ).toEqual([]);
      // ...but a changed one is judged again.
      expect(
        codes(
          judge(NO_RIGHT, input({ lines: [line({ id: 'L1', rate: d(70) })], priorLines: [old] })),
        ),
      ).toEqual(['SALES_RATE_CHANGE_NOT_ALLOWED']);
    });

    it('a user with the right may set any rate', () => {
      expect(judge(RIGHT_MAX10, input({ lines: [line({ rate: d(1) })] }))).toEqual([]);
    });
  });

  describe('line discount', () => {
    it('no right: any typed discount is SALES_DISC_NOT_ALLOWED with {line}', () => {
      const r = judge(
        NO_RIGHT,
        input({ lines: [line({ lineNo: 2, itemDiscPerc: d(5), itemDiscAmt: d(10) })] }),
      );
      expect(r).toEqual([
        expect.objectContaining({ code: 'SALES_DISC_NOT_ALLOWED', line: 2, field: 'items' }),
      ]);
    });

    it("the item's own default discount is not typed; a raised one is; a lowered one is not", () => {
      const n = normal({
        baselines: [{ itemPerc: d(5), itemQty: d(0), splPerc: d(0), splQty: d(0) }],
      });
      const at = (perc: number) =>
        input({ lines: [line({ itemDiscPerc: d(perc), itemDiscAmt: d(perc * 2) })] });
      expect(judge(NO_RIGHT, at(5), n)).toEqual([]);
      expect(judge(NO_RIGHT, at(3), n)).toEqual([]);
      expect(codes(judge(NO_RIGHT, at(8), n))).toEqual(['SALES_DISC_NOT_ALLOWED']);
    });

    it("a line billed from an order keeps the order's discount untyped (baseline = the source line)", () => {
      const n = normal({
        rates: [d(90)],
        baselines: [{ itemPerc: d(4), itemQty: d(0), splPerc: d(2), splQty: d(0) }],
      });
      // 200 × 4 % = 8, then 192 × 2 % = 3.84
      const l = line({
        rate: d(90),
        ratePreTax: d(100),
        srcDocType: 'SALES_ORDER',
        srcItemId: SRC,
        itemDiscPerc: d(4),
        itemDiscAmt: d(8),
        splDiscPerc: d(2),
        splDiscAmt: d('3.84'),
      });
      expect(judge(NO_RIGHT, input({ lines: [l] }), n)).toEqual([]);
    });

    it('scheme and bill-scheme (promotion) discounts never count', () => {
      expect(
        judge(NO_RIGHT, input({ lines: [line({ schDiscAmt: d(20), billSchAmt: d(5) })] })),
      ).toEqual([]);
    });

    it('with the right, the typed discount is judged against max % of the value before it (D8)', () => {
      const at = (amt: string) =>
        judge(RIGHT_MAX10, input({ lines: [line({ lineNo: 4, itemDiscAmt: d(amt) })] }));
      expect(at('20')).toEqual([]); // 10 % of 200
      expect(at('20.01')).toEqual([]); // within the paisa tolerance
      expect(at('20.1')).toEqual([
        expect.objectContaining({
          code: 'SALES_LINE_DISC_OVER_USER_MAX',
          line: 4,
          max: '10',
          field: 'items',
        }),
      ]);
    });

    it('item + special discount count together', () => {
      const r = judge(
        RIGHT_MAX10,
        input({ lines: [line({ itemDiscAmt: d(15), splDiscAmt: d(10) })] }),
      );
      expect(codes(r)).toEqual(['SALES_LINE_DISC_OVER_USER_MAX']);
    });

    it('discount-first bills take the % of the rate as typed (incl. tax)', () => {
      const l = line({ rate: d(118), ratePreTax: d(90), itemDiscAmt: d('23.6') });
      expect(lineDiscountBase(l, true).toString()).toBe('236');
      const inp = input({ lines: [l] });
      inp.header.discAlterBase = true;
      expect(judge(RIGHT_MAX10, inp)).toEqual([]);
    });

    it('a limit of 0 refuses any typed discount; NULL is no limit', () => {
      const inp = input({ lines: [line({ itemDiscAmt: d(1) })] });
      expect(codes(judge({ ...RIGHT_MAX10, maxDiscPerc: d(0) }, inp))).toEqual([
        'SALES_LINE_DISC_OVER_USER_MAX',
      ]);
      expect(judge(RIGHT_NO_LIMIT, input({ lines: [line({ itemDiscAmt: d(150) })] }))).toEqual([]);
    });
  });

  describe('bill discount', () => {
    const deduct = (amount: number, o: Partial<ReturnType<typeof lockChargeOf>> = {}) => ({
      chgId: CHG,
      type: 'DEDUCT',
      method: null as string | null,
      rate: d(amount),
      amount: d(amount),
      beforeTax: true,
      srcCdId: null,
      ...o,
    });

    it('no right: a typed DEDUCT row is SALES_DISC_NOT_ALLOWED on charges', () => {
      const r = judge(NO_RIGHT, input({ charges: [deduct(10)] }));
      expect(r).toEqual([
        expect.objectContaining({ code: 'SALES_DISC_NOT_ALLOWED', field: 'charges' }),
      ]);
      expect(r[0]).not.toHaveProperty('line');
    });

    it('ADD rows, auto-applied rows at the default (measured method: by rate) and unchanged rows are not typed', () => {
      const rules = new Map([[CHG, { autoApply: true, defaultRate: d(10), method: 'QTY' }]]);
      expect(judge(NO_RIGHT, input({ charges: [deduct(10, { type: 'ADD' })] }))).toEqual([]);
      expect(judge(NO_RIGHT, input({ charges: [deduct(10)] }), normal(), rules)).toEqual([]);
      expect(judge(NO_RIGHT, input({ charges: [deduct(10)], priorCharges: [deduct(10)] }))).toEqual(
        [],
      );
      // the auto row at another rate is typed
      expect(codes(judge(NO_RIGHT, input({ charges: [deduct(12)] }), normal(), rules))).toEqual([
        'SALES_DISC_NOT_ALLOWED',
      ]);
    });

    describe('auto-applied and carried rows count by VALUE (api-tester 11-20)', () => {
      const judgeWith = (
        user: RateLockUser,
        charges: ReturnType<typeof deduct>[],
        rules: Map<string, ChargeMasterRule>,
        sources: Map<string, Prisma.Decimal> = new Map(),
      ) => judgeRateDiscount(user, input({ charges }), new Map(), rules, new Set(), sources);
      const zeroDefault = new Map([
        [CHG, { autoApply: true, defaultRate: d(0), method: 'PERCENT' }],
      ]);

      it('"CD - AFTER TAX" (auto, default 0) typed 10 as a FIXED amount at rate 0: typed, refused without the right', () => {
        const row = deduct(10, { method: 'FIXED', rate: d(0), beforeTax: false });
        expect(codes(judgeWith(NO_RIGHT, [row], zeroDefault))).toEqual(['SALES_DISC_NOT_ALLOWED']);
        // with the right it counts towards the limit: 10 of a 200 bill = 5 %
        expect(codes(judgeWith({ ...RIGHT_MAX10, maxDiscPerc: d(5) }, [row], zeroDefault))).toEqual(
          [],
        );
        expect(codes(judgeWith({ ...RIGHT_MAX10, maxDiscPerc: d(4) }, [row], zeroDefault))).toEqual(
          ['SALES_BILL_DISC_OVER_USER_MAX'],
        );
      });

      it('an auto-applied row left at its default value (0) is not typed', () => {
        expect(judgeWith(NO_RIGHT, [deduct(0, { method: 'PERCENT' })], zeroDefault)).toEqual([]);
      });

      it('FIXED default 15: 15 (or less) untouched, 20 typed', () => {
        const rules = new Map([[CHG, { autoApply: true, defaultRate: d(15), method: 'FIXED' }]]);
        expect(judgeWith(NO_RIGHT, [deduct(15)], rules)).toEqual([]);
        expect(judgeWith(NO_RIGHT, [deduct(12)], rules)).toEqual([]);
        expect(codes(judgeWith(NO_RIGHT, [deduct(20)], rules))).toEqual(['SALES_DISC_NOT_ALLOWED']);
      });

      it('PERCENT default 5 % (before tax, bill value 200): 10 untouched, 12 typed', () => {
        const rules = new Map([[CHG, { autoApply: true, defaultRate: d(5), method: 'PERCENT' }]]);
        expect(judgeWith(NO_RIGHT, [deduct(10, { rate: d(5) })], rules)).toEqual([]);
        expect(codes(judgeWith(NO_RIGHT, [deduct(12, { rate: d(6) })], rules))).toEqual([
          'SALES_DISC_NOT_ALLOWED',
        ]);
      });

      it("a carried row: up to the source row's amount untouched; more, or an unknown source, typed", () => {
        const src = new Map([['src-cd', d(10)]]);
        const carried = (amount: number) => deduct(amount, { srcCdId: 'src-cd' });
        expect(judgeWith(NO_RIGHT, [carried(10)], new Map(), src)).toEqual([]);
        expect(judgeWith(NO_RIGHT, [carried(6)], new Map(), src)).toEqual([]);
        expect(codes(judgeWith(NO_RIGHT, [carried(15)], new Map(), src))).toEqual([
          'SALES_DISC_NOT_ALLOWED',
        ]);
        expect(codes(judgeWith(NO_RIGHT, [carried(10)], new Map(), new Map()))).toEqual([
          'SALES_DISC_NOT_ALLOWED',
        ]);
      });
    });

    it('with the right: over max % of the bill value before it is SALES_BILL_DISC_OVER_USER_MAX {max}', () => {
      // bill value before tax 200: 10 % = 20
      expect(judge(RIGHT_MAX10, input({ charges: [deduct(20)] }))).toEqual([]);
      expect(judge(RIGHT_MAX10, input({ charges: [deduct(21)] }))).toEqual([
        expect.objectContaining({
          code: 'SALES_BILL_DISC_OVER_USER_MAX',
          max: '10',
          field: 'charges',
        }),
      ]);
    });

    it('an after-tax row is a % of the value with tax', () => {
      const lines = [line({ netAmt: d(236) })];
      expect(
        judge(
          RIGHT_MAX10,
          input({ lines, charges: [deduct('23.6' as unknown as number, { beforeTax: false })] }),
        ),
      ).toEqual([]);
    });

    it('header discounts (sb_addl_disc1/2, sb_cash_disc) count; an unchanged one does not', () => {
      const typed = input();
      typed.header.headerDisc = d(5);
      expect(codes(judge(NO_RIGHT, typed))).toEqual(['SALES_DISC_NOT_ALLOWED']);
      const same = input({ priorHeaderDisc: d(5) });
      same.header.headerDisc = d(5);
      expect(judge(NO_RIGHT, same)).toEqual([]);
    });
  });

  describe('price level (no right; user 20/11)', () => {
    const DEFAULTS = new Set([1, 2]); // the customer's level 2, the setting's 1
    const judgeLevels = (inp: LockInput, n: LineNormal | null = normal(), user = NO_RIGHT) =>
      judge(user, inp, n, new Map(), DEFAULTS);

    it("a default level (the customer's or the setting's) passes, on the bill and on a line", () => {
      expect(judgeLevels(input({ lines: [line({ priceLevel: 2 })] }))).toEqual([]);
      const billAt2 = input();
      billAt2.header.priceLevel = 2;
      expect(judgeLevels(billAt2)).toEqual([]);
    });

    it('another level on a line is SALES_PRICE_LEVEL_NOT_ALLOWED {line} (field items)', () => {
      expect(judgeLevels(input({ lines: [line({ lineNo: 4, priceLevel: 3 })] }))).toEqual([
        expect.objectContaining({ code: 'SALES_PRICE_LEVEL_NOT_ALLOWED', line: 4, field: 'items' }),
      ]);
    });

    it('another level on the bill is one refusal on sbPriceLevel, not repeated per line', () => {
      const inp = input({ lines: [line({ priceLevel: 3 }), line({ lineNo: 2, priceLevel: 3 })] });
      inp.header.priceLevel = 3;
      const r = judgeLevels(inp);
      expect(r).toEqual([
        expect.objectContaining({ code: 'SALES_PRICE_LEVEL_NOT_ALLOWED', field: 'sbPriceLevel' }),
      ]);
      expect(r[0]).not.toHaveProperty('line');
    });

    it("kept levels pass: the bill's and a line's own from before this save (an amend)", () => {
      const inp = input({
        lines: [line({ id: 'L1', priceLevel: 3 })],
        priorLines: [line({ id: 'L1', priceLevel: 3 })],
        priorHeaderLevel: 3,
      });
      inp.header.priceLevel = 3;
      expect(judgeLevels(inp)).toEqual([]);
    });

    it("a line billed from an order may keep the order line's level", () => {
      const l = line({ priceLevel: 4, srcDocType: 'SALES_ORDER', srcItemId: SRC });
      expect(judgeLevels(input({ lines: [l] }), normal({ sourceLevel: 4 }))).toEqual([]);
    });

    it('free and promotion lines, and a user with the right, are not judged on level', () => {
      expect(
        judgeLevels(input({ lines: [line({ priceLevel: 3, isFree: true, rate: d(0) })] })),
      ).toEqual([]);
      expect(judgeLevels(input({ lines: [line({ priceLevel: 3, isPromo: true })] }))).toEqual([]);
      expect(
        judgeLevels(input({ lines: [line({ priceLevel: 3 })] }), normal(), RIGHT_MAX10),
      ).toEqual([]);
    });

    it('no default known (empty set): the level is not judged', () => {
      expect(judge(NO_RIGHT, input({ lines: [line({ priceLevel: 3 })] }))).toEqual([]);
    });
  });

  it('linesNeedingNormal names only lines that changed something the lock judges', () => {
    const inp = input({
      lines: [
        line({ id: 'A' }),
        line({ id: 'B', rate: d(90) }),
        line({ id: 'C', isFree: true, rate: d(0) }),
        line({ id: 'D', itemDiscAmt: d(5) }),
      ],
      priorLines: [line({ id: 'A' }), line({ id: 'B', rate: d(90) })],
    });
    expect(linesNeedingNormal(NO_RIGHT, inp)).toEqual([3]);
    expect(linesNeedingNormal(NO_RIGHT, { ...inp, priorLines: [] })).toEqual([0, 1, 3]);
    expect(linesNeedingNormal(RIGHT_MAX10, { ...inp, priorLines: [] })).toEqual([3]);
  });
});

describe('bill rate / discount lock — reading the facts', () => {
  const client = (o: Record<string, unknown> = {}) => ({
    userMaster: {
      findUnique: jest.fn(async () => ({ usrId: 'u', usrEditRate: false, usrMaxDiscPerc: null })),
    },
    chargeMaster: { findMany: jest.fn(async () => []) },
    customer: { findFirst: jest.fn(async () => ({ cusPriceLevelId: 2 })) },
    transactionChargeDetail: { findMany: jest.fn(async () => []) },
    $queryRaw: jest.fn(async () => []),
    ...o,
  });

  beforeEach(() => {
    shared.resolveSaleLinePrice.mockReset();
    shared.rankedQtySlabs.mockReset().mockResolvedValue([]);
  });

  const priced = (o: Record<string, unknown> = {}) => ({
    ok: true,
    item: { itemWeighScale: false },
    rate: { ipmDiscPerc: d(0), ipmDiscQty: d(0), itemUnitConversion: { iucId: 'iuc' } },
    basePrice: 100,
    customerDiscQty: 0,
    salesPrice: 100,
    ...o,
  });

  it('an exempt user (right, no limit) is answered after one read: no price lookups', async () => {
    const c = client({
      userMaster: {
        findUnique: jest.fn(async () => ({ usrId: 'u', usrEditRate: true, usrMaxDiscPerc: null })),
      },
    });
    await expect(
      rateDiscountRefusals(c as never, 'u', input({ lines: [line({ rate: d(1) })] })),
    ).resolves.toEqual([]);
    expect(shared.resolveSaleLinePrice).not.toHaveBeenCalled();
  });

  it('no acting user: nothing to judge', async () => {
    await expect(rateDiscountRefusals(client() as never, null, input())).resolves.toEqual([]);
  });

  it("prices the line with the bill's scope, customer, date, level, MRP and lot", async () => {
    shared.resolveSaleLinePrice.mockResolvedValue(priced());
    const inp = input({ lines: [line({ rate: d(90), mrp: 120, lotId: 'lot', priceLevel: 2 })] });
    inp.header.custId = 'cust';
    inp.header.priceLevel = 2; // the customer's level (the mocked customer's)
    const out = await rateDiscountRefusals(client() as never, 'u', inp);
    expect(shared.resolveSaleLinePrice).toHaveBeenCalledWith(expect.anything(), {
      itemId: ITEM,
      unitId: UNIT,
      companyId: 'c',
      branchId: 'b',
      customerId: 'cust',
      priceLevel: 2,
      docDate: '2026-11-20',
      mrp: 120,
      lotId: 'lot',
    });
    expect(codes(out)).toEqual(['SALES_RATE_CHANGE_NOT_ALLOWED']);
  });

  it('the customer rate and the plain level price both pass', async () => {
    shared.resolveSaleLinePrice.mockResolvedValue(priced({ customerDiscQty: 5, salesPrice: 95 }));
    const n = await readLineNormals(client() as never, input().header, [line()], [0]);
    expect(n.get(0)!.rates.map(String)).toEqual(['95', '100']);
  });

  it('a 0 price or no price row: no rates (typed rate allowed); a weigh-scale item skips the rate', async () => {
    shared.resolveSaleLinePrice.mockResolvedValueOnce(priced({ basePrice: 0, salesPrice: 0 }));
    shared.resolveSaleLinePrice.mockResolvedValueOnce({ ok: false, reason: 'PRICE_NOT_FOUND' });
    shared.resolveSaleLinePrice.mockResolvedValueOnce(priced({ item: { itemWeighScale: true } }));
    const n = await readLineNormals(
      client() as never,
      input().header,
      [line(), line(), line()],
      [0, 1, 2],
    );
    expect(n.get(0)!.rates).toEqual([]);
    expect(n.get(1)!.rates).toEqual([]);
    expect(n.get(2)!.skipRate).toBe(true);
  });

  it("a line billed from an order may carry the order line's rate and discounts", async () => {
    shared.resolveSaleLinePrice.mockResolvedValue(priced());
    const c = client({
      $queryRaw: jest.fn(async () => [
        {
          id: SRC,
          rate: d(88),
          price_level: 4,
          item_perc: d(3),
          item_qty: null,
          spl_perc: null,
          spl_qty: null,
        },
      ]),
    });
    const n = await readLineNormals(
      c as never,
      input().header,
      [line({ srcDocType: 'SALES_ORDER', srcItemId: SRC })],
      [0],
    );
    expect(n.get(0)!.rates.map(String)).toEqual(['88', '100']);
    expect(n.get(0)!.baselines[0].itemPerc.toString()).toBe('3');
    expect(n.get(0)!.sourceLevel).toBe(4);
  });

  it("the default levels: the customer's own and the setting's, read for a user without the right", async () => {
    const inp = input({ lines: [line({ priceLevel: 3 })] });
    inp.header.custId = 'cust';
    inp.header.deviceId = 'dev';
    const defaultPriceLevel = jest.fn(async () => 1);
    shared.resolveSaleLinePrice.mockResolvedValue(priced());
    const c = client();
    const out = await rateDiscountRefusals(c as never, 'u', inp, { defaultPriceLevel });
    expect(c.customer.findFirst).toHaveBeenCalledWith({
      where: { cusId: 'cust' },
      select: { cusPriceLevelId: true },
    });
    expect(defaultPriceLevel).toHaveBeenCalledWith(inp.header);
    expect(codes(out)).toEqual(['SALES_PRICE_LEVEL_NOT_ALLOWED']);
    expect(await readAllowedLevels(c as never, inp.header, defaultPriceLevel)).toEqual(
      new Set([2, 1]),
    );
  });

  it("reads the carried rows' source amounts and the auto-apply rule with its method", async () => {
    const c = client({
      chargeMaster: {
        findMany: jest.fn(async () => [
          { chgId: CHG, chgAutoApply: true, chgDefaultRate: d(0), chgMethod: 'PERCENT' },
        ]),
      },
      transactionChargeDetail: {
        findMany: jest.fn(async () => [{ cdId: 'src-cd', cdAmount: d(10) }]),
      },
    });
    const charges = [
      lockChargeOf({ cdChgId: CHG, cdType: 'DEDUCT', cdMethod: 'FIXED', cdRate: 0, cdAmount: 10 }),
      lockChargeOf({ cdChgId: 'other', cdType: 'DEDUCT', cdAmount: 10, cdSrcCdId: 'src-cd' }),
    ];
    shared.resolveSaleLinePrice.mockResolvedValue(priced());
    const out = await rateDiscountRefusals(c as never, 'u', input({ charges }));
    expect(c.transactionChargeDetail.findMany).toHaveBeenCalledWith({
      where: { cdId: { in: ['src-cd'] } },
      select: { cdId: true, cdAmount: true },
    });
    // the auto row typed 10 is refused; the carried 10 (= its source) is not
    expect(codes(out)).toEqual(['SALES_DISC_NOT_ALLOWED']);
  });

  it('a user with the right and a limit: the levels are never read', async () => {
    const c = client({
      userMaster: {
        findUnique: jest.fn(async () => ({ usrId: 'u', usrEditRate: true, usrMaxDiscPerc: d(5) })),
      },
    });
    const defaultPriceLevel = jest.fn(async () => 1);
    await rateDiscountRefusals(c as never, 'u', input({ lines: [line({ priceLevel: 3 })] }), {
      defaultPriceLevel,
    });
    expect(c.customer.findFirst).not.toHaveBeenCalled();
    expect(defaultPriceLevel).not.toHaveBeenCalled();
  });

  it("a qty slab that holds the line's qty adds its rate", async () => {
    shared.resolveSaleLinePrice.mockResolvedValue(priced());
    shared.rankedQtySlabs.mockResolvedValue([
      {
        iqpId: 's',
        companyId: null,
        branchId: null,
        partyId: null,
        priceLevel: null,
        fromQty: d(1),
        toQty: null,
        priceMode: 'P',
        discPct: d(10),
        flatOff: null,
        price: null,
        isTaxIncl: false,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        isActive: true,
      },
    ]);
    const n = await readLineNormals(client() as never, input().header, [line()], [0]);
    expect(n.get(0)!.rates.map(String)).toContain('90');
  });
});

describe('bill rate / discount lock — adapters and the throw', () => {
  it('throws 403 with every refusal, {line} and {max} on the detail', () => {
    let caught: unknown;
    try {
      throwRateDiscountRefusals([
        { code: 'SALES_RATE_CHANGE_NOT_ALLOWED', message: 'm1', field: 'items', line: 2 },
        { code: 'SALES_BILL_DISC_OVER_USER_MAX', message: 'm2', field: 'charges', max: '7.5' },
      ]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(403);
    expect((caught as HttpException).getResponse()).toMatchObject({
      errors: [
        { code: 'SALES_RATE_CHANGE_NOT_ALLOWED', field: 'items', line: 2 },
        { code: 'SALES_BILL_DISC_OVER_USER_MAX', field: 'charges', max: '7.5' },
      ],
    });
    expect(() => throwRateDiscountRefusals([])).not.toThrow();
  });

  it('reads DTO money as strings or numbers and takes the bill level when the line has none', () => {
    const l = lockLineOfDto(
      { sbiItemId: ITEM, sbiItemUnitId: UNIT, sbiRate: '12.50', sbiNetQty: 3, sbiMaxPrice: 0 },
      4,
      2,
    );
    expect(l).toMatchObject({ lineNo: 5, priceLevel: 2, mrp: null });
    expect(l.rate.toString()).toBe('12.5');
    expect(
      lockChargeOf({ cdType: 'DEDUCT', cdAmount: '5.5', cdRate: null }).amount.toString(),
    ).toBe('5.5');
    expect(
      lockHeaderOf({
        sbCompanyId: 'c',
        sbBranchId: 'b',
        sbBillDate: new Date('2026-11-20T00:00:00.000Z'),
        sbAddlDisc1: '1',
        sbCashDisc: 2,
      }),
    ).toMatchObject({ billDate: '2026-11-20', discAlterBase: false });
  });
});
