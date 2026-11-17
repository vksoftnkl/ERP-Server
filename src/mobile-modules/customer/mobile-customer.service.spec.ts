import { Prisma } from '@prisma/client';
import {
  balanceStatusOf,
  balancesSql,
  escapeLike,
  filterSql,
  MobileCustomerService,
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
        }),
      ],
      counts: { all: 3, outstanding: 1, unregistered: 2, inactive: 1 },
      total: 3,
      page: 1,
      pageSize: 2,
      hasMore: true,
      balanceAsOn: '2026-11-16',
      accYear: '2026-2027',
    });
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
    expect(out.items[0]).toEqual(expect.objectContaining({ balance: null, balanceStatus: null }));
    expect(out.balanceAsOn).toBeNull();
    expect(out.accYear).toBeNull();
  });

  it('adds the balance to the desktop get payload, 0 when the ledger has no books', async () => {
    customerService.getById.mockResolvedValue({
      cusId: CUS_ID,
      cusName: 'Sri Velan Agencies',
      cusCreditAmtLimit: 0,
    });
    queryRaw
      .mockResolvedValueOnce([{ name: '2026-2027', today: '2026-11-16' }])
      .mockResolvedValueOnce([]);

    const out = await service.getById(CUS_ID);

    expect(customerService.getById).toHaveBeenCalledWith(CUS_ID);
    expect(out).toEqual(
      expect.objectContaining({
        cusId: CUS_ID,
        balance: { amount: '0.00', side: 'DR' },
        balanceStatus: 'SETTLED',
      }),
    );
  });

  it('lets the desktop 404 through on get', async () => {
    customerService.getById.mockRejectedValue(new Error('CUSTOMER_NOT_FOUND'));

    await expect(service.getById(CUS_ID)).rejects.toThrow('CUSTOMER_NOT_FOUND');
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
