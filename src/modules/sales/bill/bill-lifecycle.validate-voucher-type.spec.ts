import { ForbiddenException } from '@nestjs/common';
import { BillLifecycleService } from './bill-lifecycle.service';

/**
 * Voucher Types plan §7.4 — /bills/validate lists the voucher-type refusals the
 * first save (or a later save) would answer, from the same helper
 * (billTypeRefusals → judgeBillVoucherType / billTypeLockRefusal). P3 found
 * validate answering ok:true where /bills/create refused VT_BILL_TYPE_REQUIRED.
 */

const ACME = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const CBE = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const DEV = '019ea5d1-261f-7f3d-b350-93a30c147788';
const BILL = '01a1ddee-0000-7000-8000-000000000001';

const BASE = {
  vchr_type_id: 3,
  vchr_type_code: 'Bil',
  vchr_type_name: 'Sales Bill',
  vchr_type_short: 'Bil',
  vchr_parent_id: null,
  vchr_no_prefix: 'bil',
  vchr_sort_order: 300,
};
const RT = {
  vchr_type_id: 68,
  vchr_type_code: 'Bil-RT',
  vchr_type_name: 'Retail',
  vchr_type_short: 'RT',
  vchr_parent_id: 3,
  vchr_no_prefix: 'RT{BR}',
  vchr_sort_order: 301,
};
const WS = {
  vchr_type_id: 69,
  vchr_type_code: 'Bil-WS',
  vchr_type_name: 'Wholesale',
  vchr_type_short: 'WS',
  vchr_parent_id: 3,
  vchr_no_prefix: 'WS{BR}',
  vchr_sort_order: 302,
};

const harness = (opts: {
  children: Array<typeof RT>;
  saved?: { sb_vchr_type_id: number; sb_bill_refno: string } | null;
  /** cloudSync.enabled (CLOUD_SYNC_ENABLED): this install is an offline site. */
  offline?: boolean;
}) => {
  const $queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('FROM sales.sale_bill')) return opts.saved ? [opts.saved] : [];
    if (sql.includes('count(*)::int AS n')) return [{ n: opts.children.length }];
    if (sql.includes('vchr_no_prefix, vchr_sort_order')) return [BASE, ...opts.children];
    return [];
  });
  const tx = { $queryRaw };
  const runGuards = jest.fn(async () => undefined);
  const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
  Object.assign(svc, {
    prisma: { $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) },
    salesContext: {
      resolve: jest.fn(async () => ({ rights: { override: false }, settings: {} })),
      values: jest.fn(async () => ({
        'sales.offer_base_bill_type': null,
        'sales.bill_voucher_type': null,
      })),
    },
    tenderMasters: jest.fn(async () => new Map()),
    bills: {
      chargeTypesOf: jest.fn(async () => new Map()),
      // Review step 6: the rate / discount lock's dry run (bill-rate-discount-lock.spec.ts).
      rateDiscountDryRun: jest.fn(async () => []),
    },
    runGuards,
    proposals: jest.fn(async () => ({})),
    config: {
      get: jest.fn((key: string) => (key === 'cloudSync.enabled' ? opts.offline : undefined)),
    },
  });
  const validate = (dto: Record<string, unknown>) =>
    (svc as unknown as BillLifecycleService).validate({
      sbCompanyId: ACME,
      sbBranchId: CBE,
      sbAccYear: '2026-2027',
      sbDeviceId: DEV,
      sbDeviceType: 'DESKTOP',
      sbPriceLevel: 1,
      sbCustName: 'ZT',
      items: [],
      charges: [],
      tenders: [],
      ...dto,
    } as never) as Promise<{ ok: boolean; refusals: Array<{ code: string; field?: string }> }>;
  return { validate, runGuards };
};

describe('BillLifecycleService.validate — the bill’s voucher type', () => {
  it('refuses VT_BILL_TYPE_REQUIRED with several child types and no type sent, as /create does', async () => {
    const { validate, runGuards } = harness({ children: [RT, WS] });

    const out = await validate({});

    expect(out.ok).toBe(false);
    expect(out.refusals).toEqual([
      expect.objectContaining({ code: 'VT_BILL_TYPE_REQUIRED', field: 'sbVchrTypeId' }),
    ]);
    // The other guards still run: one answer lists everything.
    expect(runGuards).toHaveBeenCalled();
  });

  it('refuses VT_BILL_TYPE_INVALID for a type that is not offered (3 with children, offerBase off)', async () => {
    const { validate } = harness({ children: [RT, WS] });

    const out = await validate({ sbVchrTypeId: 3 });

    expect(out.refusals.map((r) => r.code)).toEqual(['VT_BILL_TYPE_INVALID']);
  });

  it('passes an offered child, and a company with no children with no type sent', async () => {
    expect((await harness({ children: [RT, WS] }).validate({ sbVchrTypeId: 69 })).ok).toBe(true);
    expect((await harness({ children: [] }).validate({})).ok).toBe(true);
  });

  it('refuses VT_BILL_TYPE_LOCKED for a saved bill whose type changes; the same type passes', async () => {
    const saved = { sb_vchr_type_id: 68, sb_bill_refno: 'RTCBE0002' };

    const locked = await harness({ children: [RT, WS], saved }).validate({
      sbId: BILL,
      sbVchrTypeId: 69,
    });
    expect(locked.refusals).toEqual([
      expect.objectContaining({ code: 'VT_BILL_TYPE_LOCKED', field: 'sbVchrTypeId' }),
    ]);

    expect(
      (await harness({ children: [RT, WS], saved }).validate({ sbId: BILL, sbVchrTypeId: 68 })).ok,
    ).toBe(true);
    // A saved bill is past its first save: no type sent is not "required".
    expect((await harness({ children: [RT, WS], saved }).validate({ sbId: BILL })).ok).toBe(true);
  });
});

describe('BillLifecycleService at an offline site (decision 64, re-review R2)', () => {
  it('validate lists VT_OFFLINE for a first save naming a child type', async () => {
    const out = await harness({ children: [RT, WS], offline: true }).validate({ sbVchrTypeId: 68 });

    expect(out.ok).toBe(false);
    expect(out.refusals).toEqual([
      expect.objectContaining({ code: 'VT_OFFLINE', field: 'sbVchrTypeId' }),
    ]);
  });

  it('validate passes a first save with no type, or 3, although the company has children', async () => {
    expect((await harness({ children: [RT, WS], offline: true }).validate({})).ok).toBe(true);
    expect(
      (await harness({ children: [RT, WS], offline: true }).validate({ sbVchrTypeId: 3 })).ok,
    ).toBe(true);
  });

  it('validate lists VT_OFFLINE for a saved child-type bill, sent type or not', async () => {
    const saved = { sb_vchr_type_id: 68, sb_bill_refno: 'RTCBE0002' };
    for (const body of [{ sbId: BILL }, { sbId: BILL, sbVchrTypeId: 68 }]) {
      const out = await harness({ children: [RT, WS], saved, offline: true }).validate(body);
      expect(out.refusals.map((r) => r.code)).toEqual(['VT_OFFLINE']);
    }
  });

  describe('post', () => {
    const postHarness = (offline: boolean) => {
      const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
      const resolveForMoney = jest.fn(async () => null);
      Object.assign(svc, {
        salesContext: {
          resolve: jest.fn(async () => ({ rights: { post: true, override: false }, settings: {} })),
        },
        till: { resolveForMoney },
        // Past the type check the post reads the bill's parts: stop there.
        bills: { loadParts: jest.fn(async () => Promise.reject(new Error('PAST_THE_TYPE_CHECK'))) },
        stampTillSession: jest.fn(),
        config: {
          get: jest.fn((key: string) => (key === 'cloudSync.enabled' ? offline : undefined)),
        },
      });
      const post = (bill: Record<string, unknown>) =>
        (
          svc as unknown as {
            postDraftInTx: (tx: unknown, b: unknown, o: unknown, n: Date) => Promise<unknown>;
          }
        ).postDraftInTx(
          {},
          {
            sbId: BILL,
            sbCompanyId: ACME,
            sbBranchId: CBE,
            sbDeviceId: DEV,
            sbStatus: 'DRAFT',
            sbBillRefno: 'RTCBE0002',
            ...bill,
          },
          {},
          new Date(),
        );
      return { post, resolveForMoney };
    };

    it('refuses a draft numbered under a child type, 403 VT_OFFLINE, before the till or the books', async () => {
      const { post, resolveForMoney } = postHarness(true);
      let caught: unknown;
      await post({ sbVchrTypeId: 68 }).catch((e: unknown) => (caught = e));

      expect(caught).toBeInstanceOf(ForbiddenException);
      expect((caught as ForbiddenException).getResponse()).toMatchObject({
        errors: [{ field: 'sbVchrTypeId', code: 'VT_OFFLINE' }],
      });
      expect(resolveForMoney).not.toHaveBeenCalled();
    });

    it('posts a Sales Bill (3) draft there as before, and a child draft on the main server', async () => {
      await expect(postHarness(true).post({ sbVchrTypeId: 3 })).rejects.toThrow(
        'PAST_THE_TYPE_CHECK',
      );
      await expect(postHarness(false).post({ sbVchrTypeId: 68 })).rejects.toThrow(
        'PAST_THE_TYPE_CHECK',
      );
    });
  });
});
