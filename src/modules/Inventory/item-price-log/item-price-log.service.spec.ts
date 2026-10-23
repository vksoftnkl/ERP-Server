import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import type { ListItemPriceLogQueryDto } from './dto/item-price-log-query.dto';
import { ItemPriceLogController } from './item-price-log.controller';
import { ItemPriceLogService } from './item-price-log.service';

const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const IPCL_ID = '01000000-0000-7000-8000-000000000091';

const VIEW = [{ um_can_view: true }];
const statementOf = (mock: jest.Mock, call: number): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};
const squash = (sql: Prisma.Sql) => sql.text.replace(/\s+/g, ' ');

const logRow = (overrides: Record<string, unknown> = {}) => ({
  ipclId: IPCL_ID,
  changedOn: '2026-10-23T12:30:00.000+05:30',
  day: '2026-10-23',
  changeSetId: '01000000-0000-7000-8000-000000000092',
  priceTable: 'IQP',
  rowId: '01000000-0000-7000-8000-000000000061',
  action: 'UPDATE',
  source: 'QTY_PRICE',
  menuId: 244,
  itemId: ITEM_ID,
  itemName: 'Salt 1 Kg',
  changed: ['iqp_price'],
  changedValues: { iqp_price: [128, 125] },
  oldPriceA: null,
  newPriceA: null,
  oldSlabPrice: 128,
  newSlabPrice: 125,
  totalCount: 3n,
  ...overrides,
});

const filter = (overrides: Partial<ListItemPriceLogQueryDto> = {}): ListItemPriceLogQueryDto => ({
  companyId: COMPANY_ID,
  fromDate: '2026-10-01',
  toDate: '2026-10-23',
  ...overrides,
});

describe('ItemPriceLogService', () => {
  let queryRaw: jest.Mock;
  let service: ItemPriceLogService;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([]);
    service = new ItemPriceLogService(
      { $queryRaw: queryRaw } as unknown as PrismaService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  it('403s without VIEW on menu 290, before reading the log', async () => {
    await expect(service.list(filter())).rejects.toBeInstanceOf(ForbiddenException);
    expect(statementOf(queryRaw, 0).values).toEqual([USER_ID, 290]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('lists newest first with only the filters that were set, and a % for the headline figure', async () => {
    queryRaw.mockResolvedValueOnce(VIEW).mockResolvedValueOnce([logRow()]);

    const out = await service.list({
      ...filter({ branchId: BRANCH_ID, priceTable: 'IQP' }),
      limit: 50,
    });

    const sql = statementOf(queryRaw, 1);
    expect(squash(sql)).toContain(
      '(l.ipcl_company_id = $1::uuid OR l.ipcl_company_id IS NULL) AND l.ipcl_changed_on >= $2::date ' +
        'AND l.ipcl_changed_on < $3::date + 1 AND (l.ipcl_branch_id = $4::uuid OR l.ipcl_branch_id IS NULL) ' +
        'AND l.ipcl_price_table = $5',
    );
    expect(sql.text).not.toContain('IS NULL OR l.ipcl_user_id');
    expect(squash(sql)).toContain(
      'ORDER BY l.ipcl_changed_on DESC, l.ipcl_id DESC LIMIT $6 OFFSET $7',
    );
    expect(sql.values.slice(-2)).toEqual([50, 0]);
    expect(out.meta).toEqual({ page: 1, limit: 50, total: 3 });
    expect(out.items[0]).toMatchObject({ changedLabels: ['Slab price'], changePct: -2.34 });
    expect(out.items[0]).not.toHaveProperty('totalCount');
  });

  it('puts before → after of every changed column on each list row (notes 145)', async () => {
    queryRaw.mockResolvedValueOnce(VIEW).mockResolvedValueOnce([
      logRow({
        priceTable: 'IPM',
        changed: ['ipm_sales_price_b', 'ipm_price_b_wot', 'ipm_price_b_markup_perc'],
        changedValues: {
          ipm_sales_price_b: [118, 119],
          ipm_price_b_wot: [100, 100.847458],
          ipm_price_b_markup_perc: [48.82, 50.08],
        },
      }),
      // A create has no before: its pair's first member is JSON null.
      logRow({
        action: 'CREATE',
        changed: ['iqp_price'],
        changedValues: { iqp_price: [null, 125] },
      }),
    ]);

    const out = await service.list(filter());

    expect(out.items[0].fields).toEqual([
      { column: 'ipm_sales_price_b', label: 'Price B', before: 118, after: 119 },
      { column: 'ipm_price_b_wot', label: 'Price B (w/o tax)', before: 100, after: 100.847458 },
      { column: 'ipm_price_b_markup_perc', label: 'Markup B %', before: 48.82, after: 50.08 },
    ]);
    expect(out.items[1].fields).toEqual([
      { column: 'iqp_price', label: 'Slab price', before: null, after: 125 },
    ]);
    expect(out.items[0]).not.toHaveProperty('changedValues');
    // The pairs come from the changed columns only, never the whole rows.
    expect(squash(statementOf(queryRaw, 1))).toContain('FROM unnest(l.ipcl_changed) AS c(col)');
  });

  it('reads a soft delete as Deleted false → true, though the log keeps no row after it', async () => {
    queryRaw.mockResolvedValueOnce(VIEW).mockResolvedValueOnce([
      logRow({
        action: 'DELETE',
        changed: ['iqp_is_deleted'],
        changedValues: { iqp_is_deleted: [false, null] },
      }),
    ]);

    const out = await service.list(filter());

    expect(out.items[0].fields).toEqual([
      { column: 'iqp_is_deleted', label: 'Deleted', before: false, after: true },
    ]);
  });

  it('filters by device and by one changed column when asked (notes 145)', async () => {
    const DEVICE_ID = '01000000-0000-7000-8000-0000000000d1';
    queryRaw.mockResolvedValueOnce(VIEW).mockResolvedValueOnce([]);

    await service.days(filter({ deviceId: DEVICE_ID, field: 'ipm_sales_price_b' }));

    const sql = statementOf(queryRaw, 1);
    expect(squash(sql)).toContain(
      'AND l.ipcl_device_id = $4::uuid AND $5::text = ANY (l.ipcl_changed)',
    );
    expect(sql.values.slice(3)).toEqual([DEVICE_ID, 'ipm_sales_price_b']);
  });

  it('refuses a range that runs backwards or past a year', async () => {
    queryRaw.mockResolvedValue(VIEW);

    await expect(service.list(filter({ toDate: '2026-09-30' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.days(filter({ fromDate: '2025-01-01' }))).rejects.toMatchObject({
      response: { errors: [{ code: 'IPCL_BAD_RANGE' }] },
    });
  });

  it('gets one change with its labelled diff', async () => {
    queryRaw
      .mockResolvedValueOnce(VIEW)
      .mockResolvedValueOnce([logRow({ before: { iqp_price: 128 }, after: { iqp_price: 125 } })]);

    const out = await service.get({ ipclId: IPCL_ID });

    expect(out.fields).toEqual([
      { column: 'iqp_price', label: 'Slab price', before: 128, after: 125 },
    ]);
  });

  it('404s IPCL_NOT_FOUND for an unknown id', async () => {
    queryRaw.mockResolvedValueOnce(VIEW).mockResolvedValueOnce([]);

    const refusal = await service.get({ ipclId: IPCL_ID }).catch((e: unknown) => e);

    expect(refusal).toBeInstanceOf(NotFoundException);
    expect(refusal).toMatchObject({ response: { errors: [{ code: 'IPCL_NOT_FOUND' }] } });
  });

  it('counts the gaps per table and samples them', async () => {
    queryRaw
      .mockResolvedValueOnce(VIEW)
      .mockResolvedValueOnce([
        { priceTable: 'IPM', rowId: 'a', itemId: ITEM_ID, reason: 'NOT_LOGGED' },
        { priceTable: 'IQP', rowId: 'b', itemId: ITEM_ID, reason: 'DIFFERS' },
      ])
      .mockResolvedValueOnce([{ since: '2026-10-23T12:00:00.000+05:30' }]);

    const out = await service.gaps({});

    expect(out).toMatchObject({
      since: '2026-10-23T12:00:00.000+05:30',
      total: 2,
      priceRows: 1,
      slabRows: 1,
    });
    expect(squash(statementOf(queryRaw, 1))).toContain('to_jsonb(p) - $1::text[]');
  });
});

describe('ItemPriceLogController', () => {
  it('words the gap count', async () => {
    const service = {
      gaps: jest
        .fn()
        .mockResolvedValue({ since: null, total: 0, priceRows: 0, slabRows: 0, sample: [] }),
    };
    const controller = new ItemPriceLogController(service as unknown as ItemPriceLogService);

    await expect(controller.gaps({})).resolves.toMatchObject({ success: true, message: 'No gaps' });
  });
});
