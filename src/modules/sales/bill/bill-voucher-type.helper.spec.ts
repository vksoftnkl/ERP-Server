import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isOfflineSite } from '../../../config/offline-site';
import {
  setErrorWording,
  wordingFor,
  type ErrorWordingRow,
} from '../../../common/error-wording/error-wording';
import {
  assertBillTypeAtSite,
  assertBillTypeUnchanged,
  billOfflineTypeRefusal,
  billTypeLockRefusal,
  billTypeRefusals,
  judgeBillVoucherType,
  billTypeChoices,
  billVoucherTypeBlock,
  billVoucherTypeOf,
  billSeriesDeviceCode,
  designUsable,
  resolveBillVoucherType,
  type BillSettingValues,
  billTypeDeliveryMode,
} from './bill-voucher-type.helper';

/**
 * Voucher Types plan §5.3 / §5.4 / §7.4 — the Sales Bill's type: what is
 * offered, the first-save resolution, the lock (Q5), the print block and the
 * type the posting carries.
 */

const ACME = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const CBE = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const DEV = '019ea5d1-261f-7f3d-b350-93a30c147788';

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

/** A $queryRaw stand-in: the child count, then the offered rows. */
const client = (children: Array<typeof RT>) => {
  const $queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('count(*)::int AS n')) return [{ n: children.length }];
    if (sql.includes('vchr_no_prefix, vchr_sort_order')) return [BASE, ...children];
    return [];
  });
  return { $queryRaw } as never;
};

const settings = (values: Record<string, string | null> = {}) =>
  jest.fn(async () => ({
    'sales.offer_base_bill_type': null,
    'sales.bill_voucher_type': null,
    ...values,
  })) as jest.Mock & BillSettingValues;

const dto = (sbVchrTypeId?: number | null) => ({
  sbCompanyId: ACME,
  sbBranchId: CBE,
  sbDeviceId: DEV,
  sbVchrTypeId,
});

async function refusal(p: Promise<unknown>) {
  try {
    await p;
  } catch (error) {
    const body = (
      error as { getResponse: () => { errors: Array<{ code: string; field: string }> } }
    ).getResponse();
    return { error, errors: body.errors };
  }
  throw new Error('expected a refusal');
}

describe('resolveBillVoucherType (first save)', () => {
  it('bills a company with no child types as type 3, without reading a setting', async () => {
    const values = settings();

    await expect(resolveBillVoucherType(client([]), values, dto())).resolves.toBe(3);
    await expect(resolveBillVoucherType(client([]), values, dto(3))).resolves.toBe(3);
    expect(values).not.toHaveBeenCalled();
  });

  it('refuses a child id on a company with none (VT_BILL_TYPE_INVALID)', async () => {
    const r = await refusal(resolveBillVoucherType(client([]), settings(), dto(68)));

    expect(r.error).toBeInstanceOf(UnprocessableEntityException);
    expect(r.errors).toEqual([
      expect.objectContaining({ field: 'sbVchrTypeId', code: 'VT_BILL_TYPE_INVALID' }),
    ]);
  });

  it('takes an offered child', async () => {
    await expect(resolveBillVoucherType(client([RT, WS]), settings(), dto(69))).resolves.toBe(69);
  });

  it('refuses 3 itself once children exist and offerBase is off (Q3)', async () => {
    const r = await refusal(resolveBillVoucherType(client([RT, WS]), settings(), dto(3)));

    expect(r.errors[0].code).toBe('VT_BILL_TYPE_INVALID');
  });

  it('takes 3 when offerBase is on', async () => {
    const values = settings({ 'sales.offer_base_bill_type': 'true' });

    await expect(resolveBillVoucherType(client([RT]), values, dto(3))).resolves.toBe(3);
    expect(values).toHaveBeenCalledWith(ACME, CBE, DEV, [
      'sales.offer_base_bill_type',
      'sales.bill_voucher_type',
    ]);
  });

  it('refuses an id that is not offered (inactive, or another company’s child)', async () => {
    expect(
      (await refusal(resolveBillVoucherType(client([RT]), settings(), dto(70)))).errors[0].code,
    ).toBe('VT_BILL_TYPE_INVALID');
  });

  it('defaults to the device’s sales.bill_voucher_type when offered (Q4)', async () => {
    await expect(
      resolveBillVoucherType(
        client([RT, WS]),
        settings({ 'sales.bill_voucher_type': '69' }),
        dto(),
      ),
    ).resolves.toBe(69);
  });

  it('ignores a device default that is not offered', async () => {
    const r = await refusal(
      resolveBillVoucherType(client([RT, WS]), settings({ 'sales.bill_voucher_type': '3' }), dto()),
    );

    expect(r.errors[0].code).toBe('VT_BILL_TYPE_REQUIRED');
  });

  it('takes the only type offered', async () => {
    await expect(resolveBillVoucherType(client([RT]), settings(), dto())).resolves.toBe(68);
  });

  it('refuses VT_BILL_TYPE_REQUIRED when several are offered and nothing picks one', async () => {
    const r = await refusal(resolveBillVoucherType(client([RT, WS]), settings(), dto(null)));

    expect(r.error).toBeInstanceOf(UnprocessableEntityException);
    expect(r.errors).toEqual([
      expect.objectContaining({ field: 'sbVchrTypeId', code: 'VT_BILL_TYPE_REQUIRED' }),
    ]);
  });
});

describe('billTypeChoices (§5.3)', () => {
  it('offers the children only, then 3 too with offerBase', async () => {
    const off = await billTypeChoices(client([RT, WS]), settings(), {
      companyId: ACME,
      branchId: CBE,
    });
    expect(off.offered.map((t) => t.vchrTypeId)).toEqual([68, 69]);
    expect(off.defaultVchrTypeId).toBeNull();

    const on = await billTypeChoices(
      client([RT, WS]),
      settings({ 'sales.offer_base_bill_type': 'true', 'sales.bill_voucher_type': '68' }),
      {
        companyId: ACME,
        branchId: CBE,
      },
    );
    expect(on.offered.map((t) => t.vchrTypeId)).toEqual([3, 68, 69]);
    expect(on).toMatchObject({ defaultVchrTypeId: 68, offerBase: true });
  });

  it('offers Sales Bill alone to a company with no children', async () => {
    const r = await billTypeChoices(client([]), settings(), { companyId: ACME, branchId: CBE });
    expect(r.offered.map((t) => t.vchrTypeId)).toEqual([3]);
  });
});

describe('assertBillTypeUnchanged (Q5)', () => {
  it('passes the same type, or none sent', () => {
    expect(() => assertBillTypeUnchanged({ sbVchrTypeId: 68 }, 68)).not.toThrow();
    expect(() => assertBillTypeUnchanged({ sbVchrTypeId: 68 }, undefined)).not.toThrow();
    expect(() => assertBillTypeUnchanged({ sbVchrTypeId: 68 }, null)).not.toThrow();
    expect(() => assertBillTypeUnchanged({}, 3)).not.toThrow();
  });

  it('refuses 409 VT_BILL_TYPE_LOCKED for another type', () => {
    try {
      assertBillTypeUnchanged({ sbVchrTypeId: 68, sbBillRefno: 'RTCBE0001' }, 69);
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        errors: [{ field: 'sbVchrTypeId', code: 'VT_BILL_TYPE_LOCKED' }],
      });
    }
  });
});

describe('billVoucherTypeBlock (§5.4, OP-4; review S2 / decision 62)', () => {
  const calls: Array<{ strings: string[]; values: unknown[] }> = [];
  const block = (r: Record<string, unknown> | null) =>
    billVoucherTypeBlock(
      {
        $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
          calls.push({ strings: [...strings], values });
          return r ? [r] : [];
        }),
      } as never,
      {
        sbVchrTypeId: 68,
        sbCompanyId: ACME,
      },
    );
  const USABLE = { live: true, layout: true, assigned: true };
  const design = (prefix: 'own' | 'base', code: string, name: string, facts = USABLE) => ({
    [`${prefix}_code`]: code,
    [`${prefix}_name`]: name,
    [`${prefix}_live`]: facts.live,
    [`${prefix}_layout`]: facts.layout,
    [`${prefix}_assigned`]: facts.assigned,
  });
  const row = {
    vchr_type_id: 68,
    vchr_type_name: 'Retail',
    vchr_type_short: 'RT',
    vchr_parent_id: 3,
    own_title: null,
    base_title: 'TAX INVOICE',
    print_after_post: true,
    own_code: null,
    own_name: null,
    own_live: null,
    own_layout: false,
    own_assigned: false,
    base_code: null,
    base_name: null,
    base_live: null,
    base_layout: false,
    base_assigned: false,
    default_name: 'Tax Invoice',
  };

  it('falls back to the base’s title and SALE_INVOICE', async () => {
    await expect(block(row)).resolves.toEqual({
      vchrTypeId: 68,
      vchrTypeName: 'Retail',
      vchrTypeShort: 'RT',
      vchrParentId: 3,
      printTitle: 'TAX INVOICE',
      printPurposeCode: 'SALE_INVOICE',
      printAfterPost: true,
    });
  });

  it('prints with the child’s design when (a) live, (b) layout and (c) assignment all hold, with the child’s title', async () => {
    await expect(
      block({
        ...row,
        own_title: 'RETAIL INVOICE',
        ...design('own', 'RETAIL', 'Retail'),
      }),
    ).resolves.toMatchObject({
      printTitle: 'RETAIL INVOICE',
      printPurposeCode: 'RETAIL',
    });
  });

  it.each([
    ['(a) the design is deleted or inactive', { live: false, layout: true, assigned: true }],
    ['(b) it has no published layout yet', { live: true, layout: false, assigned: true }],
    [
      '(c) it has a layout but no company / every-company PRINT assignment (OP-4)',
      { live: true, layout: true, assigned: false },
    ],
  ])('a child design that fails %s prints with the base’s design', async (_why, facts) => {
    await expect(
      block({
        ...row,
        ...design('own', 'RETAIL', 'Retail', facts),
        ...design('base', 'BASE_INV', 'Base'),
        base_title: null,
      }),
    ).resolves.toMatchObject({ printPurposeCode: 'BASE_INV', printTitle: 'Base' });
  });

  it('a base design with a layout but no assignment is passed over too: SALE_INVOICE', async () => {
    await expect(
      block({
        ...row,
        ...design('own', 'RETAIL', 'Retail', { live: true, layout: true, assigned: false }),
        ...design('base', 'BASE_INV', 'Base', { live: true, layout: true, assigned: false }),
        base_title: null,
      }),
    ).resolves.toMatchObject({ printPurposeCode: 'SALE_INVOICE', printTitle: 'Tax Invoice' });
  });

  it('designUsable needs a code and all three parts true (null = not known = no)', () => {
    const d = { code: 'X', name: 'X', live: true, layout: true, assigned: true };
    expect(designUsable(d)).toBe(true);
    expect(designUsable({ ...d, code: null })).toBe(false);
    expect(designUsable({ ...d, live: null })).toBe(false);
    expect(designUsable({ ...d, layout: false })).toBe(false);
    expect(designUsable({ ...d, assigned: false })).toBe(false);
  });

  it('asks the database the shared rule, with the bill’s company bound (never spliced)', async () => {
    calls.length = 0;
    await block(row);
    const [{ strings, values }] = calls;
    const text = strings.join(' ');
    expect(text).toContain('AS own_live');
    expect(text).toContain('AS own_assigned');
    expect(text).toContain('AS base_assigned');
    // (a) is read by the rule, not hidden in the joins
    expect(text).toContain(
      'LEFT JOIN public.print_purpose op ON op.ppo_id = t.vchr_print_purpose_id',
    );
    const fragments = values
      .filter(
        (v): v is { sql: string; values: unknown[] } =>
          typeof v === 'object' && v !== null && 'sql' in v,
      )
      .map((v) => v);
    const assignment = fragments.filter((f) => f.sql.includes('print_template_assignment'));
    expect(assignment).toHaveLength(2);
    for (const f of assignment) {
      expect(f.sql).toContain("da.pta_output_mode = 'PRINT'");
      expect(f.sql).toContain('da.pta_branch_id IS NULL AND da.pta_device_id IS NULL');
      expect(f.sql).toContain('ORDER BY da.pta_specificity DESC');
      expect(f.values.every((v) => v === ACME)).toBe(true);
    }
    expect(fragments.some((f) => f.sql.includes('op.ppo_is_active = true'))).toBe(true);
    expect(fragments.some((f) => f.sql.includes('bp.ppo_is_active = true'))).toBe(true);
  });

  it('takes the design’s name when no title is set anywhere', async () => {
    await expect(block({ ...row, base_title: null })).resolves.toMatchObject({
      printTitle: 'Tax Invoice',
    });
  });

  it('answers the defaults when the row is not there', async () => {
    await expect(block(null)).resolves.toEqual({
      vchrTypeId: 68,
      vchrTypeName: null,
      vchrTypeShort: null,
      vchrParentId: null,
      printTitle: null,
      printPurposeCode: 'SALE_INVOICE',
      printAfterPost: false,
    });
  });
});

describe('billSeriesDeviceCode (review N11: the save and the preview draw the same counter)', () => {
  const at = (over: Partial<Parameters<typeof billSeriesDeviceCode>[0]> = {}) =>
    billSeriesDeviceCode({
      vchrTypeId: 3,
      billMode: 'POS',
      posSeriesPerDevice: true,
      deviceId: DEV,
      ...over,
    });

  it('is the device only for Sales Bill itself, POS, the setting on and a device named', () => {
    expect(at()).toBe(DEV);
    expect(at({ deviceId: `  ${DEV} ` })).toBe(DEV);
  });

  it('is the branch counter (null = MAIN) otherwise', () => {
    expect(at({ vchrTypeId: 68 })).toBeNull(); // a child type: decision 34
    expect(at({ billMode: 'WHOLESALE' })).toBeNull();
    expect(at({ billMode: null })).toBeNull(); // WHOLESALE by default
    expect(at({ posSeriesPerDevice: false })).toBeNull();
    expect(at({ deviceId: null })).toBeNull();
    expect(at({ deviceId: '  ' })).toBeNull();
  });

  it('is what the save uses, with the setting read without the device (company / branch scope)', () => {
    const src = readFileSync(join(__dirname, 'bill.service.ts'), 'utf8');
    const create = src.slice(
      src.indexOf('async createBillInTx('),
      src.indexOf('const data: Prisma.SaleBillUncheckedCreateInput'),
    );
    expect(create).toMatch(
      /this\.salesContext\.settings\(\s*saveBillDto\.sbCompanyId,\s*saveBillDto\.sbBranchId,\s*\)/,
    );
    expect(create).toContain('deviceCode: billSeriesDeviceCode({');
    expect(create).toContain('posSeriesPerDevice: settings.posSeriesPerDevice');
  });
});

describe('the posting type (§7.4)', () => {
  it('is the bill’s own type; a row with none reads as 3', () => {
    expect(billVoucherTypeOf({ sbVchrTypeId: 68 })).toBe(68);
    expect(billVoucherTypeOf({ sbVchrTypeId: null })).toBe(3);
    expect(billVoucherTypeOf({})).toBe(3);
  });

  it('is what all three posting sites of the lifecycle write (voucher header, GST register, bill balance)', () => {
    const src = readFileSync(join(__dirname, 'bill-lifecycle.service.ts'), 'utf8');

    // the voucher header and the GST register row …
    expect(src.match(/\bvoucherTypeId: billVoucherTypeOf\(bill\)/g)).toHaveLength(2);
    // … and the bill-balance row
    expect(src).toContain('ablVoucherTypeId: billVoucherTypeOf(bill)');
    expect(src).not.toMatch(/voucherTypeId: SALES_VOUCHER_TYPE\.BILL/);
  });
});

describe('the shared core: judgeBillVoucherType / billTypeLockRefusal / billTypeRefusals', () => {
  it('judges without throwing: the type, or the refusal the save throws', async () => {
    await expect(judgeBillVoucherType(client([RT]), settings(), dto())).resolves.toEqual({
      vchrTypeId: 68,
      refusal: null,
    });
    await expect(judgeBillVoucherType(client([RT, WS]), settings(), dto())).resolves.toEqual({
      vchrTypeId: null,
      refusal: expect.objectContaining({ field: 'sbVchrTypeId', code: 'VT_BILL_TYPE_REQUIRED' }),
    });
  });

  it('resolveBillVoucherType throws exactly the judged refusal', async () => {
    const judged = await judgeBillVoucherType(client([RT, WS]), settings(), dto(3));
    const thrown = await refusal(resolveBillVoucherType(client([RT, WS]), settings(), dto(3)));
    expect(thrown.errors).toEqual([judged.refusal]);
  });

  it('billTypeLockRefusal is null for the same type or none', () => {
    expect(billTypeLockRefusal({ sbVchrTypeId: 68 }, 68)).toBeNull();
    expect(billTypeLockRefusal({ sbVchrTypeId: 68 }, undefined)).toBeNull();
    expect(billTypeLockRefusal({ sbVchrTypeId: 68 }, 69)).toMatchObject({
      code: 'VT_BILL_TYPE_LOCKED',
    });
  });

  it('billTypeRefusals: the lock for a saved bill (read from the row), the resolution for a new one', async () => {
    const savedClient = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) =>
        strings.join('?').includes('FROM sales.sale_bill')
          ? [{ sb_vchr_type_id: 68, sb_bill_refno: 'X1' }]
          : [],
      ),
    } as never;
    await expect(
      billTypeRefusals(savedClient, settings(), { ...dto(69), sbId: 'b', sbAccYear: '2026-2027' }),
    ).resolves.toEqual([expect.objectContaining({ code: 'VT_BILL_TYPE_LOCKED' })]);
    await expect(billTypeRefusals(client([RT, WS]), settings(), dto())).resolves.toEqual([
      expect.objectContaining({ code: 'VT_BILL_TYPE_REQUIRED' }),
    ]);
    await expect(billTypeRefusals(client([]), settings(), dto())).resolves.toEqual([]);
  });
});

describe('an offline site bills plain Sales Bill only (decision 64, re-review R2)', () => {
  const SITE = { offlineSite: true };

  it('isOfflineSite reads cloudSync.enabled (CLOUD_SYNC_ENABLED, decision 41); no config = the main server', () => {
    const config = (v: unknown) => ({ get: jest.fn(() => v) });
    const on = config(true);
    expect(isOfflineSite(on as never)).toBe(true);
    expect(on.get).toHaveBeenCalledWith('cloudSync.enabled');
    expect(isOfflineSite(config(false) as never)).toBe(false);
    expect(isOfflineSite(config(undefined) as never)).toBe(false);
    expect(isOfflineSite(undefined)).toBe(false);
  });

  it('the choices offer Sales Bill alone, whatever children and offerBase say', async () => {
    for (const offerBase of [null, 'true']) {
      const r = await billTypeChoices(
        client([RT, WS]),
        settings({ 'sales.offer_base_bill_type': offerBase, 'sales.bill_voucher_type': '68' }),
        { companyId: ACME, branchId: CBE, deviceId: DEV, ...SITE },
      );
      expect(r.offered.map((t) => t.vchrTypeId)).toEqual([3]);
      // the device default names a child: not offered here, so none
      expect(r.defaultVchrTypeId).toBeNull();
    }
  });

  it('a first save with no type, or 3, is type 3 although the company has children (no count, no setting read)', async () => {
    const c = client([RT, WS]);
    const values = settings({ 'sales.bill_voucher_type': '68' });

    await expect(resolveBillVoucherType(c, values, dto(), SITE)).resolves.toBe(3);
    await expect(resolveBillVoucherType(c, values, dto(null), SITE)).resolves.toBe(3);
    await expect(resolveBillVoucherType(c, values, dto(3), SITE)).resolves.toBe(3);
    expect(values).not.toHaveBeenCalled();
    expect((c as unknown as { $queryRaw: jest.Mock }).$queryRaw).not.toHaveBeenCalled();
  });

  it('a first save naming any other type is refused 403 VT_OFFLINE on sbVchrTypeId', async () => {
    for (const id of [68, 70]) {
      const r = await refusal(resolveBillVoucherType(client([RT, WS]), settings(), dto(id), SITE));
      expect(r.error).toBeInstanceOf(ForbiddenException);
      expect(r.errors).toEqual([
        expect.objectContaining({ field: 'sbVchrTypeId', code: 'VT_OFFLINE' }),
      ]);
    }
  });

  it('the main server is unchanged: no site = online', async () => {
    await expect(resolveBillVoucherType(client([RT, WS]), settings(), dto(68))).resolves.toBe(68);
    await expect(
      resolveBillVoucherType(client([RT, WS]), settings(), dto(68), { offlineSite: false }),
    ).resolves.toBe(68);
  });

  it('a saved child-type bill is not saved again or posted there (403 VT_OFFLINE); a type-3 bill is', () => {
    expect(
      billOfflineTypeRefusal({ sbVchrTypeId: 68, sbBillRefno: 'RTCBE0001' }, SITE),
    ).toMatchObject({
      field: 'sbVchrTypeId',
      code: 'VT_OFFLINE',
    });
    expect(billOfflineTypeRefusal({ sbVchrTypeId: 3 }, SITE)).toBeNull();
    expect(billOfflineTypeRefusal({ sbVchrTypeId: null }, SITE)).toBeNull();
    expect(billOfflineTypeRefusal({}, SITE)).toBeNull();
    expect(billOfflineTypeRefusal({ sbVchrTypeId: 68 }, {})).toBeNull();

    expect(() => assertBillTypeAtSite({ sbVchrTypeId: 3 }, SITE)).not.toThrow();
    try {
      assertBillTypeAtSite({ sbVchrTypeId: 68, sbBillRefno: 'RTCBE0001' }, SITE);
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        errors: [{ field: 'sbVchrTypeId', code: 'VT_OFFLINE' }],
      });
    }
  });

  it('billTypeRefusals lists the same: VT_OFFLINE for a first save naming a child, and for a saved child bill (before the lock)', async () => {
    await expect(billTypeRefusals(client([RT, WS]), settings(), dto(68), SITE)).resolves.toEqual([
      expect.objectContaining({ field: 'sbVchrTypeId', code: 'VT_OFFLINE' }),
    ]);
    await expect(billTypeRefusals(client([RT, WS]), settings(), dto(), SITE)).resolves.toEqual([]);

    const saved = (type: number) =>
      ({
        $queryRaw: jest.fn(async () => [{ sb_vchr_type_id: type, sb_bill_refno: 'X1' }]),
      }) as never;
    const body = (t?: number) => ({ ...dto(t), sbId: 'b', sbAccYear: '2026-2027' });
    await expect(billTypeRefusals(saved(68), settings(), body(69), SITE)).resolves.toEqual([
      expect.objectContaining({ code: 'VT_OFFLINE' }),
    ]);
    await expect(billTypeRefusals(saved(68), settings(), body(), SITE)).resolves.toEqual([
      expect.objectContaining({ code: 'VT_OFFLINE' }),
    ]);
    await expect(billTypeRefusals(saved(3), settings(), body(), SITE)).resolves.toEqual([]);
    // a type-3 bill asked to become a child: the lock, as online
    await expect(billTypeRefusals(saved(3), settings(), body(68), SITE)).resolves.toEqual([
      expect.objectContaining({ code: 'VT_BILL_TYPE_LOCKED' }),
    ]);
  });

  it('the bill refusal is worded for a bill (variant field=sbVchrTypeId); the master keeps its own row', () => {
    const catalogue = JSON.parse(
      readFileSync(join(__dirname, '../../../../prisma/seed/Error_Messages.json'), 'utf8'),
    ) as {
      version: string;
      rows: Array<Omit<ErrorWordingRow, 'variant' | 'lang'> & Partial<ErrorWordingRow>>;
    };
    setErrorWording(
      catalogue.rows.map((r) => ({ ...r, variant: r.variant ?? '', lang: r.lang ?? 'en' })),
      catalogue.version,
    );
    try {
      const bill = billOfflineTypeRefusal({ sbVchrTypeId: 68 }, SITE)!;
      expect(wordingFor(bill as never, 'en')).toEqual({
        title: 'Sales Bill only here',
        line: expect.stringContaining('bills only as Sales Bill'),
        todo: expect.any(String),
      });
      expect(wordingFor({ field: 'request', code: 'VT_OFFLINE' }, 'en')).toMatchObject({
        title: 'Only at the head office',
      });
    } finally {
      setErrorWording([], null);
    }
  });
});

describe('billTypeDeliveryMode (delivery tracking Q3, decision 42)', () => {
  it('takes the type’s own, else the base’s, else INSTANT', () => {
    expect(billTypeDeliveryMode('PICKUP', 'INSTANT')).toBe('PICKUP');
    expect(billTypeDeliveryMode(null, 'DISPATCH')).toBe('DISPATCH');
    expect(billTypeDeliveryMode(null, null)).toBe('INSTANT');
    expect(billTypeDeliveryMode('bogus', null)).toBe('INSTANT');
  });

  it('is INSTANT for a POS bill whatever the type says', () => {
    expect(billTypeDeliveryMode('DISPATCH', 'PICKUP', 'POS')).toBe('INSTANT');
    expect(billTypeDeliveryMode('DISPATCH', 'PICKUP', 'WHOLESALE')).toBe('DISPATCH');
  });
});
