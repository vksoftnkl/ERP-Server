import { Prisma } from '@prisma/client';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { actionOf, changedColumns, scopeOf } from './price-change-diff';
import { appOf, PriceChangeLogService } from './price-change-log.service';
import { orderColumns } from './price-field-labels';
import { PRICE_ORIGIN } from './types/price-change-log.types';

const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const DEVICE_ID = '01000000-0000-7000-8000-0000000000d1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const IPM_ID = '01000000-0000-7000-8000-000000000041';
const IQP_ID = '01000000-0000-7000-8000-000000000061';
const PARTY_ID = '01000000-0000-7000-8000-000000000071';

const statementOf = (mock: jest.Mock, call = 0): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

const ipm = (overrides: Record<string, unknown> = {}) => ({
  ipm_id: IPM_ID,
  ipm_company_id: COMPANY_ID,
  ipm_branch_id: null,
  ipm_item_id: ITEM_ID,
  ipm_uc_unit_id: UOM_ID,
  ipm_godown_id: null,
  ipm_sales_price_a: 38,
  ipm_max_price: 40,
  ipm_bucket_mrp: 40,
  ipm_bucket_sp: null,
  ipm_key_mrp: 40,
  ipm_is_deleted: false,
  ipm_effective_from: '1900-01-01',
  ipm_effective_to: '9999-12-31',
  ipm_updated_on: '2026-10-23T12:00:00+05:30',
  ipm_updated_by: USER_ID,
  ...overrides,
});

const iqp = (overrides: Record<string, unknown> = {}) => ({
  iqp_id: IQP_ID,
  iqp_company_id: COMPANY_ID,
  iqp_branch_id: null,
  iqp_party_id: PARTY_ID,
  iqp_price_level: 2,
  iqp_item_id: ITEM_ID,
  iqp_item_unit_id: UOM_ID,
  iqp_from_qty: 10,
  iqp_to_qty: null,
  iqp_price: 128,
  iqp_is_deleted: false,
  iqp_effective_from: '2026-10-01',
  iqp_effective_to: null,
  iqp_modified_on: '2026-10-23T12:00:00+05:30',
  iqp_sync_date: null,
  ...overrides,
});

describe('price-change-diff', () => {
  it('judges a change by business columns only (notes 144 §5)', () => {
    expect(
      changedColumns('IPM', ipm(), ipm({ ipm_updated_on: 'later', ipm_updated_by: 'someone' })),
    ).toEqual([]);
    expect(
      changedColumns('IQP', iqp(), iqp({ iqp_modified_on: 'later', iqp_sync_date: 'now' })),
    ).toEqual([]);
    expect(changedColumns('IQP', iqp(), iqp({ iqp_price: 125, iqp_to_qty: 20 }))).toEqual([
      'iqp_to_qty',
      'iqp_price',
    ]);
  });

  it('ignores the generated key columns, which follow the bucket', () => {
    expect(changedColumns('IPM', ipm(), ipm({ ipm_bucket_mrp: 42, ipm_key_mrp: 42 }))).toEqual([
      'ipm_bucket_mrp',
    ]);
  });

  it('names what a create set and what a delete had', () => {
    expect(changedColumns('IQP', null, iqp())).not.toContain('iqp_to_qty');
    expect(changedColumns('IQP', null, iqp())).toContain('iqp_price');
    expect(changedColumns('IPM', ipm(), null)).toContain('ipm_sales_price_a');
  });

  it('lists changed columns level by level — price, w/o tax, markup — never the row id (notes 145)', () => {
    const before = ipm({ ipm_price_a_wot: 32, ipm_price_a_markup_perc: 10, ipm_sales_price_b: 37 });
    const after = ipm({
      ipm_sales_price_a: 39,
      ipm_price_a_wot: 33,
      ipm_price_a_markup_perc: 11,
      ipm_sales_price_b: 36,
    });
    expect(changedColumns('IPM', before, after)).toEqual([
      'ipm_sales_price_a',
      'ipm_price_a_wot',
      'ipm_price_a_markup_perc',
      'ipm_sales_price_b',
    ]);
    expect(changedColumns('IQP', null, iqp())).not.toContain('iqp_id');
    expect(orderColumns(['ipm_price_b_wot', 'ipm_sales_price_b', 'iqp_id', 'zzz_new'])).toEqual([
      'ipm_sales_price_b',
      'ipm_price_b_wot',
      'zzz_new',
    ]);
  });

  it('reads the action off the deleted flag', () => {
    expect(actionOf('IPM', null, ipm())).toBe('CREATE');
    expect(actionOf('IPM', ipm(), ipm({ ipm_is_deleted: true }))).toBe('DELETE');
    expect(actionOf('IQP', iqp({ iqp_is_deleted: true }), iqp())).toBe('RESTORE');
    expect(actionOf('IQP', iqp(), iqp({ iqp_price: 1 }))).toBe('UPDATE');
  });

  it('maps where a slab applies from the slab (notes 144 §2), no godown and no bucket', () => {
    expect(scopeOf('IQP', iqp())).toEqual({
      companyId: COMPANY_ID,
      branchId: null,
      itemId: ITEM_ID,
      unitId: UOM_ID,
      godownId: null,
      partyId: PARTY_ID,
      priceLevel: 2,
      bucketMrp: null,
      bucketSp: null,
      effectiveFrom: '2026-10-01',
      effectiveTo: null,
    });
    expect(scopeOf('IPM', ipm())).toMatchObject({ bucketMrp: 40, partyId: null, priceLevel: null });
  });
});

describe('PriceChangeLogService', () => {
  let tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let userId: string | null;
  let service: PriceChangeLogService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { user_name: 'tester1', device_name: 'TILL-01', device_type: 'Desktop' },
        ]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    userId = USER_ID;
    service = new PriceChangeLogService({
      getUserId: () => userId,
      getDeviceId: () => DEVICE_ID,
      getIpAddress: () => '192.168.0.50',
    } as unknown as RequestContextService);
  });

  describe('snapshot', () => {
    it('reads nothing for no rows', async () => {
      await expect(service.snapshot(tx as never, 'IPM', [])).resolves.toEqual(new Map());
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('reads each table as to_jsonb, keyed by id', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: IQP_ID, row: iqp() }]);

      const rows = await service.snapshot(tx as never, 'IQP', [IQP_ID, IQP_ID]);

      expect(rows.get(IQP_ID)).toEqual(iqp());
      const statement = statementOf(tx.$queryRaw);
      expect(statement.sql).toContain('to_jsonb(q)');
      expect(statement.sql).toContain('FROM inventory.item_qty_price q');
      expect(statement.values).toEqual([[IQP_ID]]);
    });
  });

  describe('record', () => {
    it('writes nothing for a no-op — only stamps moved', async () => {
      const wrote = await service.record(tx as never, {
        table: 'IPM',
        rowId: IPM_ID,
        origin: PRICE_ORIGIN.ITEM_CARD,
        before: ipm(),
        after: ipm({ ipm_updated_on: 'later' }),
      });

      expect(wrote).toBe(false);
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    });

    it('files an update with who / from where from the request, never a body', async () => {
      const wrote = await service.record(tx as never, {
        table: 'IPM',
        rowId: IPM_ID,
        origin: { ...PRICE_ORIGIN.CHANGE_SELLING_PRICE, reason: 'Confirmed below cost: x' },
        before: ipm(),
        after: ipm({ ipm_sales_price_a: 36 }),
      });

      expect(wrote).toBe(true);
      const insert = statementOf(tx.$executeRaw);
      expect(insert.sql).toContain('INSERT INTO inventory.item_price_change_log');
      const v = insert.values;
      // change set, table, row, action, source, menu
      expect(v.slice(1, 6)).toEqual(['IPM', IPM_ID, 'UPDATE', 'CHANGE_SELLING_PRICE', 30]);
      expect(v).toEqual(
        expect.arrayContaining([
          USER_ID,
          'tester1',
          DEVICE_ID,
          'TILL-01',
          '192.168.0.50',
          'DESKTOP',
        ]),
      );
      expect(v).toContain('Confirmed below cost: x');
      expect(v).toContainEqual(['ipm_sales_price_a']);
      expect(v).toContain(JSON.stringify(ipm({ ipm_sales_price_a: 36 })));
    });

    it('keeps only the row before for a soft delete (ck_ipcl_shape)', async () => {
      await service.record(tx as never, {
        table: 'IQP',
        rowId: IQP_ID,
        origin: PRICE_ORIGIN.QTY_PRICE,
        before: iqp(),
        after: iqp({ iqp_is_deleted: true }),
      });

      const v = statementOf(tx.$executeRaw).values;
      expect(v[3]).toBe('DELETE');
      expect(v).toContain(JSON.stringify(iqp()));
      expect(v).not.toContain(JSON.stringify(iqp({ iqp_is_deleted: true })));
      expect(v).toContainEqual(['iqp_is_deleted']);
      // Where it applied: the party and level of the slab it was.
      expect(v).toEqual(expect.arrayContaining([PARTY_ID, 2]));
    });

    it('shares one change set, and one who-lookup, across a transaction', async () => {
      const entry = {
        table: 'IPM' as const,
        rowId: IPM_ID,
        origin: PRICE_ORIGIN.ITEM_CARD,
        before: null,
        after: ipm(),
      };
      await service.record(tx as never, entry);
      await service.record(tx as never, entry);
      const otherTx = { ...tx };
      await service.record(otherTx as never, entry);

      const sets = tx.$executeRaw.mock.calls.map(
        (_, call) => statementOf(tx.$executeRaw, call).values[0],
      );
      expect(sets[0]).toBe(sets[1]);
      expect(sets[2]).not.toBe(sets[0]);
      // one names lookup per transaction
      expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('is SYSTEM with no user in the request', async () => {
      userId = null;

      await service.record(tx as never, {
        table: 'IPM',
        rowId: IPM_ID,
        origin: PRICE_ORIGIN.BUCKET_REKEY,
        before: ipm(),
        after: ipm({ ipm_bucket_mrp: 42 }),
        action: 'REKEY',
      });

      const v = statementOf(tx.$executeRaw).values;
      expect(v[3]).toBe('REKEY');
      expect(v).toContain('SYSTEM');
    });
  });

  it('maps a device type to the app', () => {
    expect(appOf(null, 'Desktop')).toBe('SYSTEM');
    expect(appOf(USER_ID, 'PC')).toBe('DESKTOP');
    expect(appOf(USER_ID, 'web')).toBe('WEB');
    expect(appOf(USER_ID, 'Mobile')).toBe('API');
    expect(appOf(USER_ID, null)).toBe('API');
  });
});
