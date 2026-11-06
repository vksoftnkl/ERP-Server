import { ForbiddenException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PreparedBulkSave } from '../../stocks/selling-price-bulk/selling-price-bulk.service';
import type { SaveItemQtyPriceDto } from '../items-qty-price-master/dto/save-item-qty-price.dto';
import type { SaveItemQtyRatesDto } from './dto/save-item-qty-rates.dto';
import { ItemQtyRatesService } from './item-qty-rates.service';

const d = (value: string | number) => new Prisma.Decimal(String(value));
const COMPANY = '01000000-0000-7000-8000-0000000000c1';
const BRANCH = '01000000-0000-7000-8000-0000000000b1';
const USER = '01000000-0000-7000-8000-0000000000a1';
const ITEM = '01000000-0000-7000-8000-000000000001';
const OTHER_ITEM = '01000000-0000-7000-8000-000000000002';
const BOX = '01000000-0000-7000-8000-0000000000b0';
const PC = '01000000-0000-7000-8000-0000000000c0';
const IPM = '01000000-0000-7000-8000-000000000041';
const SLAB_ID = '01000000-0000-7000-8000-000000000051';
const TODAY = '2026-11-06';

/** The status, codes and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  const body = error.getResponse() as {
    errors: Array<{ code: string; field: string }>;
    problems?: unknown[];
  };
  return { status: error.getStatus(), codes: body.errors.map((e) => e.code), body };
}

const priceRow = (overrides: Record<string, unknown> = {}) => ({
  ipmId: IPM,
  ipmUcUnitId: BOX,
  ipmCompanyId: COMPANY,
  ipmBranchId: BRANCH,
  ipmKeyMrp: d(-1),
  ipmKeySp: d(-1),
  ipmEffectiveFrom: new Date('1900-01-01T00:00:00Z'),
  ipmEffectiveTo: new Date('9999-12-31T00:00:00Z'),
  ipmIsDeleted: false,
  ipmCostPrice: d(3270),
  ipmCostWot: d('2771.186441'),
  ipmMaxPrice: d(4600),
  ipmMinPrice: d(0),
  ipmProfitType: 'By Rs',
  ipmRoundOff: d(1),
  ipmSalesPriceA: d(3600),
  ipmSalesPriceB: d(3760),
  ipmSalesPriceC: d(0),
  ipmSalesPriceD: d(0),
  ...overrides,
});

const units = [
  {
    uomId: BOX,
    unitName: 'BOX',
    unitSlno: 1,
    toBase: d(4),
    unitFactor: d(1),
    parentUomId: null,
    parentUnitName: null,
    parentToBase: null,
  },
  {
    uomId: PC,
    unitName: 'PC',
    unitSlno: 2,
    toBase: d(1),
    unitFactor: d(4),
    parentUomId: BOX,
    parentUnitName: 'BOX',
    parentToBase: d(4),
  },
];

const slabDto = (overrides: Partial<SaveItemQtyPriceDto> = {}) =>
  ({
    iqp_item_id: ITEM,
    iqp_item_unit_id: BOX,
    iqp_company_id: COMPANY,
    iqp_branch_id: BRANCH,
    iqp_price_level: 1,
    iqp_from_qty: 10,
    iqp_price_mode: 'F',
    iqp_price: 3500,
    iqp_is_tax_incl: true,
    iqp_effective_from: TODAY,
    ...overrides,
  }) as SaveItemQtyPriceDto;

describe('ItemQtyRatesService', () => {
  let service: ItemQtyRatesService;
  let calls: string[];
  let tx: Record<string, { findMany: jest.Mock }>;
  let prisma: Record<string, unknown> & { $transaction: jest.Mock; $queryRaw: jest.Mock };
  let requestContext: { getUserId: jest.Mock; getUserType: jest.Mock; getDeviceId: jest.Mock };
  let settings: { resolveEffective: jest.Mock };
  let gateway: Record<string, jest.Mock>;
  let costGateway: { findItem: jest.Mock };
  let bulk: Record<string, jest.Mock>;
  let bulkGateway: { loadRowCosts: jest.Mock };
  let slabs: Record<string, jest.Mock>;

  const policyIs = (value: string) =>
    settings.resolveEffective.mockResolvedValue([{ asdKey: 'inventory.below_cost_price', value }]);

  /** What prepareBulk hands back for one BOX row (the bulk service is mocked). */
  const prepared = (
    levels: Array<{ level: number; price: number }>,
    extra: Partial<PreparedBulkSave> = {},
    raw: Record<string, unknown> = {},
  ): PreparedBulkSave =>
    ({
      dto: {
        companyId: COMPANY,
        branchId: BRANCH,
        scope: 'BRANCH',
        rows: [{ itemId: ITEM, uomId: BOX, levels, ...raw }],
      },
      actor: USER,
      from: TODAY,
      scheduledFrom: undefined,
      costs: [{ costRate: 3270, costWot: 2771, minPrice: 0, uomBelongs: true }],
      candidates: [
        {
          lineNo: 1,
          companyId: COMPANY,
          itemId: ITEM,
          uomId: BOX,
          itemCode: null,
          itemName: 'ZT-RICE',
          bucketId: IPM,
          mrp: null,
          salePrice: null,
          levels: levels.map((l) => ({ ...l, priceWot: 0, markupPerc: 0 })),
          minPrice: null,
          roundOff: null,
          costRate: 3270,
          costWot: 2771,
          actor: USER,
        },
      ],
      resolutions: [{ targetBranchId: BRANCH }],
      problems: [],
      belowCost: [],
      ...extra,
    }) as unknown as PreparedBulkSave;

  const body = (overrides: Partial<SaveItemQtyRatesDto> = {}) =>
    ({ companyId: COMPANY, branchId: BRANCH, itemId: ITEM, ...overrides }) as SaveItemQtyRatesDto;

  beforeEach(() => {
    calls = [];
    const step = (name: string, value?: unknown) =>
      jest.fn(async (...args: unknown[]) => {
        calls.push(name);
        return typeof value === 'function'
          ? (value as (...a: unknown[]) => unknown)(...args)
          : value;
      });
    tx = {
      itemMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ itemId: ITEM, itemDefaultTaxId: 'TAX', itemInclTax: true }]),
      },
      itemTaxHistory: { findMany: jest.fn().mockResolvedValue([]) },
      taxRateMaster: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { taxId: 'TAX', taxRatePerc: 18, taxCessBasis: 'NONE', taxAcessBasis: 'NONE' },
          ]),
      },
    };
    prisma = {
      // the read (getWithRates) resolves tax on the client itself
      ...tx,
      $transaction: jest.fn(async (fn: (client: unknown) => unknown) => {
        calls.push('tx');
        return fn(tx);
      }),
      $queryRaw: jest.fn().mockResolvedValue([{ um_can_edit: true }]),
    };
    requestContext = {
      getUserId: jest.fn().mockReturnValue(USER),
      getUserType: jest.fn().mockReturnValue('SUPER ADMIN'),
      getDeviceId: jest.fn().mockReturnValue(null),
    };
    settings = { resolveEffective: jest.fn() };
    policyIs('warning');
    gateway = {
      lockItem: step('lock'),
      levels: jest.fn().mockResolvedValue([
        { level: 1, name: 'Whole Sale', short: 'WS', active: true },
        { level: 2, name: 'Retail', short: 'RT', active: true },
        { level: 3, name: 'Price C', short: null, active: false },
        { level: 4, name: 'Price D', short: null, active: false },
      ]),
      units: jest.fn().mockResolvedValue(units),
      priceRows: jest.fn().mockResolvedValue([priceRow()]),
      liveSlabs: jest.fn().mockResolvedValue([]),
      barcode: jest.fn().mockResolvedValue('8901'),
      groupAndBrand: jest.fn().mockResolvedValue({ groupName: 'ZT-GRAINS', brandName: null }),
      today: jest.fn().mockResolvedValue(TODAY),
    };
    costGateway = {
      findItem: jest.fn().mockResolvedValue({
        itemId: ITEM,
        itemCode: 'ZT1',
        itemName: 'ZT-RICE',
        isActive: true,
        isBatchBased: false,
        presetName: null,
        presetTracks: false,
      }),
    };
    bulk = {
      assertCanEditPrices: step('right:30'),
      describeOriginMenu: jest.fn().mockResolvedValue('via Qty-wise Prices (menu 244)'),
      prepareBulk: step('prepare', prepared([{ level: 1, price: 3600 }])),
      writeBulkInTx: step('write:card', { saved: 1, rows: [] }),
      listPrices: jest.fn(),
    };
    bulkGateway = {
      loadRowCosts: jest.fn(async (_tx, rows: unknown[]) => rows.map(() => ({ costRate: 0 }))),
    };
    slabs = {
      assertRight: jest.fn(async (right: string) => {
        calls.push(`right:244:${right}`);
        return { view: true, create: true, edit: true, delete: true };
      }),
      readStoredSlabs: jest.fn().mockResolvedValue(new Map()),
      assertSellingLevels: step('levels'),
      assertChainSlabsAllowed: step('hq'),
      assertOwnBranchSlabs: step('branch'),
      assertOwnBranchSlabIds: step('branch:deletes'),
      softDelete: step('write:delete', (ids: string[]) =>
        ids.map((iqp_id) => ({ iqp_id, deleted: true })),
      ),
      save: step('write:slabs', [{ iqp_id: 'NEW' }]),
      listForItem: jest.fn().mockResolvedValue([]),
    };
    service = new ItemQtyRatesService(
      prisma as never,
      requestContext as never,
      settings as never,
      gateway as never,
      costGateway as never,
      bulk as never,
      bulkGateway as never,
      slabs as never,
    );
  });

  describe('saveWithRates — rights, then shape', () => {
    it('checks every right before anything is read: 244 view / create / edit / delete, then menu 30', async () => {
      await service
        .saveWithRates(
          body({
            rates: { rows: [{ uomId: BOX, levels: [{ level: 1, price: 3600 }] }] } as never,
            slabs: [slabDto(), slabDto({ iqp_id: SLAB_ID })],
            deleteSlabIds: ['01000000-0000-7000-8000-000000000052'],
          }),
        )
        .catch(() => undefined);
      expect(calls.slice(0, 6)).toEqual([
        'right:244:view',
        'right:244:create',
        'right:244:edit',
        'right:244:delete',
        'right:30',
        'tx',
      ]);
    });

    it('a refused right stops the save before its transaction', async () => {
      slabs.assertRight.mockRejectedValueOnce(
        new ForbiddenException({ success: false, message: 'no', errors: [] }),
      );
      await expect(service.saveWithRates(body({ slabs: [slabDto()] }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('a slabs-only save needs no menu 30 right and prepares no card', async () => {
      await service.saveWithRates(body({ slabs: [slabDto()] }));
      expect(bulk.assertCanEditPrices).not.toHaveBeenCalled();
      expect(bulk.prepareBulk).not.toHaveBeenCalled();
      expect(calls).toContain('write:slabs');
    });

    it('400 NOTHING_TO_SAVE, ITEM_MISMATCH and VALIDATION_ARRAY_UNIQUE, nothing read', async () => {
      expect(
        await refusalOf(service.saveWithRates(body({ rates: { rows: [] } as never }))),
      ).toMatchObject({
        status: 400,
        codes: ['ITEM_QTY_PRICE_NOTHING_TO_SAVE'],
      });
      expect(
        await refusalOf(
          service.saveWithRates(body({ slabs: [slabDto({ iqp_item_id: OTHER_ITEM })] })),
        ),
      ).toMatchObject({ status: 400, codes: ['ITEM_QTY_PRICE_ITEM_MISMATCH'] });
      expect(
        await refusalOf(
          service.saveWithRates(
            body({ slabs: [slabDto({ iqp_id: SLAB_ID })], deleteSlabIds: [SLAB_ID.toUpperCase()] }),
          ),
        ),
      ).toMatchObject({ status: 400, codes: ['VALIDATION_ARRAY_UNIQUE'] });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("a named slab must be there and be this item's (404 / 400), before the level and HQ rules", async () => {
      expect(
        await refusalOf(service.saveWithRates(body({ deleteSlabIds: [SLAB_ID] }))),
      ).toMatchObject({
        status: 404,
        codes: ['ITEM_QTY_PRICE_NOT_FOUND'],
      });
      slabs.readStoredSlabs.mockResolvedValue(
        new Map([
          [
            SLAB_ID,
            {
              iqpId: SLAB_ID,
              itemId: OTHER_ITEM,
              branchId: BRANCH,
              priceLevel: 1,
              isDeleted: false,
            },
          ],
        ]),
      );
      expect(
        await refusalOf(service.saveWithRates(body({ deleteSlabIds: [SLAB_ID] }))),
      ).toMatchObject({
        status: 400,
        codes: ['ITEM_QTY_PRICE_ITEM_MISMATCH'],
      });
      expect(calls).not.toContain('levels');
      expect(calls).not.toContain('write:delete');
    });

    it('passes the level and HQ rules the stored slabs, prefixed slabs.', async () => {
      await service.saveWithRates(body({ slabs: [slabDto()] }));
      expect(slabs.assertSellingLevels).toHaveBeenCalledWith(
        tx,
        [expect.any(Object)],
        'slabs.',
        expect.any(Map),
      );
      expect(slabs.assertChainSlabsAllowed).toHaveBeenCalledWith(
        tx,
        [expect.any(Object)],
        'slabs.',
        expect.any(Map),
      );
      expect(calls.indexOf('lock')).toBeLessThan(calls.indexOf('levels'));
    });

    it('D16 (C-d): the own-branch rule runs after the HQ rule, on the slabs and the deletes', async () => {
      slabs.readStoredSlabs.mockResolvedValue(
        new Map([
          [
            SLAB_ID,
            { iqpId: SLAB_ID, itemId: ITEM, branchId: BRANCH, priceLevel: 1, isDeleted: false },
          ],
        ]),
      );
      await service.saveWithRates(body({ slabs: [slabDto()], deleteSlabIds: [SLAB_ID] }));
      expect(slabs.assertOwnBranchSlabs).toHaveBeenCalledWith(
        tx,
        [expect.any(Object)],
        'slabs.',
        expect.any(Map),
      );
      const [, ids, fieldOf, stored] = slabs.assertOwnBranchSlabIds.mock.calls[0] as [
        unknown,
        string[],
        (index: number) => string,
        Map<string, unknown>,
      ];
      expect([ids, fieldOf(0), stored instanceof Map]).toEqual([
        [SLAB_ID],
        'deleteSlabIds.0',
        true,
      ]);
      expect(calls.indexOf('hq')).toBeLessThan(calls.indexOf('branch'));
      expect(calls.indexOf('branch:deletes')).toBeLessThan(calls.indexOf('write:delete'));

      slabs.assertOwnBranchSlabs.mockRejectedValueOnce(
        new ForbiddenException({
          success: false,
          message: 'no',
          errors: [
            { field: 'slabs.0.iqp_branch_id', code: 'ITEM_QTY_PRICE_OTHER_BRANCH', message: 'no' },
          ],
        }),
      );
      calls.length = 0;
      expect(
        await refusalOf(service.saveWithRates(body({ slabs: [slabDto()] }))),
      ).toMatchObject({ status: 403, codes: ['ITEM_QTY_PRICE_OTHER_BRANCH'] });
      expect(calls.filter((c) => c.startsWith('write:'))).toEqual([]);
    });
  });

  describe('saveWithRates — review fixes C-a / C-c', () => {
    it('C-a: prepares the card judging only the active levels (price-bulk skips the rest and 0s)', async () => {
      await service.saveWithRates(
        body({ rates: { rows: [{ uomId: BOX, levels: [{ level: 1, price: 3600 }] }] } as never }),
      );
      const [, , opts] = bulk.prepareBulk.mock.calls[0] as [
        unknown,
        unknown,
        { activeLevels: number[]; keepCost: unknown },
      ];
      expect(opts.activeLevels).toEqual([1, 2]);
      expect(typeof opts.keepCost).toBe('function');
    });

    it('C-c: a cost equal to the stored one at 2 decimals keeps the stored figures and asks nothing', async () => {
      // A By User unit whose stored cost has 6 decimals; the screen sends it back rounded.
      gateway.priceRows.mockResolvedValue([
        priceRow({
          ipmProfitType: 'By User',
          ipmCostPrice: d('3270.004567'),
          ipmCostWot: d('2771.190311'),
        }),
      ]);
      bulk.prepareBulk.mockResolvedValue(
        prepared([{ level: 1, price: 3600 }], {}, { costPrice: 3270 }),
      );
      const saved = await service.saveWithRates(
        body({
          rates: {
            rows: [{ uomId: BOX, costPrice: 3270, levels: [{ level: 1, price: 3600 }] }],
          } as never,
        }),
      );
      // no By User question: the cost did not change
      expect(saved.needsConfirm).toBe(false);
      expect(saved.problems).toEqual([]);
      const [, , opts] = bulk.prepareBulk.mock.calls[0] as [
        unknown,
        unknown,
        {
          keepCost: (
            index: number,
            row: { uomId: string; costPrice?: number | null },
            key: { mrp: number | null; salePrice: number | null },
          ) => { costRate: number; costWot: number } | null;
        },
      ];
      const headline = { mrp: null, salePrice: null };
      // the stored 6-decimal cost and its w/o-tax half are what gets written
      expect(opts.keepCost(0, { uomId: BOX, costPrice: 3270 }, headline)).toEqual({
        costRate: 3270.004567,
        costWot: 2771.190311,
      });
      expect(opts.keepCost(0, { uomId: BOX, costPrice: 3270.004567 }, headline)).toEqual({
        costRate: 3270.004567,
        costWot: 2771.190311,
      });
      // a real change (or a row with nothing to keep) is the typed cost
      expect(opts.keepCost(0, { uomId: BOX, costPrice: 3271 }, headline)).toBeNull();
      expect(opts.keepCost(0, { uomId: PC, costPrice: 3270 }, headline)).toBeNull();
    });

    it('C-c: a cost that really changed still asks about a By User unit that kept its prices', async () => {
      gateway.priceRows.mockResolvedValue([priceRow({ ipmProfitType: 'By User' })]);
      bulk.prepareBulk.mockResolvedValue(
        prepared([{ level: 1, price: 3600 }, { level: 2, price: 3760 }], {}, { costPrice: 3300 }),
      );
      const asked = await service.saveWithRates(
        body({
          rates: {
            rows: [
              {
                uomId: BOX,
                costPrice: 3300,
                levels: [
                  { level: 1, price: 3600 },
                  { level: 2, price: 3760 },
                ],
              },
            ],
          } as never,
        }),
      );
      expect(asked.needsConfirm).toBe(true);
      expect(asked.problems.map((p) => p.code)).toEqual(['ITEM_QTY_PRICE_BY_USER_PRICES_KEPT']);
    });
  });

  describe('saveWithRates — the checks, nothing written', () => {
    it('refuses a typed cost / MRP on an item that is not Plain stock', async () => {
      costGateway.findItem.mockResolvedValue({
        itemId: ITEM,
        itemCode: null,
        itemName: 'MRP ITEM',
        isActive: true,
        isBatchBased: false,
        presetName: 'MRP & selling price',
        presetTracks: true,
      });
      const refusal = await refusalOf(
        service.saveWithRates(
          body({
            rates: {
              rows: [
                { uomId: BOX, costPrice: 10, maxPrice: 20, levels: [{ level: 1, price: 15 }] },
              ],
            } as never,
          }),
        ),
      );
      expect(refusal).toMatchObject({
        status: 422,
        codes: ['ITEM_QTY_PRICE_COST_NOT_PLAIN_STOCK', 'ITEM_QTY_PRICE_MRP_NOT_PLAIN_STOCK'],
      });
      expect(bulk.prepareBulk).not.toHaveBeenCalled();
    });

    it('refuses a headline price above the typed MRP (422, problems listed), writing nothing', async () => {
      bulk.prepareBulk.mockResolvedValue(
        prepared([{ level: 1, price: 4000 }], {}, { maxPrice: 3900 }),
      );
      const refusal = await refusalOf(
        service.saveWithRates(
          body({
            rates: {
              rows: [{ uomId: BOX, maxPrice: 3900, levels: [{ level: 1, price: 4000 }] }],
            } as never,
          }),
        ),
      );
      expect(refusal.status).toBe(422);
      expect(refusal.codes).toEqual(['ITEM_QTY_PRICE_ABOVE_MRP']);
      expect(refusal.body.problems).toHaveLength(1);
      expect(calls.filter((c) => c.startsWith('write:'))).toEqual([]);
    });

    it('judges a stored slab against the card after the save (C7): a cost rise pushes it under', async () => {
      gateway.liveSlabs.mockResolvedValue([
        {
          iqpId: SLAB_ID,
          iqpItemUnitId: BOX,
          iqpCompanyId: COMPANY,
          iqpBranchId: BRANCH,
          iqpPartyId: null,
          iqpPriceLevel: 1,
          iqpFromQty: d(10),
          iqpToQty: null,
          iqpPriceMode: 'F',
          iqpDiscPct: null,
          iqpFlatOff: null,
          iqpPrice: d(3350),
          iqpIsTaxIncl: true,
          iqpEffectiveFrom: new Date('2026-11-01T00:00:00Z'),
          iqpEffectiveTo: null,
          iqpIsActive: true,
          iqpModifiedOn: new Date(),
        },
      ]);
      bulk.prepareBulk.mockResolvedValue(
        prepared([{ level: 1, price: 3757 }], {}, { costPrice: 3430 }),
      );
      const asked = await service.saveWithRates(
        body({
          rates: {
            rows: [{ uomId: BOX, costPrice: 3430, levels: [{ level: 1, price: 3757 }] }],
          } as never,
        }),
      );
      expect(asked.needsConfirm).toBe(true);
      expect(asked.problems).toEqual([
        expect.objectContaining({
          source: 'SLAB',
          code: 'ITEM_QTY_PRICE_BELOW_COST',
          severity: 'ASK',
          iqpId: SLAB_ID,
          slabIndex: null,
          price: 3350,
          cost: 3430,
        }),
      ]);
      expect(calls.filter((c) => c.startsWith('write:'))).toEqual([]);

      policyIs('restrict');
      expect(
        await refusalOf(
          service.saveWithRates(
            body({
              rates: {
                rows: [{ uomId: BOX, costPrice: 3430, levels: [{ level: 1, price: 3757 }] }],
              } as never,
            }),
          ),
        ),
      ).toMatchObject({ status: 422, codes: ['ITEM_QTY_PRICE_BELOW_COST'] });
    });

    it("asks about the card's own below-cost rows under warning (STOCK_PRICE_BELOW_COST)", async () => {
      bulk.prepareBulk.mockResolvedValue(
        prepared([{ level: 1, price: 3000 }], {
          belowCost: [
            {
              lineNo: 1,
              itemId: ITEM,
              itemCode: null,
              itemName: 'ZT-RICE',
              uomId: BOX,
              bucketId: IPM,
              level: 1,
              verdict: 'BELOW_COST',
              message: 'ZT-RICE: 3000 is below the cost 3270.',
            },
          ],
        }),
      );
      const asked = await service.saveWithRates(
        body({ rates: { rows: [{ uomId: BOX, levels: [{ level: 1, price: 3000 }] }] } as never }),
      );
      expect(asked).toMatchObject({
        needsConfirm: true,
        rates: null,
        slabs: [],
        deletedSlabIds: [],
      });
      expect(asked.problems[0]).toMatchObject({
        source: 'CARD',
        code: 'STOCK_PRICE_BELOW_COST',
        severity: 'ASK',
        lineNo: 1,
        price: 3000,
        cost: 3270,
        unitName: 'BOX',
      });
    });
  });

  describe('saveWithRates — the write', () => {
    it('confirmed: deletes, then the card (via menu 244), then the slabs, in one transaction', async () => {
      slabs.readStoredSlabs.mockResolvedValue(
        new Map([
          [
            SLAB_ID,
            { iqpId: SLAB_ID, itemId: ITEM, branchId: BRANCH, priceLevel: 1, isDeleted: false },
          ],
        ]),
      );
      const result = await service.saveWithRates(
        body({
          confirmed: true,
          rates: { rows: [{ uomId: BOX, levels: [{ level: 1, price: 3600 }] }] } as never,
          slabs: [slabDto()],
          deleteSlabIds: [SLAB_ID],
        }),
      );
      expect(calls.filter((c) => c.startsWith('write:'))).toEqual([
        'write:delete',
        'write:card',
        'write:slabs',
      ]);
      expect(bulk.writeBulkInTx).toHaveBeenCalledWith(tx, expect.anything(), {
        confirmed: true,
        via: 'via Qty-wise Prices (menu 244)',
        policy: 'warning',
      });
      expect(slabs.softDelete).toHaveBeenCalledWith([SLAB_ID], tx);
      // C-e: every slab refusal filed under slabs.<i>.
      expect(slabs.save).toHaveBeenCalledWith([expect.any(Object)], tx, { fieldPrefix: 'slabs.' });
      expect(result).toMatchObject({
        needsConfirm: false,
        rates: { saved: 1 },
        slabs: [{ iqp_id: 'NEW' }],
        deletedSlabIds: [SLAB_ID],
        belowCostPolicy: 'warning',
      });
      // the card rows go to Change Selling Price as THIS branch, from today, via menu 244
      const [, dto] = bulk.prepareBulk.mock.calls[0] as [
        unknown,
        { scope: string; originMenuId: number; rows: Array<{ itemId: string }> },
      ];
      expect(dto).toMatchObject({ scope: 'BRANCH', originMenuId: 244 });
      expect(dto.rows[0].itemId).toBe(ITEM);
      expect(service.buildSaveMessage(result)).toBe(
        'Saved · cost + card rate 1 row · slabs 1 · 1 removed',
      );
    });
  });

  describe('getWithRates', () => {
    beforeEach(() => {
      bulk.listPrices.mockResolvedValue({
        items: [
          {
            lineNo: 1,
            uomId: BOX,
            unitName: 'BOX',
            stockQty: 3,
            mrp: null,
            salePrice: null,
            maxPrice: 4600,
            priceSource: 'MASTER',
            priceScope: 'BRANCH',
            bucketId: IPM,
            costRate: 3100,
            costWot: 2627,
            costBasis: 'ITEM',
            minPrice: 0,
            roundOff: 1,
            taxPerc: 18,
            levels: [1, 2, 3, 4].map((level) => ({ level, price: level === 1 ? 3600 : 0 })),
          },
          {
            lineNo: 2,
            uomId: 'INACTIVE-UNIT',
            unitName: 'CASE',
            stockQty: 0,
            mrp: null,
            salePrice: null,
            maxPrice: 0,
            priceSource: 'MASTER',
            priceScope: null,
            bucketId: null,
            costRate: 0,
            costWot: 0,
            costBasis: null,
            minPrice: 0,
            roundOff: 0,
            taxPerc: 18,
            levels: [1, 2, 3, 4].map((level) => ({ level, price: 0 })),
          },
        ],
        meta: {},
      });
    });

    it('answers the item, rights, active levels, the card rows of active units and the slabs', async () => {
      const view = await service.getWithRates({
        itemId: ITEM,
        companyId: COMPANY,
        branchId: BRANCH,
      });
      expect(view.item).toMatchObject({
        plainStock: true,
        trackedAs: 'Plain stock',
        leftOutReason: null,
        barcode: '8901',
        // C-f: the item line's group and brand, null when none
        groupName: 'ZT-GRAINS',
        brandName: null,
        taxPerc: 18,
      });
      expect(view.rights).toEqual({
        view: true,
        createSlab: true,
        editSlab: true,
        deleteSlab: true,
        editCard: true,
        allBranchSlab: true,
      });
      expect(view.levels.map((l) => l.level)).toEqual([1, 2]);
      expect(view.units).toHaveLength(1);
      expect(view.units[0]).toMatchObject({
        uomId: BOX,
        stockAvg: 3100,
        rowCost: 3270,
        cardCost: 3270,
        profitType: 'By Rs',
        costEditable: true,
        mrpEditable: true,
        scheduledFrom: null,
        parentUomId: null,
      });
      // markup against the card's cost, not the stock average
      expect(view.units[0].levels[0].markupPerc).toBeCloseTo(((3600 - 3270) / 3270) * 100, 4);
      expect(bulk.listPrices).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: ITEM, activeOnly: false }),
      );
    });

    it('locks the band without menu 30 EDIT, and the cost on an item that is not Plain stock', async () => {
      prisma.$queryRaw.mockResolvedValue([{ um_can_edit: false }]);
      let view = await service.getWithRates({ itemId: ITEM, companyId: COMPANY, branchId: BRANCH });
      expect([view.rights.editCard, view.units[0].costEditable]).toEqual([false, false]);

      prisma.$queryRaw.mockResolvedValue([{ um_can_edit: true }]);
      costGateway.findItem.mockResolvedValue({
        itemId: ITEM,
        itemCode: null,
        itemName: 'MRP ITEM',
        isActive: true,
        isBatchBased: false,
        presetName: 'MRP & selling price',
        presetTracks: true,
      });
      view = await service.getWithRates({ itemId: ITEM, companyId: COMPANY, branchId: BRANCH });
      expect(view.item).toMatchObject({ plainStock: false, leftOutReason: 'NOT_PLAIN_STOCK' });
      expect([view.units[0].costEditable, view.units[0].cardCost]).toEqual([false, 3100]);
    });

    it('404 LOOKUP_ITEM_NOT_FOUND for an item not there', async () => {
      costGateway.findItem.mockResolvedValue(null);
      expect(
        await refusalOf(
          service.getWithRates({ itemId: ITEM, companyId: COMPANY, branchId: BRANCH }),
        ),
      ).toMatchObject({ status: 404, codes: ['LOOKUP_ITEM_NOT_FOUND'] });
    });
  });
});
