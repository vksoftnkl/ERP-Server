import { Prisma } from '@prisma/client';
import { BillLifecycleService, refuseFreeMismatch } from './bill-lifecycle.service';
import {
  applyChallanSourceRule,
  distinctChallanCount,
  headerSourceCleared,
  snapshotFromDto,
  type BillSnapshot,
} from './bill-snapshot';
import { createGuardContext, type SalesGuardContext } from '../posting/types/posting.types';
import type { SaveBillDto } from './dto/save-bill.dto';

/**
 * N1 — several challans on one Sales Bill (challan plan
 * Shared/Prathap/sales/plan-dc-dc-return-2026-11-16.md §5.4, decisions 24–29,
 * 36, 37; Q-N1). guardSources: the challan lines locked FOR UPDATE in sdi_id
 * order, then POSTED / BRANCH / PARTY / GSTIN / POS / CONVERT / open in base
 * units (Decimal, this bill left out). The header source is NULL for two or
 * more challans.
 */

const CO = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BR = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const CUST = '01a1e000-0000-7000-8000-0000000000c1';
const CUST2 = '01a1e000-0000-7000-8000-0000000000c2';
const DC1 = '01a1e000-0000-7000-8000-0000000000d1';
const DC2 = '01a1e000-0000-7000-8000-0000000000d2';
const L1 = '01a1e000-0000-7000-8000-0000000001a1';
const L2 = '01a1e000-0000-7000-8000-0000000001a2';
const L3 = '01a1e000-0000-7000-8000-0000000001a3';
const BILL = '01a1e000-0000-7000-8000-0000000000b1';
const D = (v: string | number) => new Prisma.Decimal(v);

type Row = Record<string, unknown>;

/** One challan line as the guard's SELECT returns it. */
function dcRow(over: Row = {}): Row {
  return {
    sdi_id: L1,
    sdi_line_no: 1,
    sdi_dc_qty: D('10.000'),
    sdi_to_base_factor: D('1.000000'),
    billed_base: D(0),
    returned_base: D(0),
    sdc_id: DC1,
    sdc_dc_refno: 'DC2627D14-00001',
    sdc_purpose: 'SUPPLY',
    sdc_status: 'POSTED',
    sdc_company_id: CO,
    sdc_branch_id: BR,
    sdc_cust_id: CUST,
    sdc_cust_name: 'ZTA-DC-CUST',
    sdc_cust_gstin: '33AAAAA0000A1Z5',
    sdc_pos_stcd: '33',
    ...over,
  };
}

function snapOf(
  lines: Array<{ srcItemId: string; srcDocId?: string; qty: number; toBaseFactor?: number | null }>,
  over: Partial<BillSnapshot> = {},
): BillSnapshot {
  return {
    sbId: null,
    companyId: CO,
    branchId: BR,
    custId: CUST,
    custGstin: '33AAAAA0000A1Z5',
    posStcd: '33',
    srcDocType: null,
    srcDocId: null,
    srcDocYear: null,
    items: lines.map((l, idx) => ({
      lineNo: idx + 1,
      srcDocType: 'DELIVERY_CHALLAN',
      srcDocId: l.srcDocId ?? DC1,
      srcDocYear: '2026-2027',
      srcItemId: l.srcItemId,
      qty: l.qty,
      toBaseFactor: l.toBaseFactor ?? 1,
    })),
    ...over,
  } as unknown as BillSnapshot;
}

/** A tx whose $queryRaw answers the lock with [] and the guard's SELECT with `rows`. */
function txOf(rows: Row[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const $queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    calls.push({ sql, values });
    if (/FOR UPDATE/.test(sql) && /sale_dc_item/.test(sql) && !/billed_base/.test(sql)) {
      return Promise.resolve([]);
    }
    if (/billed_base/.test(sql)) {
      return Promise.resolve(rows);
    }
    return Promise.resolve([]);
  });
  return { tx: { $queryRaw } as unknown as Prisma.TransactionClient, calls };
}

async function run(snap: BillSnapshot, rows: Row[]): Promise<{ g: SalesGuardContext; calls: { sql: string; values: unknown[] }[] }> {
  const svc = Object.create(BillLifecycleService.prototype) as unknown as {
    guardSources: (
      tx: Prisma.TransactionClient,
      snap: BillSnapshot,
      g: SalesGuardContext,
      allowOverOrder: boolean,
    ) => Promise<void>;
  };
  const { tx, calls } = txOf(rows);
  const g = createGuardContext({ throwOnRefusal: false });
  await svc.guardSources(tx, snap, g, false);
  return { g, calls };
}

const codes = (g: SalesGuardContext) => g.refusals.map((r) => `${r.code}${r.rule ? `:${r.rule}` : ''}`);

describe('Sales Bill guardSources — challans (N1)', () => {
  it('locks the challan lines FOR UPDATE in sdi_id order before it reads them', async () => {
    const { calls } = await run(
      snapOf([
        { srcItemId: L3, qty: 1 },
        { srcItemId: L1, qty: 1 },
      ]),
      [dcRow({ sdi_id: L1 }), dcRow({ sdi_id: L3, sdi_line_no: 3 })],
    );
    const lock = calls.findIndex((c) => /FOR UPDATE/.test(c.sql) && /ORDER BY sdi_id/.test(c.sql));
    const read = calls.findIndex((c) => /billed_base/.test(c.sql));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(read).toBeGreaterThan(lock);
    expect(calls[lock].values[0]).toEqual([L1, L3]);
  });

  // P6 S1 (decision 36): orders → challan headers → challan lines → stock. The
  // bill re-derives its challans' orders late (afterStatusChange); a challan
  // cancel or a DC return holds those orders first, so the bill takes them first.
  it('locks the challans\' source orders, then the challan headers, then the lines, before reading them', async () => {
    const SO = '01a1e000-0000-7000-8000-0000000005a1';
    const SOI = '01a1e000-0000-7000-8000-0000000005b1';
    const svc = Object.create(BillLifecycleService.prototype) as unknown as {
      guardSources: (tx: Prisma.TransactionClient, snap: BillSnapshot, g: SalesGuardContext, allow: boolean) => Promise<void>;
    };
    const calls: { sql: string; values: unknown[] }[] = [];
    const tx = {
      $queryRaw: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        calls.push({ sql, values });
        if (/AS line_so_id/.test(sql)) return Promise.resolve([{ line_so_id: SO, soi_id: SOI, head_so_id: null }]);
        if (/billed_base/.test(sql)) return Promise.resolve([dcRow()]);
        return Promise.resolve([]);
      }),
    } as unknown as Prisma.TransactionClient;
    await svc.guardSources(tx, snapOf([{ srcItemId: L1, qty: 1 }]), createGuardContext({ throwOnRefusal: false }), false);

    const orders = calls.findIndex((c) => /FOR UPDATE OF h/.test(c.sql));
    const heads = calls.findIndex((c) => /FOR UPDATE OF c/.test(c.sql));
    const lines = calls.findIndex((c) => /FOR UPDATE/.test(c.sql) && /ORDER BY sdi_id/.test(c.sql));
    const read = calls.findIndex((c) => /billed_base/.test(c.sql));
    expect(calls[orders].values).toEqual([[SO], [SOI]]);
    expect(orders).toBeLessThan(heads);
    expect(heads).toBeLessThan(lines);
    expect(lines).toBeLessThan(read);
  });

  it('cancel / amend (lockBillOrders): the challans\' orders with the bill\'s own, then headers, then lines, before the unwind', async () => {
    const SO = '01a1e000-0000-7000-8000-0000000005a1';
    const SOI = '01a1e000-0000-7000-8000-0000000005b1';
    const calls: string[] = [];
    const values: unknown[][] = [];
    const queryRaw = jest.fn((strings: TemplateStringsArray, ...v: unknown[]) => {
      const sql = strings.join('?');
      calls.push(sql);
      values.push(v);
      return Promise.resolve(/AS line_so_id/.test(sql) ? [{ line_so_id: SO, soi_id: SOI, head_so_id: null }] : []);
    });
    const tx = {
      $queryRaw: queryRaw,
      saleBillItem: {
        findMany: jest.fn().mockResolvedValue([{ sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcDocId: DC1, sbiSrcItemId: L1 }]),
      },
    } as unknown as Prisma.TransactionClient;
    const unwind = jest.fn().mockRejectedValue(new Error('stop here'));
    const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
    Object.assign(svc, { assertUnwindable: jest.fn(), unwind });

    await expect(
      (svc as unknown as { cancelIn: (...a: unknown[]) => Promise<unknown> }).cancelIn(
        tx,
        { sbId: BILL, sbAccYear: '2026-2027', sbStatus: 'POSTED', sbSrcDocType: null, sbSrcDocId: null },
        { actor: 'a', actorName: 'A' },
        'why',
        new Date(),
      ),
    ).rejects.toThrow('stop here');

    const orders = calls.findIndex((q) => /FOR UPDATE OF h/.test(q));
    const heads = calls.findIndex((q) => /FOR UPDATE OF c/.test(q));
    const lines = calls.findIndex((q) => /FOR UPDATE/.test(q) && /ORDER BY sdi_id/.test(q));
    expect(values[orders]).toEqual([[SO], [SOI]]);
    expect(orders).toBeLessThan(heads);
    expect(heads).toBeLessThan(lines);
    expect(queryRaw.mock.invocationCallOrder[lines]).toBeLessThan(unwind.mock.invocationCallOrder[0]);
  });

  // P6 R3 (re-review 11-17): the amend resolved its new lines only inside
  // applySaveInTx, after the unwind — a line naming its challan line by
  // document + line number got that challan locked after the stock writes.
  it('amend: resolves the new lines first, so a challan named by document + line number is locked before the unwind', async () => {
    const SO = '01a1e000-0000-7000-8000-0000000005a1';
    const calls: string[] = [];
    const values: unknown[][] = [];
    const queryRaw = jest.fn((strings: TemplateStringsArray, ...v: unknown[]) => {
      const sql = strings.join('?');
      calls.push(sql);
      values.push(v);
      if (/sdi_dc_id = ANY/.test(sql) && /AS doc_id/.test(sql)) {
        return Promise.resolve([{ id: L2, doc_id: DC2, line_no: 1, acc_year: '2026-2027' }]);
      }
      if (/AS line_so_id/.test(sql)) return Promise.resolve([{ line_so_id: SO, soi_id: null, head_so_id: null }]);
      return Promise.resolve([]);
    });
    const tx = { $queryRaw: queryRaw, saleBillItem: { findMany: jest.fn().mockResolvedValue([]) } };
    const unwind = jest.fn().mockRejectedValue(new Error('stop here'));
    const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
    Object.assign(svc, {
      prisma: { $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
      bills: {
        lockHeader: jest.fn().mockResolvedValue({
          sbId: BILL, sbAccYear: '2026-2027', sbStatus: 'POSTED', sbCompanyId: CO, sbBranchId: BR, sbRevisionNo: 1, sbDocRegisterId: null,
        }),
        getById: jest.fn().mockResolvedValue({}),
      },
      salesContext: { resolve: jest.fn().mockResolvedValue({ actor: 'a', rights: { amend: true }, settings: { allowPostedAmend: true } }) },
      assertUnwindable: jest.fn(),
      unwind,
    });
    const items = [{ sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcDocId: DC2, sbiSrcDocLineNo: 1 }];

    await expect(
      (svc as unknown as { amend: (d: unknown) => Promise<unknown> }).amend({
        sbId: BILL, sbCompanyId: CO, sbBranchId: BR, sbAccYear: '2026-2027', baseRevision: 1, editRemark: 'x', items,
      }),
    ).rejects.toThrow('stop here');

    expect(items[0]).toMatchObject({ sbiSrcItemId: L2, sbiSrcDocId: DC2 });
    const orders = calls.findIndex((q) => /FOR UPDATE OF h/.test(q));
    const heads = calls.findIndex((q) => /FOR UPDATE OF c/.test(q));
    const lines = calls.findIndex((q) => /FOR UPDATE/.test(q) && /ORDER BY sdi_id/.test(q));
    expect(values[orders][0]).toEqual([SO]);
    expect(values[heads]).toEqual([[L2]]);
    expect(orders).toBeLessThan(heads);
    expect(heads).toBeLessThan(lines);
    expect(queryRaw.mock.invocationCallOrder[lines]).toBeLessThan(unwind.mock.invocationCallOrder[0]);
  });

  it('passes three lines of one customer, branch, GST No and place of supply within open', async () => {
    const { g } = await run(
      snapOf([
        { srcItemId: L1, qty: 4 },
        { srcItemId: L2, srcDocId: DC2, qty: 5 },
      ]),
      [dcRow(), dcRow({ sdi_id: L2, sdc_id: DC2, sdc_dc_refno: 'DC2627D14-00002' })],
    );
    expect(g.refusals).toEqual([]);
  });

  it('PARTY: another customer\'s challan, once per challan, with dc / party params', async () => {
    const { g } = await run(
      snapOf([
        { srcItemId: L1, qty: 1 },
        { srcItemId: L2, qty: 1 },
      ]),
      [
        dcRow({ sdc_cust_id: CUST2, sdc_cust_name: 'ZTA-DC-CUST2' }),
        dcRow({ sdi_id: L2, sdi_line_no: 2, sdc_cust_id: CUST2, sdc_cust_name: 'ZTA-DC-CUST2' }),
      ],
    );
    expect(codes(g)).toEqual(['SALES_BILL_DC_MISMATCH:PARTY']);
    expect(g.refusals[0].params).toEqual({ dc: 'DC2627D14-00001', party: 'ZTA-DC-CUST2' });
  });

  it('BRANCH: a challan of another branch (or company)', async () => {
    const { g } = await run(snapOf([{ srcItemId: L1, qty: 1 }]), [
      dcRow({ sdc_branch_id: '01a1e000-0000-7000-8000-0000000000e9' }),
    ]);
    expect(codes(g)).toEqual(['SALES_BILL_DC_MISMATCH:BRANCH']);
  });

  it('GSTIN: refused only when both are filled and differ (Q-N1)', async () => {
    const differ = await run(snapOf([{ srcItemId: L1, qty: 1 }]), [
      dcRow({ sdc_cust_gstin: '33BBBBB1111B1Z5' }),
    ]);
    expect(codes(differ.g)).toEqual(['SALES_BILL_DC_MISMATCH:GSTIN']);
    expect(differ.g.refusals[0].params).toEqual({
      dc: 'DC2627D14-00001',
      gstin: '33BBBBB1111B1Z5',
      billGstin: '33AAAAA0000A1Z5',
    });
    const blankChallan = await run(snapOf([{ srcItemId: L1, qty: 1 }]), [dcRow({ sdc_cust_gstin: null })]);
    expect(blankChallan.g.refusals).toEqual([]);
    const sameOtherCase = await run(snapOf([{ srcItemId: L1, qty: 1 }]), [
      dcRow({ sdc_cust_gstin: ' 33aaaaa0000a1z5 ' }),
    ]);
    expect(sameOtherCase.g.refusals).toEqual([]);
  });

  it('POS: a challan sent to another state than the bill (so challans cannot mix)', async () => {
    const { g } = await run(
      snapOf([
        { srcItemId: L1, qty: 1 },
        { srcItemId: L2, srcDocId: DC2, qty: 1 },
      ]),
      [dcRow(), dcRow({ sdi_id: L2, sdc_id: DC2, sdc_dc_refno: 'DC2627D14-00002', sdc_pos_stcd: '29' })],
    );
    expect(codes(g)).toEqual(['SALES_BILL_DC_MISMATCH:POS']);
    expect(g.refusals[0].params).toEqual({ dc: 'DC2627D14-00002', pos: '29', billPos: '33' });
  });

  // User 11-16: a blank place of supply is allowed, as a blank GSTIN (Q-N1).
  it('POS: a blank-POS challan on a bill with POS 33 is allowed', async () => {
    const { g } = await run(snapOf([{ srcItemId: L1, qty: 1 }]), [dcRow({ sdc_pos_stcd: null })]);
    expect(g.refusals).toEqual([]);
  });

  it('POS: a blank-POS challan beside a 33 one is allowed', async () => {
    const { g } = await run(
      snapOf([
        { srcItemId: L1, qty: 1 },
        { srcItemId: L2, srcDocId: DC2, qty: 1 },
      ]),
      [dcRow({ sdc_pos_stcd: ' ' }), dcRow({ sdi_id: L2, sdc_id: DC2, sdc_dc_refno: 'DC2627D14-00002' })],
    );
    expect(g.refusals).toEqual([]);
  });

  it('POS: with no POS on the bill, challans of 33 and 29 still cannot share it', async () => {
    const { g } = await run(
      snapOf(
        [
          { srcItemId: L1, qty: 1 },
          { srcItemId: L2, srcDocId: DC2, qty: 1 },
        ],
        { posStcd: null } as Partial<BillSnapshot>,
      ),
      [dcRow(), dcRow({ sdi_id: L2, sdc_id: DC2, sdc_dc_refno: 'DC2627D14-00002', sdc_pos_stcd: '29' })],
    );
    // Its own wording variant: the bill has no POS to name (rule POS_CHALLANS).
    expect(codes(g)).toEqual(['SALES_BILL_DC_MISMATCH:POS_CHALLANS']);
    expect(g.refusals[0].params).toEqual({ dc: 'DC2627D14-00002', pos: '29', otherPos: '33' });
  });

  it('POS: a blank bill POS over one challan of 29 is allowed (nothing to differ from)', async () => {
    const { g } = await run(
      snapOf([{ srcItemId: L1, qty: 1 }], { posStcd: '' } as Partial<BillSnapshot>),
      [dcRow({ sdc_pos_stcd: '29' })],
    );
    expect(g.refusals).toEqual([]);
  });

  it('CONVERT: a non-Supply challan is SALES_DC_PURPOSE_NOT_ALLOWED rule CONVERT', async () => {
    const { g } = await run(snapOf([{ srcItemId: L1, qty: 1 }]), [dcRow({ sdc_purpose: 'APPROVAL' })]);
    expect(codes(g)).toEqual(['SALES_DC_PURPOSE_NOT_ALLOWED:CONVERT']);
    expect(g.refusals[0].params).toEqual({ dc: 'DC2627D14-00001', purpose: 'APPROVAL' });
  });

  it('a challan that is not POSTED is SALES_DC_LINE_OVER, as built', async () => {
    const { g } = await run(snapOf([{ srcItemId: L1, qty: 1 }]), [dcRow({ sdc_status: 'CANCELLED' })]);
    expect(codes(g)).toEqual(['SALES_DC_LINE_OVER']);
    const missing = await run(snapOf([{ srcItemId: L1, qty: 1 }]), []);
    expect(codes(missing.g)).toEqual(['SALES_DC_LINE_OVER']);
  });

  it('open is judged in base units, Decimal, summed over the bill\'s lines of one challan line', async () => {
    // Challan line: 10 Box × 12 = 120 pcs; 100 pcs billed elsewhere, 10 returned → 10 pcs open.
    const rows = [dcRow({ sdi_to_base_factor: D('12'), billed_base: D('100'), returned_base: D('10') })];
    const fits = await run(
      snapOf([
        { srcItemId: L1, qty: 6, toBaseFactor: 1 },
        { srcItemId: L1, qty: 4, toBaseFactor: 1 },
      ]),
      rows,
    );
    expect(fits.g.refusals).toEqual([]);
    const over = await run(
      snapOf([
        { srcItemId: L1, qty: 6, toBaseFactor: 1 },
        { srcItemId: L1, qty: 4.001, toBaseFactor: 1 },
      ]),
      rows,
    );
    expect(codes(over.g)).toEqual(['SALES_DC_LINE_OVER']);
    // 0.1 + 0.2 in floats is 0.30000000000000004: no epsilon, and no float error either.
    const exact = await run(
      snapOf([
        { srcItemId: L1, qty: 0.1 },
        { srcItemId: L1, qty: 0.2 },
      ]),
      [dcRow({ sdi_dc_qty: D('0.3') })],
    );
    expect(exact.g.refusals).toEqual([]);
  });

  it('leaves THIS bill out of the billed sum (an amend adds its own prior qty back)', async () => {
    const { calls } = await run(snapOf([{ srcItemId: L1, qty: 1 }], { sbId: BILL } as Partial<BillSnapshot>), [dcRow()]);
    const read = calls.find((c) => /billed_base/.test(c.sql))!;
    expect(read.sql).toMatch(/bh\.sb_id <> \?::uuid/);
    expect(read.values).toContain(BILL);
  });
});

describe('Sales Bill header source — two or more challans (decision 26)', () => {
  const line = (dc: string, year = '2026-2027') => ({
    sbiSrcDocType: 'DELIVERY_CHALLAN',
    sbiSrcDocId: dc,
    sbiSrcDocYear: year,
    sbiSrcItemId: L1,
  });
  const header = {
    sbSrcDocType: 'DELIVERY_CHALLAN',
    sbSrcDocId: DC1,
    sbSrcDocRefno: 'DC2627D14-00001',
    sbSrcDocDate: '2026-11-16',
    sbSrcDocYear: '2026-2027',
  };

  it('counts distinct challans by id and year; a line naming no challan is not counted', () => {
    expect(
      distinctChallanCount([
        { srcDocType: 'DELIVERY_CHALLAN', srcDocId: DC1, srcDocYear: '2026-2027' },
        { srcDocType: 'DELIVERY_CHALLAN', srcDocId: DC1, srcDocYear: '2026-2027 ' },
        { srcDocType: 'DELIVERY_CHALLAN', srcDocId: null, srcDocYear: null },
        { srcDocType: 'SALES_ORDER', srcDocId: DC2, srcDocYear: '2026-2027' },
      ]),
    ).toBe(1);
    expect(headerSourceCleared('SALES_ORDER', [
      { srcDocType: 'DELIVERY_CHALLAN', srcDocId: DC1 },
      { srcDocType: 'DELIVERY_CHALLAN', srcDocId: DC2 },
    ])).toBe(false);
  });

  it('one challan keeps the header the client sent', () => {
    const dto = { ...header, items: [line(DC1), line(DC1)] } as unknown as SaveBillDto;
    applyChallanSourceRule(dto);
    expect(dto.sbSrcDocId).toBe(DC1);
  });

  it('two challans: every sbSrcDoc* is null on the body, and in the /validate snapshot', () => {
    const dto = {
      sbCompanyId: CO,
      sbBranchId: BR,
      sbAccYear: '2026-2027',
      ...header,
      items: [line(DC1), line(DC2)],
    } as unknown as SaveBillDto;
    const snap = snapshotFromDto({ ...dto, items: [...dto.items!] } as SaveBillDto, new Map());
    expect([snap.srcDocType, snap.srcDocId, snap.srcDocYear]).toEqual([null, null, null]);
    applyChallanSourceRule(dto);
    expect([dto.sbSrcDocType, dto.sbSrcDocId, dto.sbSrcDocRefno, dto.sbSrcDocDate, dto.sbSrcDocYear]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it('a whole-order header is never touched, even over two challans', () => {
    const dto = {
      sbSrcDocType: 'SALES_ORDER',
      sbSrcDocId: DC2,
      items: [line(DC1), line(DC2)],
    } as unknown as SaveBillDto;
    applyChallanSourceRule(dto);
    expect(dto.sbSrcDocType).toBe('SALES_ORDER');
    expect(dto.sbSrcDocId).toBe(DC2);
  });

  it('a body with no items is left alone (nothing to judge)', () => {
    const dto = { ...header } as unknown as SaveBillDto;
    applyChallanSourceRule(dto);
    expect(dto.sbSrcDocId).toBe(DC1);
  });
});

describe('Sales Bill afterStatusChange — challans an amend dropped are re-derived too', () => {
  const harness = () => {
    const recompute = jest.fn().mockResolvedValue(undefined);
    const dcRefsOfLines = jest.fn().mockResolvedValue([{ dcId: DC2, accYear: '2026-2027' }]);
    const ORDER_REF = { srcDocId: 'soi-1', srcAccYear: '2026-2027', soLineNo: null, fields: { docId: 'sdiSrcItemId', accYear: 'sdiSrcDocAccYear', lineNo: 'sdiSrcLineNo' } };
    const orderRefsOfDcLines = jest.fn().mockResolvedValue([ORDER_REF]);
    const syncOrderFulfilment = jest.fn().mockResolvedValue(undefined);
    const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
    Object.assign(svc, {
      reservations: { consume: jest.fn(), rederiveOrderLines: jest.fn() },
      saleOrders: { syncOrderFulfilment },
      bills: { orderRefsOf: jest.fn().mockReturnValue([]) },
      dcFulfilment: {
        dcRefsOfBill: jest.fn().mockResolvedValue([{ dcId: DC1, accYear: '2026-2027' }]),
        dcRefsOfLines,
        orderRefsOfDcLines,
        recompute,
      },
    });
    const run = (prior: unknown[]) =>
      (svc as unknown as { afterStatusChange: (...a: unknown[]) => Promise<void> }).afterStatusChange(
        {} as Prisma.TransactionClient,
        { sbId: BILL, sbAccYear: '2026-2027', sbBillRefno: 'B1', sbStatus: 'POSTED' },
        [],
        'actor',
        new Date(),
        prior,
      );
    return { run, recompute, dcRefsOfLines, orderRefsOfDcLines, syncOrderFulfilment, ORDER_REF };
  };

  it('recomputes the challan of a prior line the amend no longer holds', async () => {
    const h = harness();
    await h.run([{ sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcItemId: L2 }]);
    expect(h.dcRefsOfLines).toHaveBeenCalledWith(expect.anything(), [L2]);
    expect(h.recompute).toHaveBeenCalledWith(
      expect.anything(),
      [
        { dcId: DC1, accYear: '2026-2027' },
        { dcId: DC2, accYear: '2026-2027' },
      ],
      'actor',
      expect.any(Date),
    );
  });

  it('asks nothing more when no prior line came from a challan', async () => {
    const h = harness();
    await h.run([{ sbiSrcDocType: 'SALES_ORDER', sbiSrcItemId: L2 }]);
    expect(h.dcRefsOfLines).not.toHaveBeenCalled();
  });
});

// User 2026-11-17: a challan line is free only when its order line was
// (Ctrl+F4), and billing the challan — or the order — keeps the flag.
describe('Sales Bill — a sourced line keeps its source\'s Free flag (user 11-17)', () => {
  const freeCodes = (g: SalesGuardContext) =>
    g.refusals.filter((r) => r.rule === 'FREE_LINE_BILL').map((r) => ({ line: r.line, message: r.message }));

  it('bills a free challan line as free, and a paid one as paid', async () => {
    const snap = snapOf([
      { srcItemId: L1, qty: 2 },
      { srcItemId: L2, qty: 1 },
    ]);
    (snap.items[1] as { isFree: boolean }).isFree = true;
    const { g, calls } = await run(snap, [dcRow({ sdi_id: L1 }), dcRow({ sdi_id: L2, sdi_line_no: 2, sdi_is_free: true })]);
    expect(freeCodes(g)).toEqual([]);
    expect(codes(g)).toEqual([]);
    expect(calls.find((c) => /billed_base/.test(c.sql))!.sql).toContain('d.sdi_is_free');
  });

  it('refuses a free challan line billed as paid, and a paid one billed as free', async () => {
    const snap = snapOf([
      { srcItemId: L1, qty: 2 },
      { srcItemId: L2, qty: 1 },
    ]);
    (snap.items[0] as { isFree: boolean }).isFree = true;
    const { g } = await run(snap, [dcRow({ sdi_id: L1 }), dcRow({ sdi_id: L2, sdi_line_no: 2, sdi_is_free: true })]);
    expect(codes(g)).toEqual(['SALES_AMOUNT_MISMATCH:FREE_LINE_BILL', 'SALES_AMOUNT_MISMATCH:FREE_LINE_BILL']);
    expect(freeCodes(g)).toEqual([
      { line: 1, message: 'Line 1: its challan line is not free, so the bill line cannot be free' },
      { line: 2, message: 'Line 2: its challan line is free, so the bill line must be free too' },
    ]);
    expect(g.refusals[0]).toMatchObject({ field: 'items', params: { n: 1 } });
  });

  it('judges an order line the same way, off soi_is_free', async () => {
    const SOI1 = '01a1e000-0000-7000-8000-0000000002a1';
    const SOI2 = '01a1e000-0000-7000-8000-0000000002a2';
    const SO = '01a1e000-0000-7000-8000-0000000000f1';
    const snap = {
      sbId: null,
      companyId: CO,
      branchId: BR,
      custId: CUST,
      srcDocType: null,
      srcDocId: null,
      srcDocYear: null,
      items: [
        { lineNo: 1, srcDocType: 'SALES_ORDER', srcDocId: SO, srcItemId: SOI1, qty: 1, isFree: false },
        { lineNo: 2, srcDocType: 'SALES_ORDER', srcDocId: SO, srcItemId: SOI2, qty: 1, isFree: false },
      ],
    } as unknown as BillSnapshot;
    const $queryRaw = jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (/soi_pending_qty/.test(sql)) {
        return Promise.resolve([
          { soi_id: SOI1, soi_pending_qty: D(5), so_status: 'CONFIRMED', soi_is_free: false },
          { soi_id: SOI2, soi_pending_qty: D(5), so_status: 'CONFIRMED', soi_is_free: true },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = Object.create(BillLifecycleService.prototype) as unknown as {
      guardSources: (tx: unknown, snap: BillSnapshot, g: SalesGuardContext, allowOverOrder: boolean) => Promise<void>;
    };
    const g = createGuardContext({ throwOnRefusal: false });
    await svc.guardSources({ $queryRaw }, snap, g, false);
    expect(freeCodes(g)).toEqual([
      { line: 2, message: 'Line 2: its order line is free, so the bill line must be free too' },
    ]);
  });

  it('leaves a line whose source is missing to the caller, and a bill line with no source alone', () => {
    const g = createGuardContext({ throwOnRefusal: false });
    refuseFreeMismatch(
      g,
      [
        { lineNo: 1, isFree: true, srcItemId: L3 },
        { lineNo: 2, isFree: true, srcItemId: null },
      ],
      new Map([[L1, false]]),
      'challan',
    );
    expect(g.refusals).toEqual([]);
  });
});

// User 2026-11-17 — a bill of a challan bills its order line (soi_billed_amt):
// the orders behind its challan lines, now and before an amend, are re-derived.
describe('Sales Bill afterStatusChange — the orders behind its challan lines (user 11-17)', () => {
  it('hands the orders behind its challan lines (now and before) to the order recompute', async () => {
    const recompute = jest.fn().mockResolvedValue(undefined);
    const ORDER_REF = { srcDocId: 'soi-1', srcAccYear: '2026-2027', soLineNo: null, fields: { docId: 'sdiSrcItemId', accYear: 'sdiSrcDocAccYear', lineNo: 'sdiSrcLineNo' } };
    const orderRefsOfDcLines = jest.fn().mockResolvedValue([ORDER_REF]);
    const syncOrderFulfilment = jest.fn().mockResolvedValue(undefined);
    const rederiveOrderLines = jest.fn();
    const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
    Object.assign(svc, {
      reservations: { consume: jest.fn(), rederiveOrderLines },
      saleOrders: { syncOrderFulfilment },
      bills: { orderRefsOf: jest.fn().mockReturnValue([]) },
      dcFulfilment: {
        dcRefsOfBill: jest.fn().mockResolvedValue([]),
        dcRefsOfLines: jest.fn().mockResolvedValue([]),
        orderRefsOfDcLines,
        recompute,
      },
    });
    await (svc as unknown as { afterStatusChange: (...a: unknown[]) => Promise<void> }).afterStatusChange(
      {} as Prisma.TransactionClient,
      { sbId: BILL, sbAccYear: '2026-2027', sbBillRefno: 'B1', sbStatus: 'CANCELLED' },
      [{ sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcItemId: L1 }],
      'actor',
      new Date(),
      [{ sbiSrcDocType: 'DELIVERY_CHALLAN', sbiSrcItemId: L2 }],
    );

    expect(orderRefsOfDcLines).toHaveBeenCalledWith(expect.anything(), [L1, L2]);
    expect(syncOrderFulfilment.mock.calls[0][1]).toMatchObject({ refs: [ORDER_REF] });
    // a bill of a challan consumes no reservation
    expect(rederiveOrderLines).not.toHaveBeenCalled();
  });
});
