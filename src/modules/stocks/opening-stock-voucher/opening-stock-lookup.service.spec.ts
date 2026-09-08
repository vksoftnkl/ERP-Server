import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockMrpPriceGateway } from '../selling-price-bulk/stock-mrp-price.gateway';
import { OpeningStockLookupService } from './opening-stock-lookup.service';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const BASE_UOM_ID = '01000000-0000-7000-8000-000000000012';
const OTHER_COMPANY_ID = '01000000-0000-7000-8000-0000000000c2';
const OTHER_BRANCH_ID = '01000000-0000-7000-8000-0000000000b2';
const ON_DATE = '2026-04-01';

/** SALT in BOX: 1 BOX = 12 PCS, 18% GST, tracked by batch + MRP + expiry. */
const saltRow = (overrides: Record<string, unknown> = {}) => ({
  itemId: ITEM_ID,
  itemCode: 'SALT',
  itemName: 'Salt 1kg',
  barcode: '8901234567890',
  uomId: UOM_ID,
  unitName: 'BOX',
  toBaseFactor: new Prisma.Decimal(12),
  baseUomId: BASE_UOM_ID,
  taxPerc: new Prisma.Decimal('18.000'),
  cessPerc: new Prisma.Decimal(0),
  cessUnit: new Prisma.Decimal('0.0000'),
  trackSignature: 'BME',
  alreadyOpened: false,
  ...overrides,
});

const args = (overrides: Record<string, unknown> = {}) => ({
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  itemId: ITEM_ID,
  onDate: ON_DATE,
  ...overrides,
});

/**
 * A $queryRaw call re-assembled the way Prisma assembles it. The policy
 * fragment arrives as a nested Prisma.Sql VALUE, not as template text, so
 * joining the outer strings alone would not show it; Prisma.sql flattens it.
 */
const assemble = (call: unknown[]): Prisma.Sql =>
  Prisma.sql(call[0] as TemplateStringsArray, ...call.slice(1));

describe('OpeningStockLookupService', () => {
  let queryRaw: jest.Mock;
  let gateway: { isDeployed: boolean; findOpeningSeedBucket: jest.Mock };
  let service: OpeningStockLookupService;

  beforeEach(() => {
    queryRaw = jest.fn();
    gateway = { isDeployed: false, findOpeningSeedBucket: jest.fn() };
    service = new OpeningStockLookupService(
      { $queryRaw: queryRaw } as unknown as PrismaService,
      gateway as unknown as StockMrpPriceGateway,
    );
  });

  it('fills the line from one row, Decimals as numbers, and seeds no price where the table is not deployed', async () => {
    queryRaw.mockResolvedValueOnce([saltRow()]);

    const result = await service.lookupItem(args({ uomId: UOM_ID }));

    expect(result).toEqual({
      itemId: ITEM_ID,
      itemCode: 'SALT',
      itemName: 'Salt 1kg',
      barcode: '8901234567890',
      uomId: UOM_ID,
      unitName: 'BOX',
      toBaseFactor: 12,
      baseUomId: BASE_UOM_ID,
      taxPerc: 18,
      cessPerc: 0,
      cessUnit: 0,
      trackSignature: 'BME',
      mrp: 0,
      salePrice: 0,
      alreadyOpened: false,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(gateway.findOpeningSeedBucket).not.toHaveBeenCalled();
    // No cost column, by design: the engine resolves the rate source only
    // when a line arrives at cost 0, and a seeded cell would disable it.
    expect(Object.keys(result)).not.toEqual(
      expect.arrayContaining(['costRate', 'avgCostRate', 'lastPurchaseRate']),
    );
  });

  it("resolves the policy with the engine's own fragment, on the document date, and only for goods", async () => {
    queryRaw.mockResolvedValueOnce([saltRow()]);

    await service.lookupItem(args());

    const statement = assemble(queryRaw.mock.calls[0] as unknown[]);
    const sql = statement.sql;
    expect(sql).toContain('stock.stock_track_policy');
    expect(sql).toContain('LEFT JOIN LATERAL');
    expect(sql).toContain("COALESCE(stp.stp_track_signature, 'N')");
    expect(sql).toContain('COALESCE(i.item_is_service, false) = false');
    // Company is STRICT once given — a null company on the ITEM is a row
    // nobody owns; branch is nullable-means-shared, the same shape the policy
    // uses. Both predicates switch off when the PARAMETER is null.
    expect(sql).toMatch(
      /AND \(NULLIF\(\?::text, ''\) IS NULL\s+OR i\.item_company_id = \?::uuid\)/,
    );
    expect(sql).toMatch(
      /AND \(NULLIF\(\?::text, ''\) IS NULL\s+OR i\.item_branch_id IS NULL\s+OR i\.item_branch_id = \?::uuid\)/,
    );
    expect(sql).not.toContain('i.item_company_id IS NULL');
    // Only live, active items — both flags are NOT NULL, so no COALESCE.
    expect(sql).toContain('AND i.item_is_active  = true');
    expect(sql).toContain('AND i.item_is_deleted = false');
    // The predicate is on item_is_service; the other column is named only in a comment.
    expect(sql).not.toContain('i.item_stock_type');
    // The price table is never joined here: on a database without it the
    // whole picker would fail, so the seed is the gateway's gated read.
    expect(sql).not.toContain('stock_mrp_price');
    // Bound, not interpolated: the date and both ids travel as parameters.
    expect(statement.values).toEqual(
      expect.arrayContaining([COMPANY_ID, BRANCH_ID, ITEM_ID, ON_DATE]),
    );
  });

  it.each([
    ['omitted', {}],
    ['null', { companyId: null, branchId: null }],
  ])('binds a null company and branch when they are %s, so both predicates switch off', async (_label, scope) => {
    gateway.isDeployed = true;
    gateway.findOpeningSeedBucket.mockResolvedValueOnce(null);
    queryRaw.mockResolvedValueOnce([saltRow()]);

    const result = await service.lookupItem({ itemId: ITEM_ID, onDate: ON_DATE, ...scope });

    const statement = assemble(queryRaw.mock.calls[0] as unknown[]);
    // The same statement shape as with a scope — the null travels as a bound
    // parameter and the "?::uuid IS NULL OR" arm is what makes it match.
    expect(statement.sql).toContain("AND (NULLIF(?::text, '') IS NULL");
    expect(statement.values).toEqual(expect.arrayContaining([null, ITEM_ID, ON_DATE]));
    expect(statement.values).not.toEqual(expect.arrayContaining([undefined]));
    expect(gateway.findOpeningSeedBucket).toHaveBeenCalledWith({
      companyId: null,
      branchId: null,
      itemId: ITEM_ID,
      uomId: UOM_ID,
      onDate: ON_DATE,
    });
    expect(result.itemId).toBe(ITEM_ID);
  });

  it('restricts by whichever of company / branch is given when only one is', async () => {
    queryRaw.mockResolvedValueOnce([saltRow()]);

    await service.lookupItem({ companyId: COMPANY_ID, itemId: ITEM_ID, onDate: ON_DATE });

    const statement = assemble(queryRaw.mock.calls[0] as unknown[]);
    expect(statement.values).toEqual(expect.arrayContaining([COMPANY_ID, null, ITEM_ID]));
    expect(statement.values).not.toEqual(expect.arrayContaining([BRANCH_ID]));
  });

  it('seeds mrp and sale price through the gateway once the table is deployed', async () => {
    gateway.isDeployed = true;
    gateway.findOpeningSeedBucket.mockResolvedValueOnce({ mrp: 120, salePrice: 110 });
    queryRaw.mockResolvedValueOnce([saltRow({ alreadyOpened: true })]);

    const result = await service.lookupItem(args({ uomId: UOM_ID }));

    expect(gateway.findOpeningSeedBucket).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      itemId: ITEM_ID,
      uomId: UOM_ID,
      onDate: ON_DATE,
    });
    expect(result.mrp).toBe(120);
    expect(result.salePrice).toBe(110);
    expect(result.alreadyOpened).toBe(true);
  });

  it('keeps 0 / 0 when the deployed table has no live bucket for the unit', async () => {
    gateway.isDeployed = true;
    gateway.findOpeningSeedBucket.mockResolvedValueOnce(null);
    queryRaw.mockResolvedValueOnce([saltRow()]);

    const result = await service.lookupItem(args());

    expect(result.mrp).toBe(0);
    expect(result.salePrice).toBe(0);
  });

  describe('an empty result is a 404 that names the cause', () => {
    const expect404 = async (
      cause: Record<string, unknown> | undefined,
      lookupArgs: Record<string, unknown>,
      field: string,
      fragment: string,
    ) => {
      queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(cause ? [cause] : []);
      const error = await service.lookupItem(args(lookupArgs)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      const body = (error as NotFoundException).getResponse() as {
        message: string;
        errors: Array<{ field: string; message: string }>;
      };
      expect(body.message).toBe('This item cannot be put on an opening line');
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].field).toBe(field);
      expect(body.errors[0].message).toContain(fragment);
      expect(queryRaw).toHaveBeenCalledTimes(2);
    };

    const cause = (overrides: Record<string, unknown> = {}) => ({
      isActive: true,
      isDeleted: false,
      companyId: COMPANY_ID,
      branchId: null,
      isService: false,
      conversions: 1,
      hasDefault: true,
      uomFound: true,
      ...overrides,
    });

    it('no such item', () => expect404(undefined, {}, 'itemId', 'No such item'));

    it('a deleted item', () => expect404(cause({ isDeleted: true }), {}, 'itemId', 'No such item'));

    it('an inactive item', () => expect404(cause({ isActive: false }), {}, 'itemId', 'inactive'));

    it('an item with no company — nobody owns it, and it is not treated as shared', () =>
      expect404(cause({ companyId: null }), {}, 'itemId', 'no company set'));

    it("another company's item, even when scanned from this company", () =>
      expect404(cause({ companyId: OTHER_COMPANY_ID }), {}, 'itemId', 'another company'));

    it("another branch's item — a null branch is company-wide, a set one is not", () =>
      expect404(cause({ branchId: OTHER_BRANCH_ID }), {}, 'itemId', 'another branch'));

    // With no company given the company predicate was off, so neither
    // company cause can be the reason: the diagnosis moves on to the next.
    it('no company given — an unowned item is not blamed on its company', () =>
      expect404(
        cause({ companyId: null, isService: true }),
        { companyId: null },
        'itemId',
        'service item',
      ));

    it("no company given — another company's item is not blamed on its company", () =>
      expect404(
        cause({ companyId: OTHER_COMPANY_ID, conversions: 0 }),
        { companyId: null },
        'itemId',
        'no unit conversion',
      ));

    it("no branch given — another branch's item is not blamed on its branch", () =>
      expect404(
        cause({ branchId: OTHER_BRANCH_ID, isService: true }),
        { branchId: null },
        'itemId',
        'service item',
      ));

    it('a service item', () => expect404(cause({ isService: true }), {}, 'itemId', 'service item'));

    it('no unit conversion at all — the common case on a real item master', () =>
      expect404(cause({ conversions: 0 }), {}, 'itemId', 'no unit conversion'));

    it("a unit that is not one of the item's", () =>
      expect404(cause({ uomFound: false }), { uomId: UOM_ID }, 'uomId', 'not one of the item'));

    it('no default unit when none was asked for', () =>
      expect404(cause({ hasDefault: false }), {}, 'uomId', 'no default unit'));

    it('a keyed unit whose base unit has no conversion row', () =>
      expect404(cause(), { uomId: UOM_ID }, 'uomId', 'base unit has no conversion row'));
  });
});
