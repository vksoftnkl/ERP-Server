import { ArgumentsHost, HttpException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { ItemsPriceMasterService } from '../../Inventory/items-price-master/items-price-master.service';
import { SellingPriceBulkService } from './selling-price-bulk.service';
import { SellingPriceBulkExceptionFilter } from './selling-price-bulk-exception.filter';
import { StockMrpPriceGateway } from './stock-mrp-price.gateway';
import { resolveBelowCostAction, resolveBelowCostPolicy } from './below-cost-policy.helper';
import { recomputeLevel } from './selling-price-math.helper';
import type { SaveSellingPriceBulkDto } from './dto/save-selling-price-bulk.dto';
import type { BelowCostPolicy, SellingPriceProblem } from './types/selling-price-bulk.types';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const BUCKET_ITEM = '01000000-0000-7000-8000-000000000001';
const HEADLINE_ITEM = '01000000-0000-7000-8000-000000000002';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const TAX_ID = '01000000-0000-7000-8000-000000000031';
const OLD_TAX_ID = '01000000-0000-7000-8000-000000000032';
const IPM_ID = '01000000-0000-7000-8000-000000000041';
const SMP_ID = '01000000-0000-7000-8000-000000000051';

/** 118 at 18% is exactly 100 without tax, so nothing here rests on rounding. */
const PRICE = 118;
const TAX_PERC = 18;
const COST = 95;

const engineError = (sqlState: string, message: string) =>
  Object.assign(new Error('Raw query failed'), {
    code: 'P2010',
    meta: { code: sqlState, message },
  });

const problem = (
  overrides: Partial<SellingPriceProblem> & Pick<SellingPriceProblem, 'verdict'>,
): SellingPriceProblem => ({
  lineNo: 1,
  itemId: BUCKET_ITEM,
  itemCode: 'SALT',
  itemName: 'Salt 1 Kg',
  uomId: UOM_ID,
  bucketId: null,
  level: 1,
  message: 'Q26 said so',
  ...overrides,
});

describe('SellingPriceBulkService', () => {
  let service: SellingPriceBulkService;
  let tx: {
    itemPriceMaster: { findMany: jest.Mock };
    itemMaster: { findMany: jest.Mock };
    itemTaxHistory: { findMany: jest.Mock };
    itemTaxMaster: { findMany: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };
  let auditLogService: { logEntityChange: jest.Mock };
  let requestContext: {
    getUserId: jest.Mock;
    getUserType: jest.Mock;
    getDeviceId: jest.Mock;
  };
  let appSettingValueService: { resolveEffective: jest.Mock };
  let itemsPriceMasterService: { save: jest.Mock };
  let gateway: {
    listPrices: jest.Mock;
    listBuckets: jest.Mock;
    validateRows: jest.Mock;
    findBucketRowForUpdate: jest.Mock;
    updateBucketPrice: jest.Mock;
    insertBucketPrice: jest.Mock;
    listNoStock: jest.Mock;
  };

  /** The setting, as resolveEffective hands the whole catalog back. */
  const settingIs = (value: string | null) =>
    appSettingValueService.resolveEffective.mockResolvedValue([
      { asdKey: 'sales.something_else', value: 'x' },
      { asdKey: 'inventory.below_cost_price', value },
    ]);

  beforeEach(() => {
    tx = {
      itemPriceMaster: {
        findMany: jest.fn().mockResolvedValue([
          {
            ipmId: IPM_ID,
            ipmItemId: BUCKET_ITEM,
            ipmUcUnitId: UOM_ID,
            ipmCostPrice: COST,
            ipmMinPrice: 0,
          },
          {
            ipmId: IPM_ID,
            ipmItemId: HEADLINE_ITEM,
            ipmUcUnitId: UOM_ID,
            ipmCostPrice: COST,
            ipmMinPrice: 0,
          },
        ]),
      },
      itemMaster: {
        findMany: jest.fn().mockResolvedValue([
          {
            itemId: BUCKET_ITEM,
            itemCode: 'SALT',
            itemNameEn: 'Salt 1 Kg',
            itemDefaultTaxId: TAX_ID,
            itemInclTax: true,
          },
          {
            itemId: HEADLINE_ITEM,
            itemCode: 'RICE',
            itemNameEn: 'Rice 25 Kg',
            itemDefaultTaxId: TAX_ID,
            itemInclTax: true,
          },
        ]),
      },
      itemTaxHistory: { findMany: jest.fn().mockResolvedValue([]) },
      itemTaxMaster: {
        findMany: jest.fn().mockResolvedValue([
          {
            taxId: TAX_ID,
            taxGstRateTotal: TAX_PERC,
            taxCessType: 'NONE',
            taxCessPerc: 0,
            taxCessUnit: 0,
          },
        ]),
      },
    };
    prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
    };
    auditLogService = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    requestContext = {
      getUserId: jest.fn().mockReturnValue(USER_ID),
      // HQ by default; the 403 tests set it back to the seeded 'USER'.
      getUserType: jest.fn().mockReturnValue('ADMIN'),
      getDeviceId: jest.fn().mockReturnValue(null),
    };
    appSettingValueService = { resolveEffective: jest.fn() };
    settingIs('warning');
    itemsPriceMasterService = {
      save: jest
        .fn()
        .mockImplementation((rows: unknown[]) => Promise.resolve(rows.map(() => ({})))),
    };
    gateway = {
      listPrices: jest.fn(),
      listBuckets: jest.fn(),
      validateRows: jest.fn().mockResolvedValue([]),
      // A FAITHFUL fake of S1: it searches AT THE TARGET SCOPE, so a search at
      // BRANCH scope cannot find a chain row. Everything the scope tests assert
      // about S2-vs-S3 rests on this being the real predicate.
      findBucketRowForUpdate: jest
        .fn()
        .mockImplementation(
          (_tx, candidate: { loadedScope?: string }, scope: { targetScope: string }) =>
            Promise.resolve(scope.targetScope === candidate.loadedScope ? { smpId: SMP_ID } : null),
        ),
      updateBucketPrice: jest.fn().mockResolvedValue(SMP_ID),
      insertBucketPrice: jest.fn().mockResolvedValue(SMP_ID),
      listNoStock: jest.fn().mockResolvedValue([]),
    };
    service = new SellingPriceBulkService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      requestContext as unknown as RequestContextService,
      appSettingValueService as unknown as AppSettingValueService,
      itemsPriceMasterService as unknown as ItemsPriceMasterService,
      gateway as unknown as StockMrpPriceGateway,
    );
  });

  /**
   * The fake S1 above matches on `loadedScope`, which the service does not put
   * on the candidate — so the test payload smuggles it through the row and the
   * service copies nothing of the sort. Instead the fake is re-armed per test
   * with the scope the row was loaded at.
   */
  const s1Finds = (loadedScope: 'BRANCH' | 'CHAIN' | null) =>
    gateway.findBucketRowForUpdate.mockImplementation(
      (_tx, _candidate, scope: { targetScope: string }) =>
        Promise.resolve(scope.targetScope === loadedScope ? { smpId: SMP_ID } : null),
    );

  const bucketRow = (overrides: Record<string, unknown> = {}) => ({
    lineNo: 1,
    itemId: BUCKET_ITEM,
    uomId: UOM_ID,
    // An MRP is what makes this a bucket row — §6.
    mrp: 120,
    salePrice: null,
    levels: [{ level: 1, price: PRICE }],
    ...overrides,
  });

  const headlineRow = (overrides: Record<string, unknown> = {}) => ({
    lineNo: 2,
    itemId: HEADLINE_ITEM,
    uomId: UOM_ID,
    // Neither dimension. ck_smp_identity refuses a (NULL, NULL) bucket, so this
    // is a headline edit by definition and not by choice.
    mrp: null,
    salePrice: null,
    levels: [{ level: 1, price: PRICE }],
    ...overrides,
  });

  const payload = (overrides: Partial<SaveSellingPriceBulkDto> = {}): SaveSellingPriceBulkDto =>
    ({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      scope: 'BRANCH',
      rows: [bucketRow()],
      userId: USER_ID,
      ...overrides,
    }) as unknown as SaveSellingPriceBulkDto;

  // ── §6 the fan-out ────────────────────────────────────────────────────────
  describe('the fan-out rule — §6', () => {
    it('sends a row with a dimension to the bucket statements and a row with neither to item_price_master', async () => {
      const result = await service.saveBulk(payload({ rows: [bucketRow(), headlineRow()] }));

      expect(gateway.insertBucketPrice).toHaveBeenCalledTimes(1);
      expect(gateway.insertBucketPrice.mock.calls[0][1]).toMatchObject({ itemId: BUCKET_ITEM });
      expect(itemsPriceMasterService.save).toHaveBeenCalledTimes(1);
      expect(itemsPriceMasterService.save.mock.calls[0][0]).toHaveLength(1);
      expect(itemsPriceMasterService.save.mock.calls[0][0][0]).toMatchObject({
        ipm_item_id: HEADLINE_ITEM,
      });
      expect(result).toMatchObject({ saved: 1, masterRowsSaved: 1 });
    });

    it('hands ItemsPriceMasterService THE TRANSACTION, so buckets and headlines commit together', async () => {
      await service.saveBulk(payload({ rows: [bucketRow(), headlineRow()] }));

      // The whole reason §6 reuses that service rather than writing the table:
      // its save() takes the caller's client. Passing undefined here would open
      // a second transaction and let the headline rows survive a bucket rollback.
      expect(itemsPriceMasterService.save.mock.calls[0][1]).toBe(tx);
    });

    it('never touches the gateway when every row is a headline row', async () => {
      const result = await service.saveBulk(payload({ rows: [headlineRow()] }));

      // This is what makes the module useful before the stock share lands.
      expect(gateway.validateRows).not.toHaveBeenCalled();
      expect(gateway.insertBucketPrice).not.toHaveBeenCalled();
      expect(gateway.listNoStock).not.toHaveBeenCalled();
      expect(result).toMatchObject({ saved: 0, masterRowsSaved: 1 });
    });

    it('routes on the dimension and not on bucketId — a stale bucketId cannot make a headline row a bucket', async () => {
      await service.saveBulk(payload({ rows: [headlineRow({ bucketId: SMP_ID })] }));

      expect(gateway.insertBucketPrice).not.toHaveBeenCalled();
      expect(itemsPriceMasterService.save).toHaveBeenCalledTimes(1);
    });

    it('maps level ordinals onto the A-D column triplet', async () => {
      await service.saveBulk(
        payload({
          rows: [
            headlineRow({
              levels: [
                { level: 1, price: PRICE },
                { level: 3, price: 236 },
              ],
            }),
          ],
        }),
      );

      expect(itemsPriceMasterService.save.mock.calls[0][0][0]).toMatchObject({
        ipm_sales_price_a: 118,
        ipm_price_a_wot: 100,
        ipm_sales_price_c: 236,
        ipm_price_c_wot: 200,
      });
    });

    it('updates the existing master row rather than creating a second one', async () => {
      await service.saveBulk(payload({ rows: [headlineRow()] }));

      expect(itemsPriceMasterService.save.mock.calls[0][0][0]).toMatchObject({ ipm_id: IPM_ID });
    });

    it('writes a chain headline as the branch-less row', async () => {
      await service.saveBulk(payload({ scope: 'CHAIN', rows: [headlineRow()] }));

      expect(itemsPriceMasterService.save.mock.calls[0][0][0]).toMatchObject({
        ipm_company_id: COMPANY_ID,
        ipm_branch_id: null,
      });
    });
  });

  // ── §5.5 the scope switch ─────────────────────────────────────────────────
  describe('scope resolution — §5.5, one case per row of the table', () => {
    it('row 1 · This branch over a BRANCH row issues S2', async () => {
      s1Finds('BRANCH');

      await service.saveBulk(payload({ rows: [bucketRow({ priceScope: 'BRANCH' })] }));

      expect(gateway.updateBucketPrice).toHaveBeenCalledTimes(1);
      expect(gateway.insertBucketPrice).not.toHaveBeenCalled();
    });

    it('row 2 · This branch over a CHAIN row issues S3, and says it created an override', async () => {
      s1Finds('CHAIN');

      await service.saveBulk(payload({ rows: [bucketRow({ priceScope: 'CHAIN' })] }));

      // The chain row exists and S1 would have found it at CHAIN scope. It was
      // searched for at BRANCH scope instead, found nothing, and inserted —
      // which is the whole of "the chain row is untouched and other branches
      // keep it".
      expect(gateway.updateBucketPrice).not.toHaveBeenCalled();
      expect(gateway.insertBucketPrice).toHaveBeenCalledTimes(1);
      expect(gateway.insertBucketPrice.mock.calls[0][2]).toMatchObject({
        targetScope: 'BRANCH',
        targetBranchId: BRANCH_ID,
        createsBranchOverride: true,
      });
    });

    it('row 3 · All branches over a CHAIN row issues S2 against the chain row', async () => {
      s1Finds('CHAIN');

      await service.saveBulk(
        payload({ scope: 'CHAIN', rows: [bucketRow({ priceScope: 'CHAIN' })] }),
      );

      expect(gateway.updateBucketPrice).toHaveBeenCalledTimes(1);
      expect(gateway.findBucketRowForUpdate.mock.calls[0][2]).toMatchObject({
        targetScope: 'CHAIN',
        targetBranchId: null,
      });
    });

    it('row 4 · All branches over a BRANCH row updates the override and does not promote it', async () => {
      s1Finds('BRANCH');

      await service.saveBulk(
        payload({ scope: 'CHAIN', rows: [bucketRow({ priceScope: 'BRANCH' })] }),
      );

      expect(gateway.updateBucketPrice).toHaveBeenCalledTimes(1);
      expect(gateway.findBucketRowForUpdate.mock.calls[0][2]).toMatchObject({
        targetScope: 'BRANCH',
        switchIgnored: true,
      });
    });
  });

  // ── §5.5 the HQ check ─────────────────────────────────────────────────────
  describe('the HQ check — §5.5', () => {
    it('refuses CHAIN from a non-HQ caller with 403 and attempts no write at all', async () => {
      requestContext.getUserType.mockReturnValue('USER');

      await expect(service.saveBulk(payload({ scope: 'CHAIN' }))).rejects.toMatchObject({
        status: 403,
      });
      // Not merely "no write": no transaction, no setting read, nothing. A
      // downgraded save would look like success and produce a different row.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(gateway.insertBucketPrice).not.toHaveBeenCalled();
    });

    it('refuses CHAIN when the caller has no user type at all', async () => {
      requestContext.getUserType.mockReturnValue(null);

      await expect(service.saveBulk(payload({ scope: 'CHAIN' }))).rejects.toMatchObject({
        status: 403,
      });
    });

    it('lets a non-HQ caller save at BRANCH scope', async () => {
      requestContext.getUserType.mockReturnValue('USER');

      await expect(service.saveBulk(payload())).resolves.toMatchObject({ saved: 1 });
    });

    it('matches the HQ list case- and space-insensitively', async () => {
      requestContext.getUserType.mockReturnValue('  admin ');

      await expect(service.saveBulk(payload({ scope: 'CHAIN' }))).resolves.toMatchObject({
        saved: 1,
      });
    });
  });

  // ── §0.3 / §5.3 below cost ────────────────────────────────────────────────
  describe('the below-cost setting and its round trip — §0.3, §5.3', () => {
    const belowCost = () =>
      gateway.validateRows.mockResolvedValue([problem({ verdict: 'BELOW_COST' })]);

    it('restrict aborts with 422 and the row list, before any write', async () => {
      settingIs('restrict');
      belowCost();

      await expect(service.saveBulk(payload())).rejects.toMatchObject({ status: 422 });
      expect(gateway.insertBucketPrice).not.toHaveBeenCalled();
    });

    it('restrict still aborts a payload that arrives already confirmed', async () => {
      settingIs('restrict');
      belowCost();

      // Otherwise `restrict` and `warning` would be one setting with two names.
      await expect(service.saveBulk(payload({ confirmed: true }))).rejects.toMatchObject({
        status: 422,
      });
    });

    it('warning answers needsConfirm with the rows, and writes nothing', async () => {
      settingIs('warning');
      belowCost();

      const result = await service.saveBulk(payload());

      expect(result).toMatchObject({ needsConfirm: true, saved: 0, masterRowsSaved: 0 });
      expect(result.problems).toHaveLength(1);
      expect(gateway.insertBucketPrice).not.toHaveBeenCalled();
      expect(itemsPriceMasterService.save).not.toHaveBeenCalled();
    });

    it('the confirmed re-post writes', async () => {
      settingIs('warning');
      belowCost();

      const result = await service.saveBulk(payload({ confirmed: true }));

      expect(result).toMatchObject({ needsConfirm: false, saved: 1 });
      expect(gateway.insertBucketPrice).toHaveBeenCalledTimes(1);
    });

    it('re-runs the validation on the confirmed post — the first verdicts are stale by definition', async () => {
      settingIs('warning');
      belowCost();

      await service.saveBulk(payload());
      await service.saveBulk(payload({ confirmed: true }));

      // Cost moves when a purchase posts, and the confirm is the user agreeing
      // to the PRICE, not to a particular cost figure.
      expect(gateway.validateRows).toHaveBeenCalledTimes(2);
    });

    it('allow writes and STILL reports the rows', async () => {
      settingIs('allow');
      belowCost();

      const result = await service.saveBulk(payload());

      expect(result).toMatchObject({ needsConfirm: false, saved: 1, belowCostPolicy: 'allow' });
      expect(result.problems).toHaveLength(1);
    });

    it('records a confirmed below-cost save in the audit row, with the rows', async () => {
      settingIs('warning');
      belowCost();

      await service.saveBulk(payload({ confirmed: true }));

      const [entry] = auditLogService.logEntityChange.mock.calls[0] as [
        { notes: string; modifiedRecord: { belowCostRows: unknown[] } },
      ];
      expect(entry.notes).toContain('below cost');
      expect(entry.modifiedRecord.belowCostRows).toHaveLength(1);
      // Inside the transaction, like every other module here.
      expect(auditLogService.logEntityChange.mock.calls[0][1]).toBe(tx);
    });

    it('reads the setting through the resolver, with the caller as the scope', async () => {
      await service.saveBulk(payload());

      expect(appSettingValueService.resolveEffective).toHaveBeenCalledWith({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: undefined,
        userId: USER_ID,
      });
    });
  });

  describe('confirmed suppresses below-cost ONLY — §5.3', () => {
    it.each([['ABOVE_MRP'], ['BELOW_MIN']] as const)(
      'still aborts a %s verdict on a confirmed post',
      async (verdict) => {
        settingIs('warning');
        gateway.validateRows.mockResolvedValue([
          problem({ verdict }),
          problem({ verdict: 'BELOW_COST', lineNo: 2 }),
        ]);

        await expect(service.saveBulk(payload({ confirmed: true }))).rejects.toMatchObject({
          status: 422,
        });
        expect(gateway.insertBucketPrice).not.toHaveBeenCalled();
      },
    );

    it('aborts a below-min verdict even under `allow`, because min has no constraint behind it', async () => {
      settingIs('allow');
      gateway.validateRows.mockResolvedValue([problem({ verdict: 'BELOW_MIN' })]);

      await expect(service.saveBulk(payload())).rejects.toMatchObject({ status: 422 });
    });
  });

  // ── §5.1 the recompute ────────────────────────────────────────────────────
  describe('price wins, the other three are derived — §5.1', () => {
    it('discards the priceWot and markupPerc the client sent and recomputes both', async () => {
      await service.saveBulk(
        payload({
          rows: [
            bucketRow({
              levels: [{ level: 1, price: PRICE, priceWot: 999, markupPerc: 999 }],
            }),
          ],
        }),
      );

      // 118 at 18% is 100 without tax; markup is on the tax-INCLUSIVE pair,
      // (118 - 95) / 95.
      expect(gateway.insertBucketPrice.mock.calls[0][1].levels[0]).toMatchObject({
        level: 1,
        price: 118,
        priceWot: 100,
        markupPerc: 24.210526,
      });
    });

    it("recomputes the headline row's numbers the same way", async () => {
      await service.saveBulk(
        payload({
          rows: [headlineRow({ levels: [{ level: 1, price: PRICE, priceWot: 999 }] })],
        }),
      );

      expect(itemsPriceMasterService.save.mock.calls[0][0][0]).toMatchObject({
        ipm_sales_price_a: 118,
        ipm_price_a_wot: 100,
      });
    });

    it('answers 0 rather than Infinity when nothing is known about the cost', () => {
      expect(recomputeLevel(1, 118, 18, 0)).toMatchObject({
        price: 118,
        priceWot: 100,
        markupPerc: 0,
        marginPerc: 0,
      });
    });

    it('puts markup on the inclusive pair and margin on the exclusive pair', () => {
      const level = recomputeLevel(1, 118, 18, 95);

      expect(level.markupPerc).toBeCloseTo(((118 - 95) / 95) * 100, 4);
      expect(level.marginPerc).toBeCloseTo(((100 - 95 / 1.18) / 100) * 100, 4);
    });
  });

  // ── §4.3 the tax date ─────────────────────────────────────────────────────
  describe('taxPerc resolved as of today, through item_tax_history — §4.3', () => {
    it('prefers the history window that covers the date over the item default', async () => {
      tx.itemTaxHistory.findMany.mockResolvedValue([
        { ithItemId: BUCKET_ITEM, ithTaxId: OLD_TAX_ID },
      ]);
      tx.itemTaxMaster.findMany.mockResolvedValue([
        {
          taxId: OLD_TAX_ID,
          taxGstRateTotal: 5,
          taxCessType: 'NONE',
          taxCessPerc: 0,
          taxCessUnit: 0,
        },
        { taxId: TAX_ID, taxGstRateTotal: 18, taxCessType: 'NONE', taxCessPerc: 0, taxCessUnit: 0 },
      ]);

      const rates = await service.resolveItemTaxRates(tx as never, [BUCKET_ITEM, HEADLINE_ITEM]);

      expect(rates.get(BUCKET_ITEM)).toMatchObject({ taxId: OLD_TAX_ID, taxPerc: 5 });
      // The item with no history row still falls back to its own default.
      expect(rates.get(HEADLINE_ITEM)).toMatchObject({ taxId: TAX_ID, taxPerc: 18 });
    });

    it('bounds the history read to windows that are open on the date asked for', async () => {
      const asOf = new Date('2026-09-07T11:00:00Z');

      await service.resolveItemTaxRates(tx as never, [BUCKET_ITEM], asOf);

      const where = tx.itemTaxHistory.findMany.mock.calls[0][0].where as {
        ithEffectiveFrom: { lte: Date };
        OR: [{ ithEffectiveTo: null }, { ithEffectiveTo: { gte: Date } }];
      };
      expect(where.ithEffectiveFrom.lte.toISOString()).toBe('2026-09-07T00:00:00.000Z');
      expect(where.OR[0]).toEqual({ ithEffectiveTo: null });
    });

    it('flags a cess item, because the four-number panel is only approximate for it', async () => {
      tx.itemTaxMaster.findMany.mockResolvedValue([
        { taxId: TAX_ID, taxGstRateTotal: 28, taxCessType: 'UNIT', taxCessPerc: 0, taxCessUnit: 4 },
      ]);

      const rates = await service.resolveItemTaxRates(tx as never, [BUCKET_ITEM]);

      expect(rates.get(BUCKET_ITEM)).toMatchObject({ taxPerc: 28, hasCess: true });
    });

    it('answers 0% for an item with no tax at all rather than failing the save', async () => {
      tx.itemMaster.findMany.mockResolvedValue([
        {
          itemId: BUCKET_ITEM,
          itemCode: null,
          itemNameEn: 'X',
          itemDefaultTaxId: null,
          itemInclTax: false,
        },
      ]);

      const rates = await service.resolveItemTaxRates(tx as never, [BUCKET_ITEM]);

      expect(rates.get(BUCKET_ITEM)).toMatchObject({ taxPerc: 0, taxId: null, hasCess: false });
    });
  });

  // ── §5.4 the message ──────────────────────────────────────────────────────
  describe('the response message — §5.4', () => {
    const base = {
      saved: 12,
      masterRowsSaved: 2,
      noStock: [],
      needsConfirm: false,
      problems: [],
      belowCostPolicy: 'warning' as BelowCostPolicy,
    };

    it('never says a plain "Saved" when noStock is non-empty — legacy fault #2', () => {
      const message = service.buildSaveMessage({
        ...base,
        noStock: [{ bucketId: SMP_ID }, { bucketId: SMP_ID }] as never,
      });

      expect(message).not.toBe('Saved');
      expect(message).toContain('12 buckets saved');
      expect(message).toContain('2 have no stock on hand');
      expect(message).toContain('the price applies when stock arrives');
    });

    it('says nothing about stock when every priced bucket has some', () => {
      expect(service.buildSaveMessage(base)).toBe('12 buckets saved · 2 headline rows saved.');
    });

    it('asks rather than reports when the save needs confirming', () => {
      const message = service.buildSaveMessage({
        ...base,
        saved: 0,
        masterRowsSaved: 0,
        needsConfirm: true,
        problems: [problem({ verdict: 'BELOW_COST' })],
      });

      expect(message).toContain('below cost');
      expect(message).toContain('Confirm');
    });

    it('carries the no-stock list into the save result', async () => {
      gateway.listNoStock.mockResolvedValue([{ bucketId: SMP_ID, itemId: BUCKET_ITEM }]);

      const result = await service.saveBulk(payload());

      expect(result.noStock).toHaveLength(1);
      expect(service.buildSaveMessage(result)).toContain('no stock on hand');
    });
  });
});

describe('the below-cost policy helpers — §0.3', () => {
  it('reads the key out of the resolved catalog', () => {
    expect(
      resolveBelowCostPolicy([
        { asdKey: 'inventory.below_cost_price', value: 'restrict' },
      ] as never),
    ).toBe('restrict');
  });

  it.each([
    ['an absent key', []],
    ['a blank value', [{ asdKey: 'inventory.below_cost_price', value: '   ' }]],
    ['a null value', [{ asdKey: 'inventory.below_cost_price', value: null }]],
    // The screen plan's vocabulary. `block` is not in the catalog and never
    // was — §13.4 — so it must not silently become `restrict`.
    ['the screen plan\'s "block"', [{ asdKey: 'inventory.below_cost_price', value: 'block' }]],
  ])('falls back to the seeded default on %s', (_label, effective) => {
    expect(resolveBelowCostPolicy(effective as never)).toBe('warning');
  });

  it.each([
    ['restrict', false, 'ABORT'],
    ['restrict', true, 'ABORT'],
    ['warning', false, 'CONFIRM'],
    ['warning', true, 'PROCEED'],
    ['allow', false, 'PROCEED'],
    ['allow', true, 'PROCEED'],
  ] as const)('%s + confirmed=%s is %s', (policy, confirmed, expected) => {
    expect(resolveBelowCostAction(policy, confirmed)).toBe(expected);
  });
});

describe('SellingPriceBulkExceptionFilter — the SQLSTATE map, §9', () => {
  let filter: SellingPriceBulkExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new SellingPriceBulkExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', url: '/api/v1/stock/price-bulk' }),
      }),
    } as unknown as ArgumentsHost;
  });

  // Every one of these arrives from Prisma as code P2010 with the real SQLSTATE
  // in meta.code — a filter switching on error.code answers 500 to all of them.
  it.each([
    ['23514', 'new row violates check constraint "ck_smp_not_above_mrp"', 422],
    ['23P01', 'conflicting key value violates exclusion constraint "ex_smp_overlap"', 409],
    ['23505', 'duplicate key value violates unique constraint "ux_smp_identity"', 409],
    ['23503', 'insert violates foreign key constraint "fk_smp_item"', 422],
    ['P0002', 'bucket vanished between load and save', 404],
  ])('maps meta.code %s to HTTP %i', (sqlState, message, expected) => {
    filter.catch(engineError(sqlState, message), host);

    expect(status).toHaveBeenCalledWith(expected);
  });

  it('says what ex_smp_overlap MEANS, and still carries the engine text', () => {
    filter.catch(
      engineError('23P01', 'conflicting key value violates exclusion constraint "ex_smp_overlap"'),
      host,
    );

    const [body] = json.mock.calls[0] as [{ message: string; errors: { message: string }[] }];
    expect(body.message).toContain('Another price already covers this bucket');
    expect(body.message).toContain('period');
    // "conflicting key value violates exclusion constraint" tells a shopkeeper
    // nothing, but it is what the log will be searched for.
    expect(body.errors[0].message).toContain('ex_smp_overlap');
  });

  it('names the constraint behind an above-MRP refusal', () => {
    filter.catch(
      engineError('23514', 'new row violates check constraint "ck_smp_not_above_mrp"'),
      host,
    );

    const [body] = json.mock.calls[0] as [{ message: string }];
    expect(body.message).toContain('cannot be above the MRP');
  });

  it('lets an unrecognised SQLSTATE fall through to 500 rather than dressing it up', () => {
    filter.catch(engineError('42P01', 'relation "stock.stock_mrp_price" does not exist'), host);

    expect(status).toHaveBeenCalledWith(500);
  });

  it('passes an HttpException the service already built through untouched', () => {
    filter.catch(new HttpException({ success: false, message: 'nope', errors: [] }, 403), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'nope', errors: [] });
  });
});

describe('StockMrpPriceGateway — the seam, §0.1', () => {
  const gateway = new StockMrpPriceGateway(null as never);

  it('is not deployed on this database, and says which statement it is waiting on', async () => {
    expect(gateway.isDeployed).toBe(false);
    await expect(
      gateway.listPrices({ companyId: COMPANY_ID, branchId: BRANCH_ID, limit: 10, offset: 0 }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it.each([
    ['listBuckets', () => gateway.listBuckets(BUCKET_ITEM, COMPANY_ID, BRANCH_ID)],
    ['validateRows', () => gateway.validateRows(null as never, [], [])],
    [
      'findBucketRowForUpdate',
      () => gateway.findBucketRowForUpdate(null as never, null as never, null as never),
    ],
    ['updateBucketPrice', () => gateway.updateBucketPrice(null as never, SMP_ID, null as never)],
    [
      'insertBucketPrice',
      () => gateway.insertBucketPrice(null as never, null as never, null as never),
    ],
    ['listNoStock', () => gateway.listNoStock(null as never, [SMP_ID], BRANCH_ID)],
  ])('%s answers 503 rather than a Prisma stack trace', async (_name, call) => {
    await expect(call()).rejects.toMatchObject({ status: 503 });
  });
});
