import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { ItemColourMasterService } from './item-colour-master.service';
import { ItemSizeMasterService } from './item-size-master.service';
import { ItemColourErrorCode, ItemSizeErrorCode } from './types/item-attribute-master.types';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const SIZE_ID = '01000000-0000-7000-8000-0000000000a1';
const OTHER_ID = '01000000-0000-7000-8000-0000000000a2';
const CREATED_ON = new Date('2026-10-23T10:00:00.000Z');

const sqlOf = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};
const squash = (sql: Prisma.Sql) => sql.text.replace(/\s+/g, ' ');

const sizeRow = (overrides: Record<string, unknown> = {}) => ({
  isz_id: SIZE_ID,
  isz_company_id: COMPANY_ID,
  isz_code: null,
  isz_name: 'XL',
  isz_size_set: null,
  isz_sort: 0,
  isz_is_active: true,
  isz_is_deleted: false,
  isz_sync_date: null,
  isz_created_on: CREATED_ON,
  isz_created_by: 'user-1',
  isz_modified_on: null,
  isz_modified_by: null,
  ...overrides,
});

describe('ItemSizeMasterService / ItemColourMasterService (addendum 2 E1)', () => {
  let queryRaw: jest.Mock;
  let logEntityChange: jest.Mock;
  let world: {
    company?: boolean;
    clash?: { id: string; name: string };
    existing?: Record<string, unknown>;
    inUse?: number;
  };
  let sizes: ItemSizeMasterService;
  let colours: ItemColourMasterService;

  beforeEach(() => {
    world = { company: true, existing: sizeRow() };
    queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Prisma.sql(strings, ...values).text;
      if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve([{ locked: 1 }]);
      if (sql.includes('FROM public.companys'))
        return Promise.resolve(world.company ? [{ comp_id: COMPANY_ID }] : []);
      if (sql.includes('AS id,')) return Promise.resolve(world.clash ? [world.clash] : []);
      if (sql.includes('UNION ALL') || sql.includes('count(*) AS n'))
        return Promise.resolve([{ ord: 0, n: BigInt(world.inUse ?? 0) }]);
      if (sql.includes('FOR UPDATE'))
        return Promise.resolve(world.existing ? [world.existing] : []);
      if (sql.includes('INSERT INTO')) return Promise.resolve([sizeRow()]);
      if (sql.includes('UPDATE')) return Promise.resolve([sizeRow({ isz_modified_by: 'user-1' })]);
      if (sql.includes('SELECT * FROM'))
        return Promise.resolve(world.existing ? [world.existing] : []);
      return Promise.reject(new Error(`unexpected: ${sql}`));
    });
    logEntityChange = jest.fn().mockResolvedValue(undefined);
    const client = { $queryRaw: queryRaw };
    const prisma = {
      ...client,
      $transaction: (fn: (tx: unknown) => unknown) => fn(client),
    } as unknown as PrismaService;
    const audit = { logEntityChange } as unknown as AuditLogService;
    const ctx = { getUserId: () => 'user-1' } as unknown as RequestContextService;
    sizes = new ItemSizeMasterService(prisma, audit, ctx);
    colours = new ItemColourMasterService(prisma, audit, ctx);
  });

  const callWith = (text: string) =>
    queryRaw.mock.calls.find((call) => squash(sqlOf(call)).includes(text));

  it('quick-adds a size from a name alone: code and size set NULL, sort and active by default', async () => {
    const data = await sizes.save({ isz_name: 'XL', isz_company_id: COMPANY_ID });

    const insert = sqlOf(callWith('INSERT INTO inventory.item_size_master'));
    expect(squash(insert)).toContain(
      '(isz_name, isz_code, isz_size_set, isz_company_id, isz_created_by)',
    );
    expect(insert.values).toEqual(['XL', null, null, COMPANY_ID, 'user-1']);
    expect(data).toMatchObject({
      isz_id: SIZE_ID,
      isz_name: 'XL',
      isz_created_on: CREATED_ON.toISOString(),
    });
    expect(data).not.toHaveProperty('isz_sync_date');
    expect(logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'New', tableName: 'item_size_master', pk: SIZE_ID }),
      expect.anything(),
    );
  });

  it('checks the name against the company and the shared rows, folded, under a lock', async () => {
    await sizes.save({ isz_name: 'xl', isz_company_id: COMPANY_ID });

    expect(sqlOf(callWith('pg_advisory_xact_lock')).values).toEqual([
      'inventory.item_size_master.name',
      'XL',
    ]);
    const clash = squash(sqlOf(callWith('AS id,')));
    expect(clash).toContain('(isz_company_id IS NULL OR isz_company_id = $2::uuid)');
    expect(clash).toContain('ORDER BY (isz_company_id IS NULL)');
  });

  it('answers a taken name with 409 NAME_TAKEN carrying existingId — the quick-add uses it', async () => {
    world.clash = { id: OTHER_ID, name: 'XL' };

    await expect(sizes.save({ isz_name: 'xl', isz_company_id: COMPANY_ID })).rejects.toMatchObject({
      status: 409,
      response: {
        errors: [{ field: 'isz_name', code: ItemSizeErrorCode.NAME_TAKEN, existingId: OTHER_ID }],
      },
    });
  });

  it('refuses an unknown company', async () => {
    world.company = false;
    await expect(sizes.save({ isz_name: 'XL', isz_company_id: COMPANY_ID })).rejects.toMatchObject({
      status: 400,
      response: { errors: [{ code: ItemSizeErrorCode.COMPANY_NOT_FOUND }] },
    });
  });

  it('an update writes only what was sent, and re-checks the name only when its spelling folds differently', async () => {
    await sizes.save({ isz_id: SIZE_ID, isz_name: 'xl', isz_sort: 40 });

    expect(callWith('AS id,')).toBeUndefined();
    const update = sqlOf(callWith('UPDATE inventory.item_size_master'));
    expect(squash(update)).toContain('SET isz_name = $1, isz_sort = $2, isz_modified_on = now()');
    expect(update.values).toEqual(['xl', 40, 'user-1', SIZE_ID]);
  });

  it('refuses to delete a size a batch still names: 409 IN_USE', async () => {
    world.inUse = 3;

    await expect(sizes.softDelete(SIZE_ID)).rejects.toMatchObject({
      status: 409,
      response: { errors: [{ field: 'isz_id', code: ItemSizeErrorCode.IN_USE }] },
    });
    expect(squash(sqlOf(callWith('count(*) AS n')))).toContain(
      'FROM stock.stock_batch_detail WHERE sbd_size_id = $2::uuid AND sbd_is_deleted = false',
    );
  });

  it('deletes an unused size and says so in column names', async () => {
    await expect(sizes.softDelete(SIZE_ID)).resolves.toEqual({ isz_id: SIZE_ID, deleted: true });
  });

  it('404s an id it does not have', async () => {
    world.existing = undefined;
    await expect(sizes.getById(SIZE_ID)).rejects.toMatchObject({
      status: 404,
      response: { errors: [{ code: ItemSizeErrorCode.NOT_FOUND }] },
    });
  });

  it('the colour master is the same service on icl_ with no size set', async () => {
    world.clash = { id: OTHER_ID, name: 'Maroon' };

    await expect(colours.save({ icl_name: 'maroon' })).rejects.toMatchObject({
      response: {
        errors: [{ field: 'icl_name', code: ItemColourErrorCode.NAME_TAKEN, existingId: OTHER_ID }],
      },
    });
    world.clash = undefined;
    await colours.save({ icl_name: 'Maroon' });
    expect(squash(sqlOf(callWith('INSERT INTO inventory.item_colour_master')))).toContain(
      '(icl_name, icl_code, icl_company_id, icl_created_by)',
    );
  });
});
