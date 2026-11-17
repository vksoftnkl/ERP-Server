import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createGuardContext } from '../posting/types/posting.types';
import {
  ageLevelOf,
  allocateDcDocNumber,
  assertNoCharges,
  checkDcMoney,
  daysBetween,
  dcAgeing,
  dcEwayStateOf,
  dcEwayVerdict,
  dcPartBMissing,
  dcReturnWindowOf,
  dcSourceOrdersOfLines,
  isPastReturnWindow,
  lockChallansOfLines,
  lockDcLines,
  dcTotals,
  nextRegisterVoucherNo,
  checkDcFreeLines,
  dcFreeTypeOf,
  dcOrderLineOf,
  orderLineFreeOf,
  type OrderLineFree,
  registerDocTaxability,
  registerLineTaxability,
  type RegisterLineTaxFigures,
} from './dc-common';

/** Challan plan §5.1 / §5.5 / §5.6 / G13 — what the challan and its return share. */

const D = (v: number | string) => new Prisma.Decimal(v);
const COMPANY = '019f0000-0000-7000-8000-0000000000e1';
const BRANCH = '019f0000-0000-7000-8000-0000000000e2';
const DEVICE = '019f0000-0000-7000-8000-0000000000e3';

const line = (over: Record<string, unknown> = {}) => ({
  sdiLineNo: 1,
  sdiDcQty: D(2),
  sdiFreeQty: D(0),
  sdiRate: D(500),
  sdiTaxPerc: D(18),
  sdiTaxableAmt: D(1000),
  sdiCgstAmt: D(90),
  sdiSgstAmt: D(90),
  sdiIgstAmt: D(0),
  sdiCessAmt: D(0),
  sdiTaxAmt: D(180),
  sdiNetAmt: D(1180),
  ...over,
});
const header = (over: Record<string, unknown> = {}) => ({
  sdcTaxableAmt: D(1000),
  sdcTaxAmt: D(180),
  sdcRoundOff: D(0),
  sdcDcAmt: D(1180),
  ...over,
});
const codes = (g: ReturnType<typeof createGuardContext>) => g.refusals.map((r) => r.field);

describe('checkDcMoney (G13, SALES_AMOUNT_MISMATCH)', () => {
  const run = (h = header(), lines = [line()]) => {
    const g = createGuardContext({ throwOnRefusal: false, dryRun: true });
    checkDcMoney(g, h, lines);
    return g;
  };

  it('passes figures that add up to the paisa', () => {
    expect(run().refusals).toEqual([]);
  });

  it('allows the one-paisa gap of two rounded GST halves', () => {
    // 333.33 × 5% = 16.6665 → 16.67; halves 8.33 + 8.33 = 16.66.
    const l = line({
      sdiTaxableAmt: D('333.33'),
      sdiTaxPerc: D(5),
      sdiCgstAmt: D('8.33'),
      sdiSgstAmt: D('8.33'),
      sdiTaxAmt: D('16.66'),
      sdiNetAmt: D('349.99'),
      sdiRate: D('166.665'),
    });
    expect(run(header({ sdcTaxableAmt: D('333.33'), sdcTaxAmt: D('16.66'), sdcDcAmt: D('349.99') }), [l]).refusals).toEqual([]);
  });

  it('refuses a line whose GST is not taxable × rate', () => {
    const g = run(header({ sdcTaxAmt: D(200), sdcDcAmt: D(1200) }), [
      line({ sdiCgstAmt: D(100), sdiSgstAmt: D(100), sdiTaxAmt: D(200), sdiNetAmt: D(1200) }),
    ]);
    expect(g.refusals).toEqual([
      expect.objectContaining({ code: 'SALES_AMOUNT_MISMATCH', field: 'items', line: 1 }),
    ]);
  });

  it('refuses a line amount that is not taxable + tax, and a taxable above qty × rate', () => {
    const g = run(header(), [line({ sdiNetAmt: D(1100), sdiRate: D(400) })]);
    expect(g.refusals[0].message).toContain('amount 1100.00 is not taxable + tax 1180.00');
    expect(g.refusals[0].message).toContain('taxable 1000.00 is above qty × rate 800.00');
  });

  it('refuses header totals the lines do not make (the old drafts with 0 totals)', () => {
    // 0 = 0 + 0 + 0 holds; the lines' 1000 / 180 do not.
    expect(codes(run(header({ sdcTaxableAmt: D(0), sdcTaxAmt: D(0), sdcDcAmt: D(0) })))).toEqual([
      'sdcTaxableAmt',
      'sdcTaxAmt',
    ]);
    expect(codes(run(header({ sdcDcAmt: D(1000) })))).toEqual(['sdcDcAmt']);
  });

  it('counts the round-off into the challan amount', () => {
    expect(run(header({ sdcRoundOff: D('0.40'), sdcDcAmt: D('1180.40') })).refusals).toEqual([]);
  });

  // P6 S2 (user 11-17): plain sums are EXACT; only taxable × rate keeps two paise.
  describe('exact sums (P6 S2)', () => {
    // 315 @ 5 % = 15.75.
    const l315 = (over: Record<string, unknown> = {}) =>
      line({
        sdiDcQty: D(3),
        sdiRate: D(105),
        sdiTaxPerc: D(5),
        sdiTaxableAmt: D(315),
        ...over,
      });
    const h315 = (tax: string, amt: string) =>
      header({ sdcTaxableAmt: D(315), sdcTaxAmt: D(tax), sdcDcAmt: D(amt) });

    it("accepts the Sales Bill's split: the tax rounded once, CGST half rounded, SGST the rest (7.88 + 7.87)", () => {
      const l = l315({ sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.87'), sdiTaxAmt: D('15.75'), sdiNetAmt: D('330.75') });
      expect(run(h315('15.75', '330.75'), [l]).refusals).toEqual([]);
    });

    it('keeps accepting the old consistent body: each half rounded (7.88 + 7.88, tax 15.76)', () => {
      const l = l315({ sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.88'), sdiTaxAmt: D('15.76'), sdiNetAmt: D('330.76') });
      expect(run(h315('15.76', '330.76'), [l]).refusals).toEqual([]);
    });

    it('refuses a line tax one paisa off its parts (7.88 + 7.88 sent as 15.75: the print-proof body)', () => {
      const l = l315({ sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.88'), sdiTaxAmt: D('15.75'), sdiNetAmt: D('330.76') });
      const g = run(h315('15.76', '330.76'), [l]);
      expect(g.refusals).toEqual([
        expect.objectContaining({ code: 'SALES_AMOUNT_MISMATCH', field: 'items', line: 1 }),
      ]);
      expect(g.refusals[0].message).toContain("tax 15.75 is not the components' 15.76");
    });

    it('counts the cess into the line tax, exactly', () => {
      const l = l315({
        sdiCgstAmt: D('7.88'),
        sdiSgstAmt: D('7.87'),
        sdiCessAmt: D('3.15'),
        sdiTaxAmt: D('18.90'),
        sdiNetAmt: D('333.90'),
      });
      expect(run(h315('18.90', '333.90'), [l]).refusals).toEqual([]);
      const off = l315({ ...l, sdiTaxAmt: D('15.75'), sdiNetAmt: D('333.90') });
      expect(run(h315('18.90', '333.90'), [off]).refusals).toHaveLength(1);
    });

    it('refuses a line amount one paisa off taxable + tax', () => {
      const l = l315({ sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.87'), sdiTaxAmt: D('15.75'), sdiNetAmt: D('330.76') });
      const g = run(h315('15.75', '330.75'), [l]);
      expect(g.refusals[0].message).toContain('amount 330.76 is not taxable + tax 330.75');
    });

    it('refuses header totals one paisa off the lines (taxable, tax and amount alike)', () => {
      const l = l315({ sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.87'), sdiTaxAmt: D('15.75'), sdiNetAmt: D('330.75') });
      expect(codes(run(header({ sdcTaxableAmt: D('315.01'), sdcTaxAmt: D('15.75'), sdcDcAmt: D('330.76') }), [l]))).toEqual([
        'sdcTaxableAmt',
      ]);
      expect(codes(run(h315('15.76', '330.76'), [l]))).toEqual(['sdcTaxAmt']);
      expect(codes(run(h315('15.75', '330.76'), [l]))).toEqual(['sdcDcAmt']);
    });

    // P6 R1 (user 11-17): one paisa, not two — 7.89 + 7.88 = 15.77 on 15.75 was filed 2 paise high.
    it('allows the parts one paisa off taxable × rate (two rounded halves), not two', () => {
      const one = l315({ sdiCgstAmt: D('7.88'), sdiSgstAmt: D('7.88'), sdiTaxAmt: D('15.76'), sdiNetAmt: D('330.76') });
      expect(run(h315('15.76', '330.76'), [one]).refusals).toEqual([]);
      const two = l315({ sdiCgstAmt: D('7.89'), sdiSgstAmt: D('7.88'), sdiTaxAmt: D('15.77'), sdiNetAmt: D('330.77') });
      const g = run(h315('15.77', '330.77'), [two]);
      expect(g.refusals).toEqual([expect.objectContaining({ code: 'SALES_AMOUNT_MISMATCH', field: 'items', line: 1 })]);
      expect(g.refusals[0].message).toContain('GST 15.77 is not 15.75 (taxable × rate)');
      const low = l315({ sdiCgstAmt: D('7.87'), sdiSgstAmt: D('7.86'), sdiTaxAmt: D('15.73'), sdiNetAmt: D('330.73') });
      expect(run(h315('15.73', '330.73'), [low]).refusals).toHaveLength(1);
    });

    it('passes IGST rounded once, the cess beside the GST, a free line and a nil-rated line', () => {
      // IGST 315 @ 5 % = 15.75 exact; cess 1 % = 3.15 sits outside the GST parts.
      const igst = l315({ sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiIgstAmt: D('15.75'), sdiCessAmt: D('3.15'), sdiTaxAmt: D('18.90'), sdiNetAmt: D('333.90') });
      expect(run(h315('18.90', '333.90'), [igst]).refusals).toEqual([]);
      // 333.33 @ 5 % = 16.6665 → 16.67: the bill's split 8.34 + 8.33 is exact.
      const odd = line({ sdiDcQty: D(1), sdiRate: D('333.33'), sdiTaxPerc: D(5), sdiTaxableAmt: D('333.33'), sdiCgstAmt: D('8.34'), sdiSgstAmt: D('8.33'), sdiTaxAmt: D('16.67'), sdiNetAmt: D('350.00') });
      expect(run(header({ sdcTaxableAmt: D('333.33'), sdcTaxAmt: D('16.67'), sdcDcAmt: D('350.00') }), [odd]).refusals).toEqual([]);
      const free = line({ sdiRate: D(0), sdiTaxPerc: D(18), sdiTaxableAmt: D(0), sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiTaxAmt: D(0), sdiNetAmt: D(0) });
      const nil = line({ sdiRate: D(50), sdiDcQty: D(1), sdiTaxPerc: D(0), sdiTaxableAmt: D(50), sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiTaxAmt: D(0), sdiNetAmt: D(50) });
      expect(run(header({ sdcTaxableAmt: D(50), sdcTaxAmt: D(0), sdcDcAmt: D(50) }), [free, nil]).refusals).toEqual([]);
    });
  });
});

// P6 S1 (decision 36): orders → challan header(s) → challan lines → stock.
describe('the challan lock helpers (P6 S1)', () => {
  const SDI_A = '019f0000-0000-7000-8000-0000000000a1';
  const SDI_B = '019f0000-0000-7000-8000-0000000000a2';
  const SO = '019f0000-0000-7000-8000-0000000000b1';
  const SO_HEAD = '019f0000-0000-7000-8000-0000000000b2';
  const SOI = '019f0000-0000-7000-8000-0000000000c1';
  const sqlOf = (q: jest.Mock, n: number) => (q.mock.calls[n][0] as string[]).join('?');

  it('locks the challan headers (sdc_id order) before the lines (sdi_id order), each id once', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await lockChallansOfLines(tx as never, [SDI_B, SDI_A, SDI_B, null, 'not-a-uuid']);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(sqlOf(tx.$queryRaw, 0)).toContain('FROM sales.sale_dc c');
    expect(sqlOf(tx.$queryRaw, 0)).toContain('ORDER BY c.sdc_id');
    expect(sqlOf(tx.$queryRaw, 0)).toContain('FOR UPDATE OF c');
    expect(sqlOf(tx.$queryRaw, 1)).toContain('ORDER BY sdi_id');
    expect(tx.$queryRaw.mock.calls[1][1]).toEqual([SDI_A, SDI_B]);
  });

  it('locks nothing for no challan lines', async () => {
    const tx = { $queryRaw: jest.fn() };
    await lockChallansOfLines(tx as never, []);
    await expect(dcSourceOrdersOfLines(tx as never, [undefined])).resolves.toEqual({ orderIds: [], orderLineIds: [] });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("reads the lines' order lines, their orders and the challan header's order, without a lock", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        { line_so_id: SO, soi_id: SOI, head_so_id: SO_HEAD },
        { line_so_id: SO, soi_id: SOI, head_so_id: null },
        { line_so_id: null, soi_id: null, head_so_id: null },
      ]),
    };
    await expect(dcSourceOrdersOfLines(tx as never, [SDI_A, SDI_B])).resolves.toEqual({
      orderIds: [SO, SO_HEAD],
      orderLineIds: [SOI],
    });
    expect(sqlOf(tx.$queryRaw, 0)).not.toContain('FOR UPDATE');
  });

  it("locks one challan's live lines in sdi_id order", async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await lockDcLines(tx as never, SDI_A, '2026-2027 ');
    expect(sqlOf(tx.$queryRaw, 0)).toContain('ORDER BY sdi_id');
    expect(sqlOf(tx.$queryRaw, 0)).toContain('FOR UPDATE');
    expect(tx.$queryRaw.mock.calls[0][2]).toBe('2026-2027');
  });
});

// 2026-11-16: an inter-state challan sent with CGST / SGST reached the register
// and chk_acc_voucher_doc_detail_supply_tax_logic answered a raw 500.
describe('checkDcMoney — the GST pair follows the supply nature (rule TAX_SPLIT)', () => {
  const igst = line({ sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiIgstAmt: D(180) });
  const run = (nature: 'INTRA' | 'INTER' | undefined, lines: Record<string, unknown>[]) => {
    const g = createGuardContext({ throwOnRefusal: false, dryRun: true });
    checkDcMoney(g, header(), lines, nature);
    return g;
  };

  it('refuses CGST / SGST on an inter-state line, coded, with the line and the nature', () => {
    const g = run('INTER', [line()]);
    expect(g.refusals).toEqual([
      expect.objectContaining({
        code: 'SALES_AMOUNT_MISMATCH',
        rule: 'TAX_SPLIT',
        line: 1,
        params: { n: 1, nature: 'INTER_STATE' },
      }),
    ]);
  });

  it('refuses a CGST rate alone on an inter-state line (the register checks rates too)', () => {
    const g = run('INTER', [line({ sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiIgstAmt: D(180), sdiCgstPerc: D(9) })]);
    expect(g.refusals.map((r) => r.rule)).toEqual(['TAX_SPLIT']);
  });

  it('passes IGST on an inter-state line, and CGST + SGST on an intra-state one', () => {
    expect(run('INTER', [igst]).refusals).toEqual([]);
    expect(run('INTRA', [line()]).refusals).toEqual([]);
  });

  it('refuses IGST on an intra-state line', () => {
    expect(run('INTRA', [igst]).refusals).toEqual([
      expect.objectContaining({ rule: 'TAX_SPLIT', params: { n: 1, nature: 'INTRA_STATE' } }),
    ]);
  });

  it('passes a tax-free line either way, and judges no split without a nature', () => {
    const free = line({ sdiTaxPerc: D(0), sdiCgstAmt: D(0), sdiSgstAmt: D(0), sdiTaxAmt: D(0), sdiNetAmt: D(1000) });
    const h = header({ sdcTaxAmt: D(0), sdcDcAmt: D(1000) });
    for (const nature of ['INTER', 'INTRA'] as const) {
      const g = createGuardContext({ throwOnRefusal: false, dryRun: true });
      checkDcMoney(g, h, [free], nature);
      expect(g.refusals).toEqual([]);
    }
    expect(run(undefined, [igst]).refusals).toEqual([]);
  });
});

describe('dcTotals (§8.2 /validate totals)', () => {
  it('sums lines, packages, kg (weight, else qty × unit kg), taxable, tax and value', () => {
    expect(
      dcTotals(header(), [line(), line({ sdiDcQty: D(3), sdiFreeQty: D(1), sdiWeightQty: D('12.5') })], () => D('2.25')),
    ).toEqual({
      lines: 2,
      pkgs: '6.000',
      weightKg: '17.000',
      taxable: '2000.00',
      tax: '360.00',
      value: '2360.00',
    });
  });
});

describe('ageing (§5.6)', () => {
  const limits = { amberDays: 7, oldDays: 30, windowDays: 180 };

  it.each([
    ['SUPPLY', 7, ''],
    ['SUPPLY', 8, 'AMBER'],
    ['SUPPLY', 30, 'AMBER'],
    ['SUPPLY', 31, 'RED'],
    ['APPROVAL', 31, ''],
    ['JOB_WORK', 181, 'RED'],
  ])('%s at %p days is %p', (purpose, days, level) => {
    expect(ageLevelOf(purpose, days, limits, 'POSTED')).toBe(level);
  });

  it('never ages a draft, and has no red without a statutory window', () => {
    expect(ageLevelOf('SUPPLY', 90, limits, 'DRAFT')).toBe('');
    expect(ageLevelOf('APPROVAL', 999, { ...limits, windowDays: null }, 'POSTED')).toBe('');
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-11-01', '2026-11-16')).toBe(15);
    expect(daysBetween('2026-11-20', '2026-11-16')).toBe(0);
  });

  it('reads the company settings and the DC_RETURN_WINDOW_DAYS limit', async () => {
    const salesContext = {
      values: jest.fn().mockResolvedValue({ 'sales.delivery_amber_days': '3', 'sales.delivery_old_days': '10' }),
    };
    const statutory = { limit: jest.fn().mockResolvedValue({ value: '180.0000' }) };

    await expect(
      dcAgeing(salesContext, statutory as never, {
        companyId: COMPANY,
        branchId: BRANCH,
        purpose: 'SUPPLY',
        docDate: '2026-11-11',
        status: 'POSTED',
        today: '2026-11-16',
      }),
    ).resolves.toEqual({
      ageDays: 5,
      ageLevel: 'AMBER',
      returnWindow: { days: 180, source: 'SHIPPED', effectiveFrom: null },
      pastWindow: false,
    });
    // Effective on the CHALLAN's date, as grids 116 / 220 read it (decision 38).
    expect(statutory.limit).toHaveBeenCalledWith(COMPANY, 'DC_RETURN_WINDOW_DAYS', '2026-11-11');
  });

  // P6 N2 (user 11-17): nothing out on the challan = no age level, as grid 116.
  it('answers no age level once nothing is open, and the level when open or not told', async () => {
    const q = {
      companyId: COMPANY,
      branchId: BRANCH,
      purpose: 'SUPPLY',
      docDate: '2026-10-01',
      status: 'POSTED',
      today: '2026-11-16',
    };
    const ctx = { values: jest.fn().mockResolvedValue({}) };
    const statutory = { limit: jest.fn().mockResolvedValue(null) } as never;
    await expect(dcAgeing(ctx, statutory, { ...q, open: false })).resolves.toMatchObject({ ageDays: 46, ageLevel: '' });
    await expect(dcAgeing(ctx, statutory, { ...q, open: true })).resolves.toMatchObject({ ageLevel: 'RED' });
    await expect(dcAgeing(ctx, statutory, q)).resolves.toMatchObject({ ageLevel: 'RED' });
  });

  // P3b — the return screen's "180 days · per company" and its past-window flag.
  const ageingOf = async (
    purpose: string,
    docDate: string,
    window: Record<string, unknown> | null,
    status = 'POSTED',
  ) =>
    dcAgeing(
      { values: jest.fn().mockResolvedValue({}) },
      { limit: jest.fn().mockResolvedValue(window) } as never,
      { companyId: COMPANY, branchId: BRANCH, purpose, docDate, status, today: '2026-11-16' },
    );

  it('names the window and its source, and flags an approval challan past it', async () => {
    const companyRow = { value: 90, isCompanyOverride: true, effectiveFrom: '2026-04-01' };
    await expect(ageingOf('APPROVAL', '2026-08-01', companyRow)).resolves.toEqual({
      ageDays: 107,
      ageLevel: 'RED',
      returnWindow: { days: 90, source: 'COMPANY', effectiveFrom: '2026-04-01' },
      pastWindow: true,
    });
    const shipped = { value: 180, isCompanyOverride: false, effectiveFrom: '2017-07-01' };
    await expect(ageingOf('JOB_WORK', '2026-08-01', shipped)).resolves.toMatchObject({
      returnWindow: { days: 180, source: 'SHIPPED', effectiveFrom: '2017-07-01' },
      pastWindow: false,
    });
  });

  it('is never past the window for a supply, a draft or with no row (null, no fallback)', async () => {
    const shipped = { value: 30, isCompanyOverride: false, effectiveFrom: '2017-07-01' };
    // A SUPPLY 107 days old is RED by the old-days rule, but the window is not its.
    await expect(ageingOf('SUPPLY', '2026-08-01', shipped)).resolves.toMatchObject({
      ageLevel: 'RED',
      returnWindow: { days: 30 },
      pastWindow: false,
    });
    await expect(ageingOf('APPROVAL', '2026-08-01', shipped, 'DRAFT')).resolves.toMatchObject({
      ageLevel: '',
      pastWindow: false,
    });
    await expect(ageingOf('APPROVAL', '2020-01-01', null)).resolves.toMatchObject({
      ageLevel: '',
      returnWindow: null,
      pastWindow: false,
    });
  });
});

describe('the return window (decision 38, user 11-16)', () => {
  it.each([
    ['APPROVAL', 181, 180, 'POSTED', true],
    ['JOB_WORK', 181, 180, 'POSTED', true],
    ['OTHER', 181, 180, 'POSTED', true],
    ['APPROVAL', 180, 180, 'POSTED', false],
    ['SUPPLY', 400, 180, 'POSTED', false],
    [null, 400, 180, 'POSTED', false],
    ['APPROVAL', 400, null, 'POSTED', false],
    ['APPROVAL', 400, 180, 'DRAFT', false],
    ['APPROVAL', 400, 180, 'CANCELLED', false],
  ])('%s at %p days, window %p, %s: past = %p', (purpose, days, window, status, past) => {
    expect(isPastReturnWindow(purpose, days, window, status)).toBe(past);
  });

  it('reads DC_RETURN_WINDOW_DAYS on the challan date, with its source; null without a row', async () => {
    const statutory = {
      limit: jest
        .fn()
        .mockResolvedValueOnce({ value: 90, isCompanyOverride: true, effectiveFrom: '2026-04-01' })
        .mockResolvedValueOnce(null),
    };
    await expect(dcReturnWindowOf(statutory as never, COMPANY, '2026-05-01')).resolves.toEqual({
      days: 90,
      source: 'COMPANY',
      effectiveFrom: '2026-04-01',
    });
    await expect(dcReturnWindowOf(statutory as never, COMPANY, '2026-05-02')).resolves.toBeNull();
    expect(statutory.limit).toHaveBeenNthCalledWith(1, COMPANY, 'DC_RETURN_WINDOW_DAYS', '2026-05-01');
  });
});

describe('e-way facts (P3b)', () => {
  const tn = { value: 100000, appliesTo: '33', isCompanyOverride: false, effectiveFrom: '2018-06-02' };
  const client = () =>
    ({
      $queryRaw: jest.fn().mockResolvedValue([
        { code: '33', name: 'Tamil Nadu' },
        { code: '29', name: 'Karnataka' },
      ]),
    }) as unknown as Prisma.TransactionClient;

  it('judges an intra-state challan on the POS state row and names both states', async () => {
    const statutory = { ewayApplicable: jest.fn().mockResolvedValue({ limit: tn, applicable: false }) };
    const c = client();
    await expect(
      dcEwayVerdict(c, statutory as never, {
        companyId: COMPANY,
        companyStateCode: '33',
        posStateCode: '33',
        value: D('892.5'),
        docDate: '2026-11-16',
      }),
    ).resolves.toEqual({
      needed: false,
      supplyNature: 'INTRA_STATE',
      fromStateCode: '33',
      fromStateName: 'Tamil Nadu',
      toStateCode: '33',
      toStateName: 'Tamil Nadu',
      posFromCompany: false,
      value: '892.50',
      onDate: '2026-11-16',
      limit: { value: '100000.00', appliesTo: '33', source: 'SHIPPED', effectiveFrom: '2018-06-02' },
    });
    // The guard's own call: value as a number, the challan date, the POS as the state.
    expect(statutory.ewayApplicable).toHaveBeenCalledWith(
      COMPANY,
      892.5,
      '2026-11-16',
      { interState: false, stateCode: '33' },
      c,
    );
  });

  it('is inter-state when the POS differs, and says so when the limit is the company row', async () => {
    const own = { value: 75000, appliesTo: 'INTER_STATE', isCompanyOverride: true, effectiveFrom: '2026-04-01' };
    const statutory = { ewayApplicable: jest.fn().mockResolvedValue({ limit: own, applicable: true }) };
    const facts = await dcEwayVerdict(client(), statutory as never, {
      companyId: COMPANY,
      companyStateCode: '33',
      posStateCode: '29',
      value: '141600',
      docDate: '2026-11-16',
    });
    expect(facts).toMatchObject({
      needed: true,
      supplyNature: 'INTER_STATE',
      toStateCode: '29',
      toStateName: 'Karnataka',
      limit: { value: '75000.00', appliesTo: 'INTER_STATE', source: 'COMPANY' },
    });
    expect(statutory.ewayApplicable.mock.calls[0][3]).toEqual({ interState: true, stateCode: '29' });
  });

  it('answers limit null (never a constant) when no row is in force', async () => {
    const statutory = { ewayApplicable: jest.fn().mockResolvedValue({ limit: null, applicable: false }) };
    const facts = await dcEwayVerdict(client(), statutory as never, {
      companyId: COMPANY,
      companyStateCode: '33',
      posStateCode: '33',
      value: '999999',
      docDate: '2026-11-16',
    });
    expect(facts).toMatchObject({ needed: false, supplyNature: 'INTRA_STATE', limit: null });
  });

  // User 11-16: a blank POS is an intra-state move to the COMPANY's state, so
  // that state's own floor applies (TN 1,00,000, not the 50,000 default).
  it('judges a blank POS by the company state and says so (posFromCompany)', async () => {
    const statutory = { ewayApplicable: jest.fn().mockResolvedValue({ limit: tn, applicable: false }) };
    const c = client();
    const facts = await dcEwayVerdict(c, statutory as never, {
      companyId: COMPANY,
      companyStateCode: '33',
      posStateCode: '  ',
      value: '66150',
      docDate: '2026-11-16',
    });
    expect(statutory.ewayApplicable).toHaveBeenCalledWith(
      COMPANY,
      66150,
      '2026-11-16',
      { interState: false, stateCode: '33' },
      c,
    );
    expect(facts).toMatchObject({
      needed: false,
      supplyNature: 'INTRA_STATE',
      toStateCode: '33',
      toStateName: 'Tamil Nadu',
      posFromCompany: true,
      limit: { value: '100000.00', appliesTo: '33' },
    });
  });

  it('reads the e-way state from the POS, else the company state, else none', () => {
    expect(dcEwayStateOf('33', ' 29 ')).toEqual({ stateCode: '29', posFromCompany: false });
    expect(dcEwayStateOf('33', null)).toEqual({ stateCode: '33', posFromCompany: true });
    expect(dcEwayStateOf(' 33 ', '')).toEqual({ stateCode: '33', posFromCompany: true });
    expect(dcEwayStateOf(null, null)).toEqual({ stateCode: null, posFromCompany: false });
  });

  it('meets Part-B with a transporter / LR or a road vehicle, not with neither', () => {
    expect(dcPartBMissing(null, {})).toBe(true);
    expect(dcPartBMissing({ mode: 'ROAD' }, { sdcVehicleNo: ' TN38ZT0001 ' })).toBe(false);
    expect(dcPartBMissing(null, { sdcVehicleId: 'veh-1' })).toBe(false);
    expect(dcPartBMissing({ mode: 'RAIL' }, { sdcVehicleNo: 'TN38ZT0001' })).toBe(true);
    expect(dcPartBMissing({ mode: 'RAIL', lrNo: 'LR-1' }, {})).toBe(false);
    expect(dcPartBMissing({ transporterName: 'VRL' }, {})).toBe(false);
  });
});

describe('assertNoCharges (N2)', () => {
  it('lets absent or empty charges through and refuses any row with 422', () => {
    expect(() => assertNoCharges(undefined)).not.toThrow();
    expect(() => assertNoCharges([])).not.toThrow();
    try {
      assertNoCharges([{ cdChargeId: 'x' }]);
      throw new Error('expected a refusal');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(422);
      expect((e as HttpException).getResponse()).toMatchObject({
        errors: [{ field: 'charges', code: 'SALES_DC_CHARGES_NOT_ALLOWED' }],
      });
    }
  });
});

describe('nextRegisterVoucherNo', () => {
  it('runs the register serial per company, branch, year and type under a lock', async () => {
    const queryRaw = jest.fn(async (strings: TemplateStringsArray) =>
      strings.join('?').includes('MAX(gdr_voucher_no)') ? [{ n: 5n }] : [{ locked: 1 }],
    );

    await expect(
      nextRegisterVoucherNo({ $queryRaw: queryRaw } as never, {
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: '2026-2027',
        voucherTypeId: 19,
      }),
    ).resolves.toBe(5n);
    expect(queryRaw.mock.calls[0][0].join('?')).toContain('pg_advisory_xact_lock');
    expect(queryRaw.mock.calls[1].slice(1)).toEqual([COMPANY, BRANCH, '2026-2027', 19]);
  });
});

describe('allocateDcDocNumber', () => {
  it('refuses a device id that is not a registered PC with 422 STOCK_DEVICE_NOT_FOUND', async () => {
    await expect(
      allocateDcDocNumber({} as never, {
        vchrTypeId: 19,
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: '2026-2027',
        deviceId: 'till-1',
        documentDate: new Date(),
        field: 'sdcDeviceId',
      }),
    ).rejects.toMatchObject({
      response: { errors: [{ field: 'sdcDeviceId', code: 'STOCK_DEVICE_NOT_FOUND' }] },
    });
  });

  it("draws the device's own series of the type with its code", async () => {
    const tx = {
      deviceMaster: {
        findFirst: jest.fn().mockResolvedValue({ devCode: 'D14', devIsActive: true, devIsBlocked: false }),
      },
      accVoucherType: {
        findFirst: jest.fn().mockResolvedValue({
          vchrTypeId: 19,
          vchrNoPrefix: 'DC{FYC}{DV}-',
          vchrNoSuffix: null,
          vchrNoWidth: 5,
          vchrResetFreq: 'YEARLY',
          vchrGstDocNo: true,
        }),
      },
      accVoucherSeq: {
        findFirst: jest.fn().mockResolvedValue({
          id: 's1',
          voucherPrefix: 'DC2627D14-',
          voucherSuffix: null,
          noWidth: 5,
          lastNo: 2n,
          isActive: true,
          isDeleted: false,
          vchrTypeId: 19,
        }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ id: 's1', voucherPrefix: 'DC2627D14-', voucherSuffix: null, noWidth: 5, lastNo: 3n, vchrTypeId: 19 })
          .mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]),
    };

    await expect(
      allocateDcDocNumber(tx as never, {
        vchrTypeId: 19,
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: '2026-2027',
        deviceId: DEVICE,
        documentDate: new Date('2026-11-16T00:00:00Z'),
        field: 'sdcDeviceId',
      }),
    ).resolves.toEqual({ lastNo: 3n, refno: 'DC2627D14-00003' });
    expect(tx.accVoucherSeq.findFirst.mock.calls[0][0].where).toMatchObject({ deviceCode: 'D14' });
  });
});

// P3 fix 2026-11-17 — the register files a line TAXABLE whenever it carries a GST
// rate or tax (chk_acc_voucher_doc_detail_non_taxable_zero: a non-TAXABLE row
// must hold 0 in every rate and amount), and the document from its lines.
describe('register taxability (the Sales Bill\'s rule)', () => {
  const figures = (over: Partial<RegisterLineTaxFigures> = {}): RegisterLineTaxFigures => ({
    totalTaxRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    cessRate: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    cessAmount: 0,
    ...over,
  });

  it('files a FREE line (18 % = 9/9, no tax) TAXABLE', () => {
    expect(registerLineTaxability(figures({ totalTaxRate: 18, cgstRate: 9, sgstRate: 9 }))).toBe('TAXABLE');
  });

  it('files a FREE inter-state line (IGST 18 %, no tax) TAXABLE', () => {
    expect(registerLineTaxability(figures({ totalTaxRate: 18, igstRate: 18 }))).toBe('TAXABLE');
  });

  it('files a paid taxed line TAXABLE', () => {
    expect(
      registerLineTaxability(figures({ totalTaxRate: 5, cgstRate: 2.5, sgstRate: 2.5, cgstAmount: 5, sgstAmount: 5 })),
    ).toBe('TAXABLE');
  });

  it('reads every figure the CHECK reads: a cess rate alone, or a stray amount alone, is TAXABLE', () => {
    expect(registerLineTaxability(figures({ cessRate: 1 }))).toBe('TAXABLE');
    expect(registerLineTaxability(figures({ cessAmount: 0.5 }))).toBe('TAXABLE');
    expect(registerLineTaxability(figures({ sgstAmount: 0.01 }))).toBe('TAXABLE');
  });

  it('files a 0 % / nil-rated / exempt item EXEMPT (every rate and amount 0)', () => {
    expect(registerLineTaxability(figures())).toBe('EXEMPT');
  });

  it('files the document TAXABLE, EXEMPT or MIXED from its lines', () => {
    const t = { taxability: 'TAXABLE' as const };
    const e = { taxability: 'EXEMPT' as const };
    expect(registerDocTaxability([t, t])).toBe('TAXABLE');
    expect(registerDocTaxability([e, e])).toBe('EXEMPT');
    expect(registerDocTaxability([t, e])).toBe('MIXED');
    expect(registerDocTaxability([])).toBe('EXEMPT');
  });
});

// User 2026-11-17 — a challan line's Free flag comes only from its order line.
describe('free lines (user 11-17)', () => {
  const SOI = '019f0000-0000-7000-8000-0000000000a1';
  const free = (over: Record<string, unknown> = {}) => ({
    sdiLineNo: 1,
    sdiSrcDocType: 'SALES_ORDER',
    sdiSrcItemId: SOI,
    sdiIsFree: true,
    sdiRate: D(0),
    sdiTaxableAmt: D(0),
    ...over,
  });
  const orders = (isFree: boolean, freeType: string | null = isFree ? 'SCHEME' : null) =>
    new Map<string, OrderLineFree>([[SOI, { isFree, freeType }]]);
  const judged = (lines: Record<string, unknown>[], o: Map<string, OrderLineFree>) => {
    const g = createGuardContext({ throwOnRefusal: false });
    checkDcFreeLines(g, lines, o);
    return g.refusals.map((r) => `${r.code}:${r.rule}:${r.line}`);
  };

  it('names the order line only for a SALES_ORDER source with a line id', () => {
    expect(dcOrderLineOf(free())).toBe(SOI);
    expect(dcOrderLineOf(free({ sdiSrcDocType: 'QUOTATION' }))).toBeNull();
    expect(dcOrderLineOf(free({ sdiSrcItemId: null }))).toBeNull();
  });

  it('passes a free line of a free order line, and paid lines either way', () => {
    expect(judged([free()], orders(true))).toEqual([]);
    expect(judged([free({ sdiIsFree: false, sdiRate: D(5), sdiTaxableAmt: D(5) })], orders(false))).toEqual([]);
    expect(judged([{ sdiLineNo: 2, sdiRate: D(5) }], new Map())).toEqual([]);
  });

  it('refuses a free line with no order line, a flag unlike its order line\'s, and a priced free line', () => {
    expect(judged([free({ sdiSrcDocType: null, sdiSrcItemId: null })], new Map())).toEqual([
      'SALES_AMOUNT_MISMATCH:FREE_LINE:1',
    ]);
    expect(judged([free()], orders(false))).toEqual(['SALES_AMOUNT_MISMATCH:FREE_LINE:1']);
    expect(judged([free({ sdiIsFree: false })], orders(true))).toEqual(['SALES_AMOUNT_MISMATCH:FREE_LINE:1']);
    expect(judged([free({ sdiRate: D('0.01') })], orders(true))).toEqual(['SALES_AMOUNT_MISMATCH:FREE_LINE:1']);
    expect(judged([free({ sdiTaxableAmt: D(1) })], orders(true))).toEqual(['SALES_AMOUNT_MISMATCH:FREE_LINE:1']);
  });

  it('leaves a missing order line to SALES_DC_LINE_OVER_ORDER', () => {
    expect(judged([free({ sdiIsFree: false })], new Map())).toEqual([]);
  });

  it("stores the order line's free type only when both are free", () => {
    expect(dcFreeTypeOf(free(), orders(true, 'SAMPLE'))).toBe('SAMPLE');
    expect(dcFreeTypeOf(free({ sdiIsFree: false }), orders(true, 'SAMPLE'))).toBeNull();
    expect(dcFreeTypeOf(free(), orders(false))).toBeNull();
    expect(dcFreeTypeOf(free({ sdiSrcItemId: null }), orders(true))).toBeNull();
  });

  it('reads the flags of the named order lines once, and asks nothing for none', async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ soi_id: SOI, soi_is_free: true, soi_free_type: 'REPLACEMENT' }]),
    };
    await expect(orderLineFreeOf(tx as never, [SOI, SOI])).resolves.toEqual(
      new Map([[SOI, { isFree: true, freeType: 'REPLACEMENT' }]]),
    );
    expect((tx.$queryRaw.mock.calls[0] as unknown[])[1]).toEqual([SOI]);
    await expect(orderLineFreeOf(tx as never, [])).resolves.toEqual(new Map());
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
