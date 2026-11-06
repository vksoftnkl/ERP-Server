import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PRICE_ORIGIN } from '../../Inventory/item-price-log/types/price-change-log.types';
import {
  CostPriceBulkGateway,
  rowTokenSql,
  type CostBulkLockedRecord,
} from './cost-price-bulk.gateway';
import { CostPriceBulkService } from './cost-price-bulk.service';
import { overflowRefusal } from './cost-price-bulk-exception.filter';
import { COST_BULK } from './types/cost-price-bulk.types';

const CO = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BR = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const USER = '01000000-0000-7000-8000-0000000000a1';
const ITEM = '01000000-0000-7000-8000-000000000001';
const IPM_1 = '01000000-0000-7000-8000-000000000041';
const IPM_2 = '01000000-0000-7000-8000-000000000042';
const d = (value: string | number) => new Prisma.Decimal(value);

const locked = (overrides: Partial<CostBulkLockedRecord> = {}): CostBulkLockedRecord => ({
  ipmId: IPM_1,
  itemId: ITEM,
  itemCode: 'FORRB1',
  itemName: 'Fortune Rice Bran Oil 1L',
  unitName: 'PKT',
  usable: true,
  current: true,
  itemIsActive: true,
  itemIsBatchBased: false,
  presetTracks: false,
  isChain: false,
  companyShared: false,
  rowToken: 'token-1',
  costPrice: d(140),
  maxPrice: d(185),
  minPrice: d(150),
  profitType: 'By %',
  priceA: d(154),
  priceB: d(168),
  priceC: d(161),
  priceD: d(175),
  ...overrides,
});

const unitRecord = (overrides: Record<string, unknown> = {}) => ({
  itemId: ITEM,
  itemCode: 'FORRB1',
  itemName: 'Fortune Rice Bran Oil 1L',
  barcode: null,
  itemIsActive: true,
  itemIsBatchBased: false,
  presetName: null,
  presetTracks: false,
  uomId: '01000000-0000-7000-8000-000000000011',
  unitName: 'PKT',
  unitSlno: 1,
  toBase: d(1),
  unitFactor: d(1),
  parentUomId: null,
  parentUnitName: null,
  parentToBase: null,
  ipmId: IPM_1,
  priceBranchId: BR,
  companyShared: false,
  profitType: 'By %',
  roundOff: d(1),
  costPrice: d(152),
  costWot: d('144.761905'),
  maxPrice: d(199),
  minPrice: d(150),
  priceA: d('167.5'),
  priceB: d('182.5'),
  priceC: d(175),
  priceD: d(190),
  wotA: d(0),
  wotB: d(0),
  wotC: d(0),
  wotD: d(0),
  markupA: d(0),
  markupB: d(0),
  markupC: d(0),
  markupD: d(0),
  updatedOn: null,
  rowToken: 'token-9',
  scheduledFrom: null,
  hasQtySlabs: false,
  ...overrides,
});

const statementOf = (mock: jest.Mock, call = 0): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

describe('CostPriceBulkService', () => {
  let tx: Record<string, any>;
  let prisma: Record<string, any>;
  let gateway: Record<string, jest.Mock>;
  let writer: { rewritePriceRows: jest.Mock; insertCompanyPriceRows: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let userType: string;
  let service: CostPriceBulkService;

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
      itemMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ itemId: ITEM, itemDefaultTaxId: 'tax-5', itemInclTax: true }]),
      },
      itemTaxHistory: { findMany: jest.fn().mockResolvedValue([]) },
      taxRateMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { taxId: 'tax-5', taxRatePerc: d(5), taxCessBasis: 'NONE', taxAcessBasis: 'NONE' },
          ]),
      },
    };
    prisma = {
      // assertMenuRight's read of user_menus: VKPOS holds view + edit on 298
      $queryRaw: jest.fn().mockResolvedValue([{ um_can_view: true, um_can_edit: true }]),
      $transaction: jest.fn((fn: (client: unknown) => unknown) => fn(tx)),
    };
    gateway = {
      readRowsForSave: jest.fn().mockResolvedValue(new Map([[IPM_1, locked()]])),
      today: jest.fn().mockResolvedValue('2026-11-05'),
      levels: jest.fn().mockResolvedValue([
        { level: 1, name: 'Whole Sale', active: true },
        { level: 2, name: 'Retail', active: true },
        { level: 3, name: 'Bulk W.S.', active: false },
        { level: 4, name: 'Hotel', active: false },
      ]),
      listGrid: jest.fn().mockResolvedValue({ rows: [], total: 0, totalItems: 0 }),
    };
    writer = {
      insertCompanyPriceRows: jest.fn().mockResolvedValue(new Map()),
      rewritePriceRows: jest.fn().mockResolvedValue({
        before: new Map([[IPM_1, { ipm_cost_price: 140 }]]),
        after: new Map([[IPM_1, { ipm_cost_price: 152 }]]),
      }),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    userType = 'USER';
    const requestContext = {
      getUserId: () => USER,
      getUserType: () => userType,
      getDeviceId: () => null,
    };
    const settings = {
      resolveEffective: jest
        .fn()
        .mockResolvedValue([{ asdKey: 'inventory.below_cost_price', value: 'warning' }]),
    };
    service = new CostPriceBulkService(
      prisma as never,
      audit as never,
      requestContext as never,
      settings as never,
      gateway as unknown as CostPriceBulkGateway,
      writer as never,
    );
  });

  const body = (rows: Record<string, unknown>[], overrides?: unknown[]) =>
    ({ companyId: CO, branchId: BR, rows, ...(overrides ? { overrides } : {}) }) as never;
  const row6 = {
    lineNo: 6,
    ipmId: IPM_1,
    rowToken: 'token-1',
    costPrice: 152,
    mrp: 199,
    levels: [
      { level: 1, price: 167.5 },
      { level: 2, price: 182.5 },
      { level: 3, price: 175 },
      { level: 4, price: 190 },
    ],
  };

  it('save: locks, writes through the writer under BULK_COST_CHANGE, audits under Item Price Master', async () => {
    const result = await service.save(body([row6]));

    expect(gateway.readRowsForSave).toHaveBeenCalledWith(tx, CO, BR, [IPM_1], true);
    expect(writer.rewritePriceRows).toHaveBeenCalledTimes(1);
    const [, origin, writes, actor] = writer.rewritePriceRows.mock.calls[0];
    expect(origin).toEqual(PRICE_ORIGIN.BULK_COST_CHANGE);
    expect(origin).toEqual({ source: 'BULK_COST_CHANGE', menuId: 298 });
    expect(actor).toBe(USER);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ ipmId: IPM_1, profitType: 'By %', reason: null });
    expect(writes[0].costWot.toString()).toBe('144.761905');
    expect(writes[0].maxPrice.toString()).toBe('199');

    expect(audit.logEntityChange).toHaveBeenCalledTimes(1);
    const [entry, client] = audit.logEntityChange.mock.calls[0];
    expect(client).toBe(tx);
    expect(entry).toMatchObject({
      action: 'update',
      tableName: 'item price master',
      screenName: 'Item Price Master',
      pk: IPM_1,
      entityId: ITEM,
      originalRecord: { ipm_cost_price: 140 },
      modifiedRecord: { ipm_cost_price: 152 },
      userId: USER,
    });
    expect(entry.notes).toBe(
      'Cost Price – Bulk Change (menu 298), this branch — cost 140.00 → 152.00',
    );
    expect(result).toMatchObject({
      saved: 1,
      unchanged: 0,
      refusals: [],
      rights: { view: true, edit: true, override: true },
    });
  });

  it('save: a warning not ticked is a 422 with errors[], refusals[] and warnings[] — nothing written', async () => {
    const cheap = { ...row6, costPrice: 170 };
    let thrown: unknown;
    await service.save(body([cheap])).catch((error: unknown) => (thrown = error));

    expect(thrown).toBeInstanceOf(HttpException);
    const exception = thrown as HttpException;
    expect(exception.getStatus()).toBe(422);
    const response = exception.getResponse() as Record<string, any>;
    expect(response.success).toBe(false);
    expect(response.errors).toEqual([
      expect.objectContaining({ code: COST_BULK.BELOW_COST, line: 6, level: 'WARN' }),
    ]);
    expect(response.refusals).toEqual([]);
    expect(response.warnings).toEqual([
      expect.objectContaining({ code: COST_BULK.BELOW_COST, overridable: true, ipmId: IPM_1 }),
    ]);
    expect(writer.rewritePriceRows).not.toHaveBeenCalled();
    expect(audit.logEntityChange).not.toHaveBeenCalled();
  });

  it('save: the ticked warning goes through, and says so on the log and the audit', async () => {
    const cheap = { ...row6, costPrice: 170 };
    await service.save(body([cheap], [{ code: COST_BULK.BELOW_COST, line: 6 }]));

    expect(writer.rewritePriceRows.mock.calls[0][2][0].reason).toMatch(
      /^Warnings ticked at save: COST_BULK_BELOW_COST/,
    );
    expect(audit.logEntityChange.mock.calls[0][0].notes).toContain(
      'warnings ticked: COST_BULK_BELOW_COST',
    );
  });

  it('save: an all-branches row from a non-HQ user is refused; an HQ user saves it', async () => {
    gateway.readRowsForSave.mockResolvedValue(new Map([[IPM_1, locked({ isChain: true })]]));
    await expect(service.save(body([row6]))).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: COST_BULK.CHAIN_NEEDS_HQ })] },
    });

    userType = 'SUPER ADMIN';
    await service.save(body([row6]));
    expect(audit.logEntityChange.mock.calls[0][0].notes).toContain('all branches');
  });

  it('save: an unchanged row is neither written nor audited', async () => {
    const same = { lineNo: 1, ipmId: IPM_1, rowToken: 'token-1', costPrice: 140 };
    writer.rewritePriceRows.mockResolvedValue({ before: new Map(), after: new Map() });
    const result = await service.save(body([same]));
    expect(writer.rewritePriceRows.mock.calls[0][2]).toEqual([]);
    expect(audit.logEntityChange).not.toHaveBeenCalled();
    expect(result).toMatchObject({ saved: 0, unchanged: 1 });
  });

  it('save: a company-shared row is copied to a company row — the shared row is not rewritten', async () => {
    const COPY = '01000000-0000-7000-8000-000000000099';
    gateway.readRowsForSave.mockResolvedValue(new Map([[IPM_1, locked({ companyShared: true })]]));
    writer.rewritePriceRows.mockResolvedValue({ before: new Map(), after: new Map() });
    writer.insertCompanyPriceRows.mockResolvedValue(
      new Map([[IPM_1, { ipmId: COPY, after: { ipm_id: COPY, ipm_cost_price: 152 } }]]),
    );
    gateway.listGrid.mockResolvedValue({
      rows: [unitRecord({ ipmId: COPY })],
      total: 1,
      totalItems: 1,
    });

    const result = await service.save(body([row6]));

    expect(writer.rewritePriceRows.mock.calls[0][2]).toEqual([]);
    const [, origin, companyId, copies, actor] = writer.insertCompanyPriceRows.mock.calls[0];
    expect(origin).toEqual(PRICE_ORIGIN.BULK_COST_CHANGE);
    expect(companyId).toBe(CO);
    expect(actor).toBe(USER);
    expect(copies).toEqual([expect.objectContaining({ ipmId: IPM_1, profitType: 'By %' })]);
    const [entry] = audit.logEntityChange.mock.calls[0];
    expect(entry).toMatchObject({
      action: 'New',
      pk: COPY,
      originalRecord: null,
      modifiedRecord: { ipm_id: COPY, ipm_cost_price: 152 },
    });
    expect(entry.notes).toContain(`copied from the shared row ${IPM_1}`);
    expect(result.rows).toEqual([
      expect.objectContaining({
        ipmId: COPY,
        sourceIpmId: IPM_1,
        companyCopy: true,
        written: true,
        lineNo: 6,
      }),
    ]);
    // the level flags ride on every row
    expect(result.rows[0].levels.map((l) => l.active)).toEqual([true, true, false, false]);
  });

  it('validate: inactive levels are not judged (a hidden level below cost blocks nothing)', async () => {
    gateway.readRowsForSave.mockResolvedValue(
      new Map([[IPM_1, locked({ priceC: d(5), priceD: d(0), minPrice: d(0) })]]),
    );
    const result = await service.validate(
      body([{ lineNo: 1, ipmId: IPM_1, rowToken: 'token-1', costPrice: 150 }]),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('validate: reads without a lock and writes nothing', async () => {
    const result = await service.validate(body([{ ...row6, costPrice: 170 }]));
    expect(gateway.readRowsForSave).toHaveBeenCalledWith(tx, CO, BR, [IPM_1], false);
    expect(writer.rewritePriceRows).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.warnings.map((n) => n.code)).toEqual([COST_BULK.BELOW_COST]);
    expect(result.counts).toEqual({ rows: 1, changed: 1, unchanged: 0, refused: 0, warned: 1 });
  });

  it('more than 1,000 rows: COST_BULK_TOO_MANY_ROWS before anything is read', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ ...row6, lineNo: i + 1 }));
    await expect(service.validate(body(rows))).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: COST_BULK.TOO_MANY_ROWS })] },
    });
    expect(gateway.readRowsForSave).not.toHaveBeenCalled();
  });

  it('one lineNo twice is a 400', async () => {
    await expect(service.validate(body([row6, { ...row6, ipmId: IPM_2 }]))).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'VALIDATION_ARRAY_UNIQUE' })] },
    });
  });

  it('no Edit on menu 298: 403 COST_BULK_RIGHT_EDIT', async () => {
    prisma.$queryRaw.mockResolvedValue([{ um_can_view: true, um_can_edit: false }]);
    await expect(service.save(body([row6]))).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'COST_BULK_RIGHT_EDIT' })] },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('CostPriceBulkGateway', () => {
  it('locks the rows FOR UPDATE in ipm_id order on the save, and only reads on validate', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const gateway = new CostPriceBulkGateway();

    await gateway.readRowsForSave(tx as never, CO, BR, [IPM_2, IPM_1, IPM_2], true);
    const lock = statementOf(tx.$queryRaw, 0);
    expect(lock.sql).toMatch(/ORDER BY ipm_id\s+FOR UPDATE/);
    expect(lock.values).toEqual([[IPM_2, IPM_1]]);

    tx.$queryRaw.mockClear();
    await gateway.readRowsForSave(tx as never, CO, BR, [IPM_1], false);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(statementOf(tx.$queryRaw, 0).sql).not.toContain('FOR UPDATE');
  });

  it('the token is md5 of the row minus the ignored columns', () => {
    const token = rowTokenSql('p');
    expect(token.sql).toBe('md5((to_jsonb(p) - ?::text[])::text)');
    expect(token.values[0]).toEqual(expect.arrayContaining(['ipm_updated_on', 'ipm_sync_date']));
  });

  it('reads only: no statement it runs writes', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const gateway = new CostPriceBulkGateway();
    await gateway.listGrid(tx as never, { companyId: CO, branchId: BR }, { limit: 10, offset: 0 });
    await gateway.listLeftOut(tx as never, { companyId: CO, branchId: BR }, 10);
    await gateway.readRowsForSave(tx as never, CO, BR, [IPM_1], true);
    for (let call = 0; call < tx.$queryRaw.mock.calls.length; call += 1) {
      // FOR UPDATE is a lock, not a write
      const sql = statementOf(tx.$queryRaw, call).sql.replace(/FOR UPDATE/g, '');
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
    }
  });
});

describe('CostPriceBulkGateway — scheduledFrom', () => {
  it('is the first later row that takes over HERE (branch or chain, company before shared)', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await new CostPriceBulkGateway().listGrid(
      tx as never,
      { companyId: CO, branchId: BR },
      { limit: 10, offset: 0 },
    );
    const sql = statementOf(tx.$queryRaw, 0).sql;
    const scheduled = sql.slice(
      sql.indexOf('SELECT MIN(k.ipm_effective_from)'),
      sql.indexOf('AS scheduled_from'),
    );
    // any visible scope, not only today's row's own
    expect(scheduled).not.toContain('IS NOT DISTINCT FROM g.ipm_branch_id');
    expect(scheduled).toContain('(k.ipm_branch_id  IS NULL OR k.ipm_branch_id  = ?::uuid)');
    expect(scheduled).toContain('(k.ipm_company_id IS NULL OR k.ipm_company_id = ?::uuid)');
    // …and only when, on its first day, it is the row that answers
    expect(scheduled).toContain(
      'k.ipm_effective_from BETWEEN h.ipm_effective_from AND h.ipm_effective_to',
    );
    expect(scheduled).toContain('kw.ipm_id = k.ipm_id');
    expect(scheduled).toContain(
      'ORDER BY (h.ipm_branch_id IS NULL), (h.ipm_company_id IS NULL), h.ipm_id',
    );
  });
});

describe('CostPriceBulkExceptionFilter — numeric overflow backstop (22003)', () => {
  it('a raw-query overflow is a 422 VALUE_TOO_LARGE', () => {
    const refusal = overflowRefusal({
      code: 'P2010',
      message: 'Raw query failed',
      meta: { code: '22003' },
    });
    expect(refusal!.getStatus()).toBe(422);
    expect(refusal!.getResponse()).toMatchObject({
      success: false,
      errors: [expect.objectContaining({ code: 'VALUE_TOO_LARGE', field: 'rows' })],
    });
  });

  it('a markup column overflow (numeric(9,3)) is COST_BULK_COST_TOO_LOW', () => {
    const refusal = overflowRefusal({
      message:
        'QueryError(PostgresError { code: "22003", message: "numeric field overflow", severity: "ERROR", detail: Some("A field with precision 9, scale 3 must round to an absolute value less than 10^6."), column: None })',
    });
    expect(refusal!.getResponse()).toMatchObject({
      errors: [expect.objectContaining({ code: COST_BULK.COST_TOO_LOW })],
    });
  });

  it('anything else is left to the menu 30 filter', () => {
    expect(overflowRefusal(new Error('boom'))).toBeNull();
    expect(overflowRefusal(new HttpException('x', 400))).toBeNull();
  });
});

describe('CostPriceBulkGateway — price levels', () => {
  it('reads fixed.price_levels.price_lvl_is_active (the house list), not item_price_levels', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        { id: 1, name: 'Whole Sale', active: true },
        { id: 2, name: 'Retail', active: true },
        { id: 3, name: 'Bulk Whole Sale', active: false },
      ]),
    };
    const levels = await new CostPriceBulkGateway().levels(tx as never);
    const sql = statementOf(tx.$queryRaw, 0).sql;
    expect(sql).toContain('FROM fixed.price_levels');
    expect(sql).toContain('price_lvl_is_active IS TRUE');
    expect(sql).not.toContain('item_price_levels');
    expect(levels).toEqual([
      { level: 1, name: 'Whole Sale', active: true },
      { level: 2, name: 'Retail', active: true },
      { level: 3, name: 'Bulk Whole Sale', active: false },
      // no row: inactive, named by its letter
      { level: 4, name: 'Price D', active: false },
    ]);
  });
});
