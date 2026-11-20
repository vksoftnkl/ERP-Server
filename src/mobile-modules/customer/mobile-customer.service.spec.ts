import { Prisma } from '@prisma/client';
import {
  balanceStatusOf,
  balancesSql,
  escapeLike,
  filterSql,
  MobileCustomerService,
  outstandingScope,
  outstandingSql,
  searchSql,
} from './mobile-customer.service';
import type { PrismaService } from '../../database/prisma/prisma.service';
import type { RequestContextService } from '../../common/request-context/request-context.service';
import type { CustomerService } from '../../modules/sales/customer/customer.service';

const COMPANY = '019c997a-6346-71d2-bc7e-e3d0ece556db';
const CUS_ID = '019c6f6c-be87-7a11-8905-36092c46e101';

const listRow = (overrides: Record<string, unknown> = {}) => ({
  n_all: 3,
  n_outstanding: 1,
  n_unregistered: 2,
  n_inactive: 1,
  n_filtered: 3,
  cus_id: CUS_ID,
  cus_name: 'Sri Velan Agencies',
  cus_short: 'SVA',
  cus_code: null,
  cus_city: 'Namakkal',
  area_name: 'Bus Stand',
  cus_phone1: '9843123456',
  cus_whatsapp_no: null,
  cus_gst_no: '33AAKFS4521K1Z8',
  cus_gst_type: 'REGULAR',
  cus_is_active: true,
  cus_credit_amt_limit: new Prisma.Decimal(100000),
  bal: new Prisma.Decimal('124500.5'),
  owed: new Prisma.Decimal('130250'),
  owed_bills: 3,
  oldest_date: '2026-09-08',
  ...overrides,
});

describe('mobile customer SQL helpers', () => {
  it('escapes the ILIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x');
  });

  it('adds no search clause for a blank term', () => {
    expect(searchSql(undefined)).toBe(Prisma.empty);
    expect(searchSql('   ')).toBe(Prisma.empty);
  });

  it('matches text columns with the escaped term', () => {
    const sql = searchSql('sri_v');
    expect(sql.values).toEqual(Array(9).fill('%sri\\_v%'));
    expect(sql.sql).not.toContain('regexp_replace');
  });

  it('also matches a spaced phone number against digit-only phone columns', () => {
    const sql = searchSql('98431 23456');
    expect(sql.sql).toContain('regexp_replace');
    expect(sql.values).toContain('%9843123456%');
  });

  it('does not treat a short or mixed term as a phone number', () => {
    expect(searchSql('12').sql).not.toContain('regexp_replace');
    expect(searchSql('33AAK').sql).not.toContain('regexp_replace');
  });

  it.each([
    ['ALL', 'true'],
    ['OUTSTANDING', 'b.bal > 0'],
    ['UNREGISTERED', 'b.is_unregistered'],
    ['INACTIVE', 'NOT b.cus_is_active'],
  ] as const)('filter %s reads %s', (filter, text) => {
    expect(filterSql(filter).sql).toBe(text);
  });

  it('reads no balances without a scope', () => {
    expect(balancesSql(null, null).sql).toContain('WHERE false');
  });

  it('reads opening set + counted legs up to the as-on day', () => {
    const sql = balancesSql(
      { companyId: COMPANY, accYear: '2026-2027', branchId: null, asOn: '2026-11-16' },
      { ledgerId: CUS_ID },
    );
    expect(sql.sql).toContain('accounts.acc_opening_balance');
    expect(sql.sql).toContain('accounts.acc_vouchers');
    expect(sql.values).toEqual(
      expect.arrayContaining([COMPANY, '2026-2027', '2026-11-16', CUS_ID]),
    );
  });

  it('reads no outstanding without a scope', () => {
    expect(outstandingSql(null, null).sql).toContain('WHERE false');
  });

  it("outstanding = the Party Outstanding report's owed, as its party card reads it", () => {
    const scope = { companyId: COMPANY, accYear: '2026-2027', branchId: null, asOn: '2026-11-16' };
    expect(outstandingScope(scope, CUS_ID, '2026-11-16')).toEqual(
      expect.objectContaining({
        companyId: COMPANY,
        asOn: '2026-11-16',
        today: '2026-11-16',
        fyName: '2026-2027',
        branchId: null,
        side: 'RECEIVABLE',
        owedSide: 'DR',
        group: null,
        areaId: null,
        salesmanId: null,
        partyId: CUS_ID,
        deductPdc: false,
      }),
    );
    const sql = outstandingSql(scope, CUS_ID);
    // The report's own chain (bills pending on D, per party), not a copy of it.
    expect(sql.sql).toContain('accounts.acc_bill_balance');
    expect(sql.sql).toContain('accounts.acc_bill_adjustment');
    expect(sql.sql).toContain('pf.owed');
    expect(sql.sql).toContain('FROM pf');
    expect(sql.values).toEqual(
      expect.arrayContaining([COMPANY, '2026-2027', '2026-11-16', CUS_ID]),
    );
  });

  it.each([
    [null, 0, null],
    [0, 0, 'SETTLED'],
    [-10, 0, 'ADVANCE'],
    [10, 0, 'OUTSTANDING'],
    [10, 10, 'OUTSTANDING'],
    [10.01, 10, 'OVER_LIMIT'],
  ] as const)('balance %s with limit %s is %s', (bal, limit, status) => {
    expect(balanceStatusOf(bal, limit)).toBe(status);
  });
});

describe('MobileCustomerService', () => {
  let queryRaw: jest.Mock;
  let tx: { $executeRaw: jest.Mock; $queryRaw: jest.Mock };
  let companyId: string | null;
  let customerService: { getById: jest.Mock };
  let service: MobileCustomerService;

  beforeEach(() => {
    companyId = COMPANY;
    queryRaw = jest.fn();
    tx = { $executeRaw: jest.fn().mockResolvedValue(0), $queryRaw: queryRaw };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const context = { getCompanyId: () => companyId } as unknown as RequestContextService;
    customerService = { getById: jest.fn() };
    service = new MobileCustomerService(
      prisma,
      context,
      customerService as unknown as CustomerService,
    );
  });

  it('pages the list and reports counts, the year and the as-on day', async () => {
    queryRaw
      .mockResolvedValueOnce([{ name: '2026-2027', today: '2026-11-16' }])
      .mockResolvedValueOnce([listRow()]);

    const out = await service.list({ page: 1, pageSize: 2 });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(out).toEqual({
      items: [
        expect.objectContaining({
          cusId: CUS_ID,
          cusAreaName: 'Bus Stand',
          cusCreditAmtLimit: '100000.00',
          balance: { amount: '124500.50', side: 'DR' },
          balanceStatus: 'OVER_LIMIT',
          outstanding: '130250.00',
          outstandingBills: 3,
          oldestBillDate: '2026-09-08',
        }),
      ],
      counts: { all: 3, outstanding: 1, unregistered: 2, inactive: 1 },
      total: 3,
      page: 1,
      pageSize: 2,
      hasMore: true,
      balanceAsOn: '2026-11-16',
      accYear: '2026-2027',
      companyId: COMPANY,
    });
  });

  it('a customer with nothing open: outstanding 0.00, no bills, no oldest date', async () => {
    queryRaw
      .mockResolvedValueOnce([{ name: '2026-2027', today: '2026-11-16' }])
      .mockResolvedValueOnce([
        listRow({ bal: new Prisma.Decimal(-500), owed: null, owed_bills: null, oldest_date: null }),
      ]);

    const out = await service.list({});

    expect(out.items[0]).toEqual(
      expect.objectContaining({
        balance: { amount: '500.00', side: 'CR' },
        balanceStatus: 'ADVANCE',
        outstanding: '0.00',
        outstandingBills: 0,
        oldestBillDate: null,
      }),
    );
  });

  it('returns counts and no items for a page past the end', async () => {
    const emptyPage = Object.fromEntries(
      Object.keys(listRow())
        .filter((k) => !k.startsWith('n_'))
        .map((k) => [k, null]),
    );
    queryRaw
      .mockResolvedValueOnce([{ name: '2026-2027', today: '2026-11-16' }])
      .mockResolvedValueOnce([listRow(emptyPage)]);

    const out = await service.list({ page: 9 });

    expect(out.items).toEqual([]);
    expect(out.total).toBe(3);
    expect(out.hasMore).toBe(false);
    expect(out.pageSize).toBe(50);
  });

  it('shows no balance when the login has no company', async () => {
    companyId = null;
    queryRaw.mockResolvedValueOnce([listRow({ bal: null })]);

    const out = await service.list({});

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(out.items[0]).toEqual(
      expect.objectContaining({
        balance: null,
        balanceStatus: null,
        outstanding: null,
        outstandingBills: null,
        oldestBillDate: null,
      }),
    );
    expect(out.balanceAsOn).toBeNull();
    expect(out.accYear).toBeNull();
    expect(out.companyId).toBeNull();
  });

  it('adds the balance to the desktop get payload, 0 when the ledger has no books', async () => {
    customerService.getById.mockResolvedValue({
      cusId: CUS_ID,
      cusName: 'Sri Velan Agencies',
      cusCreditAmtLimit: 0,
    });
    queryRaw
      .mockResolvedValueOnce([{ name: '2026-2027', today: '2026-11-16' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const out = await service.getById(CUS_ID);

    expect(customerService.getById).toHaveBeenCalledWith(CUS_ID);
    expect(out).toEqual(
      expect.objectContaining({
        cusId: CUS_ID,
        balance: { amount: '0.00', side: 'DR' },
        balanceStatus: 'SETTLED',
        outstanding: '0.00',
        outstandingBills: 0,
        oldestBillDate: null,
      }),
    );
  });

  it("adds the customer's outstanding to get, read for that customer only", async () => {
    customerService.getById.mockResolvedValue({ cusId: CUS_ID, cusCreditAmtLimit: 0 });
    queryRaw
      .mockResolvedValueOnce([{ name: '2026-2027', today: '2026-11-16' }])
      .mockResolvedValueOnce([{ bal: new Prisma.Decimal('8450') }])
      .mockResolvedValueOnce([
        { owed: new Prisma.Decimal('12350'), owed_bills: 2, oldest_date: '2026-10-01' },
      ]);

    const out = await service.getById(CUS_ID);

    expect(out).toEqual(
      expect.objectContaining({
        balance: { amount: '8450.00', side: 'DR' },
        outstanding: '12350.00',
        outstandingBills: 2,
        oldestBillDate: '2026-10-01',
      }),
    );
    // The third read is the report's chain narrowed to this one customer.
    const inner = queryRaw.mock.calls[2][1] as Prisma.Sql;
    expect(inner.sql).toContain('accounts.acc_bill_balance');
    expect(inner.values).toContain(CUS_ID);
  });

  it('get without a company: no balance and no outstanding', async () => {
    companyId = null;
    customerService.getById.mockResolvedValue({ cusId: CUS_ID, cusCreditAmtLimit: 0 });

    const out = await service.getById(CUS_ID);

    expect(out).toEqual(
      expect.objectContaining({
        balance: null,
        outstanding: null,
        outstandingBills: null,
        oldestBillDate: null,
      }),
    );
  });

  it('lets the desktop 404 through on get', async () => {
    customerService.getById.mockRejectedValue(new Error('CUSTOMER_NOT_FOUND'));

    await expect(service.getById(CUS_ID)).rejects.toThrow('CUSTOMER_NOT_FOUND');
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe('MobileCustomerService.formOptions', () => {
  const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
  const CITY_ID = '019c6f6c-be87-7a11-8905-36092c46e202';

  function build() {
    const areaFind = jest
      .fn()
      .mockResolvedValue([
        { armId: AREA_ID, armName: 'Bus Stand', armCityId: CITY_ID, city: { ctmName: 'Namakkal' } },
      ]);
    const prisma = {
      areaMaster: { findMany: areaFind },
      custGroup: { findMany: jest.fn().mockResolvedValue([{ cgrId: 'g1', cgrName: 'Retail' }]) },
      itemPriceLevel: { findMany: jest.fn().mockResolvedValue([{ iplId: 1, iplName: 'WS' }]) },
      stateCode: {
        findMany: jest.fn().mockResolvedValue([{ stateCode: '33', stateName: 'Tamil Nadu' }]),
      },
    } as unknown as PrismaService;
    const context = { getCompanyId: () => null } as unknown as RequestContextService;
    const service = new MobileCustomerService(prisma, context, {} as unknown as CustomerService);
    return { service, areaFind };
  }

  it("areas carry the beat's city id (arm_city_id) for CITY scheme rows", async () => {
    const { service, areaFind } = build();

    const options = await service.formOptions();

    expect(options.areas).toEqual([
      { id: AREA_ID, name: 'Bus Stand', cityId: CITY_ID, cityName: 'Namakkal' },
    ]);
    expect(areaFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { armIsDeleted: false, armIsActive: true },
        select: {
          armId: true,
          armName: true,
          armCityId: true,
          city: { select: { ctmName: true } },
        },
      }),
    );
    expect(options.groups).toEqual([{ id: 'g1', name: 'Retail' }]);
  });
});
