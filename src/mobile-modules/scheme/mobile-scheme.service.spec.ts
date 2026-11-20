import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service';
import {
  MobileSchemeService,
  PHONE_SCHEME_WHERE,
  istTimestamp,
  numText,
  toPhoneScheme,
  type PhoneSchemeRow,
} from './mobile-scheme.service';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const TODAY = '2026-11-19';
const D = (value: string | number) => new Prisma.Decimal(value);

function schemeRow(over: Partial<PhoneSchemeRow> = {}): PhoneSchemeRow {
  return {
    prmId: 'prm-1',
    prmCompId: COMPANY,
    prmBranchId: null,
    prmCode: 'FRRE',
    prmName: 'Buy 5 get 1',
    prmStatus: 'APPROVED',
    prmApplyOn: 'ITEM_QTY',
    prmBenefit: 'FREE_ITEM',
    prmPriority: 2,
    prmStackMode: 'EXCLUSIVE',
    prmAutoApply: true,
    prmAllowWithManualDisc: false,
    prmCalcOnAmountType: 'NET_AMOUNT',
    prmIncludeTax: false,
    prmBillType: 'ALL',
    prmMinBillAmount: D(0),
    prmMinQty: D(0),
    prmBranchScope: 'LIST',
    prmCustScope: 'LIST',
    prmItemScope: 'LIST',
    prmPriceLevelId: null,
    prmMaxBenefitPerBill: D('250.5'),
    prmCouponBatchId: null,
    // Prisma reads DATE / TIME columns as UTC instants.
    prmStartDate: new Date('2026-08-24T00:00:00.000Z'),
    prmEndDate: new Date('2027-08-24T00:00:00.000Z'),
    prmValidFromTime: new Date('1970-01-01T09:30:00.000Z'),
    prmValidToTime: null,
    prmValidWeekdays: 'MON,TUE',
    prmRemarks: null,
    prmModifiedOn: new Date('2026-08-24T09:50:31.123Z'),
    branches: [
      {
        prbId: 'prb-1',
        prbBranchId: BRANCH,
        prbIsExclude: false,
        branch: { brName: 'Coimbatore' },
      },
    ],
    parties: [
      {
        prpId: 'prp-1',
        prpKind: 'CUSTOMER_GROUP',
        prpScopeId: 'cgr-1',
        prpIsExclude: false,
        prpMatchPriority: 1,
        customer: null,
        customerGroup: { cgrName: 'Retail' },
        area: null,
        city: null,
      },
      {
        prpId: 'prp-2',
        prpKind: 'CITY',
        prpScopeId: 'ctm-1',
        prpIsExclude: true,
        prpMatchPriority: 2,
        customer: null,
        customerGroup: null,
        area: null,
        city: { ctmName: 'Salem' },
      },
    ],
    items: [
      {
        priId: 'pri-1',
        priKind: 'ITEM',
        priScopeId: 'item-1',
        priUnitId: 'iuc-1',
        priIsExclude: false,
        priDiscPerc: D(0),
        priDiscQty: D('2.5'),
        priDiscAmt: D(0),
        priMinQty: D(3),
        priFactor: D(1),
        priMaxBenefit: D(0),
        priMatchPriority: 4,
        item: { itemNameEn: 'Annam Chilli Powder' },
        itemGroup: null,
        itemCategory: null,
        itemBrand: null,
        itemSection: null,
        unit: { unit: { unit_name: 'PKT' } },
      },
      {
        priId: 'pri-2',
        priKind: 'ITEM_SECTION',
        priScopeId: 'sec-1',
        priUnitId: null,
        priIsExclude: false,
        priDiscPerc: D(3),
        priDiscQty: D(0),
        priDiscAmt: D(0),
        priMinQty: D(0),
        priFactor: D(1),
        priMaxBenefit: D(0),
        priMatchPriority: 1,
        item: null,
        itemGroup: null,
        itemCategory: null,
        itemBrand: null,
        itemSection: { secName: 'Masala' },
        unit: null,
      },
    ],
    slabs: [
      {
        prsId: 'prs-1',
        prsSlno: 1,
        prsBenefit: 'FREE_ITEM',
        prsExceeds: D(5),
        prsUpto: D(10),
        prsEach: D(1),
        prsIsRepeat: false,
        prsMaxRepeats: 0,
        prsFreeItemId: 'item-1',
        prsFreeUnitId: 'iuc-1',
        prsFreeQty: D(1),
        prsFreeStockCheck: true,
        prsDiscPerc: D(0),
        prsDiscQty: D(0),
        prsDiscAmt: D(0),
        prsFixedPrice: null,
        prsMaxBenefitAmt: D(0),
        freeItem: { itemNameEn: 'Annam Chilli Powder' },
        freeUnit: { iucToBaseFactor: D(12), unit: { unit_name: 'PKT' } },
      },
      {
        prsId: 'prs-2',
        prsSlno: 2,
        prsBenefit: 'FREE_ITEM',
        prsExceeds: D('10.5'),
        prsUpto: null,
        prsEach: D(10),
        prsIsRepeat: true,
        prsMaxRepeats: 3,
        prsFreeItemId: null,
        prsFreeUnitId: null,
        prsFreeQty: D(2),
        prsFreeStockCheck: false,
        prsDiscPerc: D(0),
        prsDiscQty: D(0),
        prsDiscAmt: D(0),
        prsFixedPrice: D('95.25'),
        prsMaxBenefitAmt: D(100),
        freeItem: null,
        freeUnit: null,
      },
    ],
    ...over,
  };
}

describe('phone number formats', () => {
  it('numText is exact text at the column scale; NULL stays null', () => {
    expect(numText(D(5), 3)).toBe('5.000');
    expect(numText(D('0.1'), 4)).toBe('0.1000');
    expect(numText(D('12.345'), 2)).toBe('12.35');
    expect(numText(null, 3)).toBeNull();
  });

  it('istTimestamp is IST with its offset; null stays null', () => {
    expect(istTimestamp(new Date('2026-08-24T09:50:31.123Z'))).toBe(
      '2026-08-24T15:20:31.123+05:30',
    );
    // Past IST midnight: the IST date is the next day.
    expect(istTimestamp(new Date('2026-08-24T19:00:00.000Z'))).toBe(
      '2026-08-25T00:30:00.000+05:30',
    );
    expect(istTimestamp(null)).toBeNull();
  });
});

describe('toPhoneScheme (plan §6.1 keys)', () => {
  it('maps the header to the exact snake_case keys, integers as numbers, numerics as text', () => {
    const { branches, parties, items, slabs, ...header } = toPhoneScheme(schemeRow());
    expect(header).toEqual({
      prm_id: 'prm-1',
      prm_comp_id: COMPANY,
      prm_branch_id: null,
      prm_code: 'FRRE',
      prm_name: 'Buy 5 get 1',
      prm_status: 'APPROVED',
      prm_apply_on: 'ITEM_QTY',
      prm_benefit: 'FREE_ITEM',
      prm_priority: 2,
      prm_stack_mode: 'EXCLUSIVE',
      prm_auto_apply: true,
      prm_allow_with_manual_disc: false,
      prm_calc_on_amount_type: 'NET_AMOUNT',
      prm_include_tax: false,
      prm_bill_type: 'ALL',
      prm_min_bill_amount: '0.00',
      prm_min_qty: '0.000',
      prm_branch_scope: 'LIST',
      prm_cust_scope: 'LIST',
      prm_item_scope: 'LIST',
      prm_price_level_id: null,
      prm_max_benefit_per_bill: '250.50',
      prm_coupon_batch_id: null,
      prm_start_date: '2026-08-24',
      prm_end_date: '2027-08-24',
      prm_valid_from_time: '09:30:00',
      prm_valid_to_time: null,
      prm_valid_weekdays: 'MON,TUE',
      prm_remarks: null,
      prm_modified_on: '2026-08-24T15:20:31.123+05:30',
    });
    expect(Object.keys(toPhoneScheme(schemeRow())).slice(-4)).toEqual([
      'branches',
      'parties',
      'items',
      'slabs',
    ]);
    expect(branches).toEqual([
      {
        prb_id: 'prb-1',
        prb_branch_id: BRANCH,
        prb_branch_name: 'Coimbatore',
        prb_is_exclude: false,
      },
    ]);
    expect(parties).toHaveLength(2);
    expect(items).toHaveLength(2);
    expect(slabs).toHaveLength(2);
  });

  it('parties: the scope name is the joined master of the kind of the row', () => {
    expect(toPhoneScheme(schemeRow()).parties).toEqual([
      {
        prp_id: 'prp-1',
        prp_kind: 'CUSTOMER_GROUP',
        prp_scope_id: 'cgr-1',
        prp_scope_name: 'Retail',
        prp_is_exclude: false,
        prp_match_priority: 1,
      },
      {
        prp_id: 'prp-2',
        prp_kind: 'CITY',
        prp_scope_id: 'ctm-1',
        prp_scope_name: 'Salem',
        prp_is_exclude: true,
        prp_match_priority: 2,
      },
    ]);
  });

  it('items: scope and unit names, rates at their scales', () => {
    expect(toPhoneScheme(schemeRow()).items).toEqual([
      {
        pri_id: 'pri-1',
        pri_kind: 'ITEM',
        pri_scope_id: 'item-1',
        pri_scope_name: 'Annam Chilli Powder',
        pri_unit_id: 'iuc-1',
        pri_unit_name: 'PKT',
        pri_is_exclude: false,
        pri_disc_perc: '0.0000',
        pri_disc_qty: '2.5000',
        pri_disc_amt: '0.00',
        pri_min_qty: '3.000',
        pri_factor: '1.0000',
        pri_max_benefit: '0.00',
        pri_match_priority: 4,
      },
      {
        pri_id: 'pri-2',
        pri_kind: 'ITEM_SECTION',
        pri_scope_id: 'sec-1',
        pri_scope_name: 'Masala',
        pri_unit_id: null,
        pri_unit_name: null,
        pri_is_exclude: false,
        pri_disc_perc: '3.0000',
        pri_disc_qty: '0.0000',
        pri_disc_amt: '0.00',
        pri_min_qty: '0.000',
        pri_factor: '1.0000',
        pri_max_benefit: '0.00',
        pri_match_priority: 1,
      },
    ]);
  });

  it('slabs: open upto and fixed price stay null; the free unit brings its factor', () => {
    expect(toPhoneScheme(schemeRow()).slabs).toEqual([
      {
        prs_id: 'prs-1',
        prs_slno: 1,
        prs_benefit: 'FREE_ITEM',
        prs_exceeds: '5.000',
        prs_upto: '10.000',
        prs_each: '1.000',
        prs_is_repeat: false,
        prs_max_repeats: 0,
        prs_free_item_id: 'item-1',
        prs_free_item_name: 'Annam Chilli Powder',
        prs_free_unit_id: 'iuc-1',
        prs_free_unit_name: 'PKT',
        prs_free_unit_factor: '12.000000',
        prs_free_qty: '1.000',
        prs_free_stock_check: true,
        prs_disc_perc: '0.0000',
        prs_disc_qty: '0.0000',
        prs_disc_amt: '0.00',
        prs_fixed_price: null,
        prs_max_benefit_amt: '0.00',
      },
      {
        prs_id: 'prs-2',
        prs_slno: 2,
        prs_benefit: 'FREE_ITEM',
        prs_exceeds: '10.500',
        prs_upto: null,
        prs_each: '10.000',
        prs_is_repeat: true,
        prs_max_repeats: 3,
        prs_free_item_id: null,
        prs_free_item_name: null,
        prs_free_unit_id: null,
        prs_free_unit_name: null,
        prs_free_unit_factor: null,
        prs_free_qty: '2.000',
        prs_free_stock_check: false,
        prs_disc_perc: '0.0000',
        prs_disc_qty: '0.0000',
        prs_disc_amt: '0.00',
        prs_fixed_price: '95.2500',
        prs_max_benefit_amt: '100.00',
      },
    ]);
  });
});

describe('MobileSchemeService.active', () => {
  type Device = { devIsActive: boolean; devIsBlocked: boolean } | null;

  function build(opts: { company?: boolean; device?: Device; ids?: string[] } = {}) {
    const sqls: Array<{ sql: string; values: unknown[] }> = [];
    const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      sqls.push({ sql, values });
      if (sql.includes('public.companys')) {
        return Promise.resolve(
          opts.company === false ? [] : [{ compId: COMPANY, compGstApplicable: true }],
        );
      }
      if (sql.includes('fixed.device_master')) {
        const device = opts.device ?? null;
        return Promise.resolve(
          device
            ? [
                {
                  devId: 'dev-1',
                  devCode: 'D9',
                  devCompanyId: COMPANY,
                  devBranchId: BRANCH,
                  devBlockReason: null,
                  ...device,
                },
              ]
            : [],
        );
      }
      if (sql.includes('CURRENT_DATE')) {
        return Promise.resolve([{ today: TODAY }]);
      }
      if (sql.includes('sales.promotion_scheme')) {
        return Promise.resolve((opts.ids ?? ['prm-1']).map((prmId) => ({ prmId })));
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const findMany = jest.fn().mockResolvedValue([schemeRow()]);
    const prisma = {
      $queryRaw: queryRaw,
      promotionScheme: { findMany },
    } as unknown as PrismaService;
    return { service: new MobileSchemeService(prisma), sqls, findMany };
  }

  it('answers {companyId, asOf, schemes} for the live schemes, by priority, code, id', async () => {
    const { service, findMany } = build();

    const out = await service.active({ companyId: COMPANY });

    expect(Object.keys(out)).toEqual(['companyId', 'asOf', 'schemes']);
    expect(out.companyId).toBe(COMPANY);
    expect(out.asOf).toBe(TODAY);
    expect(out.schemes.map((s) => s.prm_code)).toEqual(['FRRE']);
    const args = findMany.mock.calls[0][0] as {
      where: unknown;
      orderBy: unknown;
      select: Record<string, { where?: unknown; orderBy?: unknown }>;
    };
    expect(args.where).toEqual({
      prmId: { in: ['prm-1'] },
      prmCompId: COMPANY,
      prmIsDeleted: false,
      prmIsActive: true,
      prmStatus: 'APPROVED',
      prmAutoApply: true,
      prmCouponBatchId: null,
    });
    expect(args.orderBy).toEqual([{ prmPriority: 'asc' }, { prmCode: 'asc' }, { prmId: 'asc' }]);
    // Children: live and active only, by slno then id.
    expect(args.select.branches.where).toEqual({ prbIsDeleted: false, prbIsActive: true });
    expect(args.select.parties.where).toEqual({ prpIsDeleted: false, prpIsActive: true });
    expect(args.select.items.where).toEqual({ priIsDeleted: false, priIsActive: true });
    expect(args.select.slabs.where).toEqual({ prsIsDeleted: false, prsIsActive: true });
    expect(args.select.slabs.orderBy).toEqual([{ prsSlno: 'asc' }, { prsId: 'asc' }]);
    expect(args.select.items.orderBy).toEqual([{ priSlno: 'asc' }, { priId: 'asc' }]);
  });

  it('filters ended schemes in SQL against the IST today bound as a DATE, and no branch', async () => {
    const { service, sqls } = build();

    await service.active({ companyId: COMPANY });

    const idQuery = sqls.find((q) => q.sql.includes('sales.promotion_scheme'));
    expect(idQuery).toBeDefined();
    const sql = idQuery!.sql.replace(/\s+/g, ' ');
    for (const clause of [
      'p.prm_comp_id = ?::uuid',
      'p.prm_is_deleted = false',
      'p.prm_is_active = true',
      "p.prm_status = 'APPROVED'",
      'p.prm_auto_apply = true',
      'p.prm_coupon_batch_id IS NULL',
      'p.prm_end_date >= ?::date',
    ]) {
      expect(sql).toContain(clause);
    }
    expect(sql).not.toContain('prm_start_date');
    expect(sql).not.toContain('branch');
    expect(idQuery!.values).toEqual([COMPANY, TODAY]);
    expect(PHONE_SCHEME_WHERE).not.toHaveProperty('prmEndDate');
  });

  it('no live scheme: an empty list, and the children are never read', async () => {
    const { service, findMany } = build({ ids: [] });

    const out = await service.active({ companyId: COMPANY });

    expect(out).toEqual({ companyId: COMPANY, asOf: TODAY, schemes: [] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('an unknown or switched-off company is a 404 MOBILE_COMPANY_NOT_FOUND', async () => {
    const { service, findMany } = build({ company: false });

    const error = await service.active({ companyId: COMPANY }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
    expect((error as HttpException).getResponse()).toMatchObject({
      errors: [{ field: 'companyId', code: 'MOBILE_COMPANY_NOT_FOUND' }],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['not registered', null, 'MOBILE_DEVICE_NOT_REGISTERED'],
    ['blocked', { devIsActive: true, devIsBlocked: true }, 'MOBILE_DEVICE_BLOCKED'],
    ['switched off', { devIsActive: false, devIsBlocked: false }, 'MOBILE_DEVICE_INACTIVE'],
  ] as const)('a %s phone is a 403', async (_label, device, code) => {
    const { service, findMany } = build({ device });

    const error = await service
      .active({ companyId: COMPANY, deviceUid: 'PHONE-1' })
      .catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(403);
    expect((error as HttpException).getResponse()).toMatchObject({
      errors: [{ field: 'deviceUid', code }],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('a registered phone reads the same answer; no deviceUid reads no device', async () => {
    const withPhone = build({ device: { devIsActive: true, devIsBlocked: false } });
    const out = await withPhone.service.active({ companyId: COMPANY, deviceUid: 'PHONE-1' });
    expect(out.schemes).toHaveLength(1);
    expect(withPhone.sqls.some((q) => q.sql.includes('fixed.device_master'))).toBe(true);

    const noPhone = build();
    await noPhone.service.active({ companyId: COMPANY });
    expect(noPhone.sqls.some((q) => q.sql.includes('fixed.device_master'))).toBe(false);
  });
});
