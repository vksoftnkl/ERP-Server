import { Prisma } from '@prisma/client';
import type { SaveItemQtyPriceDto } from '../items-qty-price-master/dto/save-item-qty-price.dto';
import type { QtySlab } from '../items-qty-price-master/qty-slab.rules';
import {
  belowCostSeverity,
  cardProblems,
  cardRowOf,
  judgeSlabs,
  pricesAfter,
  scheduledFromOf,
  slabAfterSave,
  slabProblems,
  slabsToJudge,
  storedCardRowOf,
  unitCardAfter,
  type CardPriceRecord,
  type SentCardRow,
  type StoredCardRow,
  type StoredSlab,
} from './item-qty-rates.rules';

const d = (value: string | number) => new Prisma.Decimal(String(value));
const COMPANY = 'c0000000-0000-7000-8000-000000000001';
const BRANCH = 'b0000000-0000-7000-8000-000000000001';
const OTHER = 'b0000000-0000-7000-8000-000000000009';
const BOX = 'u0000000-0000-7000-8000-0000000000b0';
const PC = 'u0000000-0000-7000-8000-0000000000c0';
const TODAY = '2026-11-06';
const caller = { companyId: COMPANY, branchId: BRANCH };
const ctx = {
  activeLevels: [1, 2],
  levelNames: new Map([
    [1, 'Whole Sale'],
    [2, 'Retail'],
  ]),
};

const priceRow = (overrides: Partial<CardPriceRecord> = {}): CardPriceRecord => ({
  ipmId: 'IPM-H',
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
  ipmMinPrice: d(3300),
  ipmProfitType: 'By Rs',
  ipmRoundOff: d(1),
  ipmSalesPriceA: d(3600),
  ipmSalesPriceB: d(3760),
  ipmSalesPriceC: d(0),
  ipmSalesPriceD: d(0),
  ...overrides,
});

const stored = (overrides: Partial<StoredCardRow> = {}): StoredCardRow => ({
  ...storedCardRowOf(priceRow()),
  ...overrides,
});

const sentRow = (overrides: Partial<SentCardRow> = {}): SentCardRow => ({
  index: 0,
  lineNo: 1,
  uomId: BOX,
  unitName: 'BOX',
  key: { mrp: null, salePrice: null },
  levels: [],
  costPrice: null,
  maxPrice: null,
  minPrice: null,
  profitType: null,
  stored: stored(),
  ...overrides,
});

const qtySlab = (overrides: Partial<QtySlab> = {}): QtySlab => ({
  iqpId: 'S1',
  companyId: COMPANY,
  branchId: BRANCH,
  partyId: null,
  priceLevel: null,
  fromQty: d(10),
  toQty: null,
  priceMode: 'F',
  discPct: null,
  flatOff: null,
  price: d(3400),
  isTaxIncl: true,
  effectiveFrom: '2026-11-01',
  effectiveTo: null,
  isActive: true,
  modifiedOn: null,
  ...overrides,
});

describe('item-qty-rates.rules', () => {
  describe('cardRowOf', () => {
    it('stands on the headline in force today here, the branch row before the chain row', () => {
      const rows = [
        priceRow({ ipmId: 'CHAIN', ipmBranchId: null }),
        priceRow({ ipmId: 'BRANCH' }),
        priceRow({ ipmId: 'BUCKET', ipmKeyMrp: d(40), ipmSalesPriceA: d(38) }),
      ];
      expect(cardRowOf(rows, TODAY, caller)?.row.ipmId).toBe('BRANCH');
    });

    it('with no headline, stands on the dearest-MRP bucket', () => {
      const rows = [
        priceRow({ ipmId: 'M40', ipmKeyMrp: d(40) }),
        priceRow({ ipmId: 'M55', ipmKeyMrp: d(55) }),
      ];
      const answer = cardRowOf(rows, TODAY, caller);
      expect(answer?.row.ipmId).toBe('M55');
      expect(answer?.key).toEqual({ mrp: 55, salePrice: null });
      expect(cardRowOf([], TODAY, caller)).toBeNull();
    });
  });

  describe('scheduledFromOf', () => {
    it('is the first later day a row takes over, else null', () => {
      const today = priceRow({ ipmId: 'NOW', ipmEffectiveTo: new Date('2026-11-30T00:00:00Z') });
      const later = priceRow({
        ipmId: 'LATER',
        ipmEffectiveFrom: new Date('2026-12-01T00:00:00Z'),
      });
      // a later CHAIN row is shadowed by the branch row, so it does not take over
      const shadowed = priceRow({
        ipmId: 'SHADOW',
        ipmBranchId: null,
        ipmEffectiveFrom: new Date('2026-11-20T00:00:00Z'),
      });
      expect(
        scheduledFromOf([today, later, shadowed], { mrp: null, salePrice: null }, TODAY, caller),
      ).toBe('2026-12-01');
      expect(
        scheduledFromOf([priceRow()], { mrp: null, salePrice: null }, TODAY, caller),
      ).toBeNull();
    });
  });

  describe('pricesAfter', () => {
    it('takes the sent level over the stored one, the stored one for a level not sent', () => {
      const prices = pricesAfter({ levels: [{ level: 2, price: d(3921) }], stored: stored() });
      expect(prices.map((p) => p.toFixed())).toEqual(['3600', '3921', '0', '0']);
      expect(
        pricesAfter({ levels: [{ level: 1, price: d(5) }], stored: null }).map((p) => p.toFixed()),
      ).toEqual(['5', '0', '0', '0']);
    });
  });

  describe('cardProblems (§4.2 3.3 / 3.4)', () => {
    it('refuses a headline price above its MRP after the save — the typed MRP first', () => {
      const typed = cardProblems(
        [sentRow({ maxPrice: d(3700), levels: [{ level: 1, price: d(3757) }] })],
        ctx,
      );
      expect(typed).toEqual([
        expect.objectContaining({
          code: 'ITEM_QTY_PRICE_ABOVE_MRP',
          severity: 'REFUSE',
          level: 1,
          price: 3757,
        }),
        expect.objectContaining({ code: 'ITEM_QTY_PRICE_ABOVE_MRP', level: 2, price: 3760 }),
      ]);
      expect(typed[0].field).toBe('rates.rows.0.levels');
      // the stored MRP when none is typed; MRP 0 = none
      expect(cardProblems([sentRow({ levels: [{ level: 1, price: d(4700) }] })], ctx)).toHaveLength(
        1,
      );
      expect(
        cardProblems(
          [sentRow({ stored: stored({ maxPrice: d(0) }), levels: [{ level: 1, price: d(9999) }] })],
          ctx,
        ),
      ).toEqual([]);
    });

    it('does not judge a bucket row against a typed MRP (its MRP is the bucket key)', () => {
      expect(
        cardProblems(
          [
            sentRow({
              key: { mrp: 40, salePrice: null },
              maxPrice: d(1),
              levels: [{ level: 1, price: d(38) }],
            }),
          ],
          ctx,
        ),
      ).toEqual([]);
    });

    it('asks when a By User unit changed cost but kept every active price', () => {
      const byUser = stored({ profitType: 'By User' });
      const asked = cardProblems([sentRow({ stored: byUser, costPrice: d(3430) })], ctx);
      expect(asked).toEqual([
        expect.objectContaining({
          code: 'ITEM_QTY_PRICE_BY_USER_PRICES_KEPT',
          severity: 'ASK',
          cost: 3430,
        }),
      ]);
      // a new price, the same cost, or a rule that is not By User: no question
      expect(
        cardProblems(
          [sentRow({ stored: byUser, costPrice: d(3430), levels: [{ level: 1, price: d(3700) }] })],
          ctx,
        ),
      ).toEqual([]);
      expect(cardProblems([sentRow({ stored: byUser, costPrice: d(3270) })], ctx)).toEqual([]);
      expect(cardProblems([sentRow({ costPrice: d(3430) })], ctx)).toEqual([]);
      // the Rule sent decides, not the stored one
      expect(
        cardProblems([sentRow({ costPrice: d(3430), profitType: 'By User' })], ctx),
      ).toHaveLength(1);
    });
  });

  describe('unitCardAfter', () => {
    const base = {
      key: { mrp: null, salePrice: null },
      plainStock: true,
      costBasisRate: d(311),
      inclTax: true,
      taxPerc: d(18),
    };
    it("costs a Plain-stock card by the typed cost, else the row's own, never the stock average", () => {
      expect(unitCardAfter({ ...base, stored: stored(), sent: null }).cost.toFixed()).toBe('3270');
      expect(
        unitCardAfter({
          ...base,
          stored: stored(),
          sent: sentRow({ costPrice: d(3430) }),
        }).cost.toFixed(),
      ).toBe('3430');
      expect(unitCardAfter({ ...base, stored: null, sent: null }).cost.toFixed()).toBe('311');
    });

    it("costs any other item by price-bulk's cost basis (what Quick Rate shows)", () => {
      expect(
        unitCardAfter({ ...base, plainStock: false, stored: stored(), sent: null }).cost.toFixed(),
      ).toBe('311');
    });

    it('takes the MRP from the bucket key, else typed, else stored; Min sent else stored', () => {
      const card = unitCardAfter({
        ...base,
        stored: stored(),
        sent: sentRow({ maxPrice: d(4800), minPrice: d(3350) }),
      });
      expect([card.mrp.toFixed(), card.min.toFixed(), card.hasPriceRow]).toEqual([
        '4800',
        '3350',
        true,
      ]);
      const bucket = unitCardAfter({
        ...base,
        key: { mrp: 40, salePrice: null },
        stored: stored(),
        sent: null,
      });
      expect(bucket.mrp.toFixed()).toBe('40');
      expect(unitCardAfter({ ...base, stored: null, sent: null }).hasPriceRow).toBe(false);
    });
  });

  describe('slabAfterSave', () => {
    const dto = (overrides: Partial<SaveItemQtyPriceDto> = {}) =>
      ({
        iqp_item_id: 'ITEM',
        iqp_item_unit_id: PC,
        iqp_effective_from: '2026-11-06',
        ...overrides,
      }) as SaveItemQtyPriceDto;

    it('keeps the stored value of every field an update leaves out', () => {
      const old: StoredSlab = { uomId: PC, slab: qtySlab({ iqpId: 'S1', priceLevel: 2 }) };
      const after = slabAfterSave(dto({ iqp_id: 'S1', iqp_price: 3350 }), old);
      expect(after.slab.price?.toFixed()).toBe('3350');
      expect(after.slab).toMatchObject({
        priceLevel: 2,
        branchId: BRANCH,
        priceMode: 'F',
        effectiveFrom: '2026-11-06',
      });
      // an explicit null clears
      expect(
        slabAfterSave(dto({ iqp_id: 'S1', iqp_price_level: null }), old).slab.priceLevel,
      ).toBeNull();
    });

    it("gives a new slab the writer's defaults", () => {
      const after = slabAfterSave(dto({ iqp_disc_pct: 2 }), null);
      expect(after.slab).toMatchObject({
        priceMode: 'P',
        isTaxIncl: false,
        isActive: true,
        companyId: null,
      });
      expect(after.slab.fromQty.toFixed()).toBe('0');
    });
  });

  describe('slabsToJudge (C7)', () => {
    const storedSlabs: StoredSlab[] = [
      { uomId: BOX, slab: qtySlab({ iqpId: 'KEEP' }) },
      { uomId: BOX, slab: qtySlab({ iqpId: 'GONE' }) },
      { uomId: BOX, slab: qtySlab({ iqpId: 'ENDED', effectiveTo: '2026-11-05' }) },
      { uomId: BOX, slab: qtySlab({ iqpId: 'OFF', isActive: false }) },
      { uomId: BOX, slab: qtySlab({ iqpId: 'ELSEWHERE', branchId: OTHER }) },
      { uomId: BOX, slab: qtySlab({ iqpId: 'EDITED' }) },
    ];
    it('is stored + sent − deleted, active, in force today or later, visible here', () => {
      const judged = slabsToJudge({
        stored: storedSlabs,
        sent: [
          {
            iqp_id: 'EDITED',
            iqp_item_id: 'I',
            iqp_item_unit_id: BOX,
            iqp_effective_from: '2026-11-01',
            iqp_price: 3000,
          },
          {
            iqp_item_id: 'I',
            iqp_item_unit_id: PC,
            iqp_effective_from: '2026-11-06',
            iqp_branch_id: BRANCH,
            iqp_price_mode: 'F',
            iqp_price: 800,
          },
        ] as SaveItemQtyPriceDto[],
        deleteIds: ['GONE'],
        companyId: COMPANY,
        branchId: BRANCH,
        today: TODAY,
      });
      expect(judged.map((j) => [j.iqpId, j.slabIndex])).toEqual([
        ['KEEP', null],
        ['EDITED', 0],
        [null, 1],
      ]);
      expect(judged[1].slab.price?.toFixed()).toBe('3000');
    });
  });

  describe('slabProblems', () => {
    it('refuses zero / MRP / Min, and words below cost by the policy', () => {
      const card = unitCardAfter({
        stored: stored(),
        sent: null,
        key: { mrp: null, salePrice: null },
        plainStock: true,
        costBasisRate: d(0),
        inclTax: true,
        taxPerc: d(18),
      });
      const entries = [
        {
          slab: qtySlab({ iqpId: 'LOW', price: d(3300) }),
          uomId: BOX,
          slabIndex: null,
          iqpId: 'LOW',
        },
        { slab: qtySlab({ iqpId: '', price: d(3200) }), uomId: BOX, slabIndex: 2, iqpId: null },
      ];
      const judged = judgeSlabs(
        entries,
        new Map([[BOX, { card, unitName: 'BOX' }]]),
        [1, 2],
        card.basis,
      );
      const warn = slabProblems(judged, { ...ctx, policy: 'warning' });
      // Min 3300, cost 3270: 3300 each passes; 3200 each is under the Min at both active levels
      expect(warn.map((p) => [p.code, p.severity, p.level, p.field])).toEqual([
        ['ITEM_QTY_PRICE_BELOW_MIN', 'REFUSE', 1, 'slabs.2'],
        ['ITEM_QTY_PRICE_BELOW_MIN', 'REFUSE', 2, 'slabs.2'],
      ]);
      expect(warn[0].message).toBe(
        'Slab 3 · BOX 10 and more at Whole Sale: 3200.00 each is below the Min 3300.00.',
      );

      const cheap = judgeSlabs(
        [
          {
            slab: qtySlab({ priceLevel: 1, price: d(3301) }),
            uomId: BOX,
            slabIndex: null,
            iqpId: 'S9',
          },
        ],
        new Map([[BOX, { card: { ...card, cost: d(3400) }, unitName: 'BOX' }]]),
        [1, 2],
        card.basis,
      );
      expect(slabProblems(cheap, { ...ctx, policy: 'warning' })[0]).toMatchObject({
        code: 'ITEM_QTY_PRICE_BELOW_COST',
        severity: 'ASK',
        iqpId: 'S9',
        field: 'iqp_id',
        cost: 3400,
      });
      expect(slabProblems(cheap, { ...ctx, policy: 'restrict' })[0].severity).toBe('REFUSE');
      expect(slabProblems(cheap, { ...ctx, policy: 'allow' })[0].severity).toBe('INFO');
    });

    it('belowCostSeverity maps the three policy values', () => {
      expect([
        belowCostSeverity('restrict'),
        belowCostSeverity('warning'),
        belowCostSeverity('allow'),
      ]).toEqual(['REFUSE', 'ASK', 'INFO']);
    });
  });
});
