import { Prisma } from '@prisma/client';
import {
  blockingNotes,
  countsOf,
  dec,
  exclusiveOfTax,
  isOverridden,
  leftOutReasonOf,
  leftOutReasonText,
  levelFigures,
  money,
  planRow,
  tickedReason,
  TOKEN_IGNORED_COLUMNS,
  trackedAsOf,
  unitLink,
  type RowContext,
  type RowRequest,
  type StoredPriceRow,
} from './cost-price-bulk.rules';
import { COST_BULK } from './types/cost-price-bulk.types';

const IPM_ID = '01a1abba-7339-7d45-83ff-9e3f045d7211';
const ITEM_ID = '01a1abba-72ee-7601-878c-1e9df6107e7d';
const d = (value: string | number) => new Prisma.Decimal(value);

const stored = (overrides: Partial<StoredPriceRow> = {}): StoredPriceRow => ({
  ipmId: IPM_ID,
  itemId: ITEM_ID,
  itemCode: 'FORRB1',
  itemName: 'Fortune Rice Bran Oil 1L',
  unitName: 'PKT',
  usable: true,
  current: true,
  eligibility: { isActive: true, isBatchBased: false, presetTracks: false },
  isChain: false,
  companyShared: false,
  rowToken: 'token-1',
  costPrice: d(140),
  maxPrice: d(185),
  minPrice: d(150),
  profitType: 'By %',
  prices: [d(154), d(168), d(161), d(175)],
  ...overrides,
});

const request = (overrides: Partial<RowRequest> = {}): RowRequest => ({
  index: 5,
  lineNo: 6,
  ipmId: IPM_ID,
  rowToken: 'token-1',
  costPrice: d(152),
  ...overrides,
});

const ctx = (overrides: Partial<RowContext> = {}): RowContext => ({
  taxPerc: d(5),
  isHq: false,
  belowCostPolicy: 'warning',
  levelNames: ['Whole Sale', 'Retail', 'Bulk W.S.', 'Hotel'],
  levelActive: [true, true, true, true],
  actor: '01000000-0000-7000-8000-0000000000a1',
  ...overrides,
});

/** The mockup's row 6: cost 140 → 152, New MRP 199, prices 167.50 · 182.50 · 175 · 190. */
const row6Levels = [
  { level: 1, price: d('167.5') },
  { level: 2, price: d('182.5') },
  { level: 3, price: d(175) },
  { level: 4, price: d(190) },
];

describe('Cost Price – Bulk Change rules', () => {
  describe('eligibility (Plain stock)', () => {
    it.each([
      [{ isActive: true, isBatchBased: false, presetTracks: false }, null],
      [{ isActive: false, isBatchBased: false, presetTracks: false }, 'INACTIVE'],
      [{ isActive: false, isBatchBased: true, presetTracks: true }, 'INACTIVE'],
      [{ isActive: true, isBatchBased: false, presetTracks: true }, 'NOT_PLAIN_STOCK'],
      [{ isActive: true, isBatchBased: true, presetTracks: true }, 'NOT_PLAIN_STOCK'],
      [{ isActive: true, isBatchBased: true, presetTracks: false }, 'OLD_BATCH_TICK'],
    ])('%j → %s', (flags, reason) => {
      expect(leftOutReasonOf(flags)).toBe(reason);
    });

    it('names the preset, or Plain stock when there is none', () => {
      expect(trackedAsOf('Batch + expiry + MRP (supermarket)')).toBe(
        'Batch + expiry + MRP (supermarket)',
      );
      expect(trackedAsOf(null)).toBe('Plain stock');
      expect(trackedAsOf('  ')).toBe('Plain stock');
      expect(leftOutReasonText('NOT_PLAIN_STOCK', 'Serial number')).toContain(
        'Tracked as Serial number',
      );
      expect(leftOutReasonText('OLD_BATCH_TICK', 'Plain stock')).toContain('treated as batch');
      expect(leftOutReasonText('NO_PRICE_ROW', 'Plain stock')).toContain('item card');
    });
  });

  describe('child units', () => {
    it('the top unit has no parent', () => {
      expect(unitLink({ parentToBase: null, toBase: d(144), unitFactor: d(1) })).toEqual({
        unitsPerParent: null,
        factorsAgree: true,
      });
    });

    it('the keyed step when the to-base ratio agrees (exact 12, not 12.00048)', () => {
      const link = unitLink({ parentToBase: d('0.1'), toBase: d('0.008333'), unitFactor: d(12) });
      expect(link.factorsAgree).toBe(true);
      expect(link.unitsPerParent!.toString()).toBe('12');
      expect(
        unitLink({
          parentToBase: d(144),
          toBase: d(12),
          unitFactor: d(12),
        }).unitsPerParent!.toNumber(),
      ).toBe(12);
    });

    it('a relative tolerance: the live "undskndk" DZ / Kilogram pair (112.0067 vs 112) agrees', () => {
      const kilo = unitLink({
        parentToBase: d('0.083333'),
        toBase: d('0.000744'),
        unitFactor: d(112),
      });
      expect(kilo.factorsAgree).toBe(true);
      expect(kilo.unitsPerParent!.toString()).toBe('112');
      const dz = unitLink({ parentToBase: d(1), toBase: d('0.083333'), unitFactor: d(12) });
      expect(dz).toEqual({ unitsPerParent: d(12), factorsAgree: true });
      // just past 1e-4 of the keyed step: the ratio, flagged
      const off = unitLink({ parentToBase: d('112.02'), toBase: d(1), unitFactor: d(112) });
      expect(off).toEqual({ unitsPerParent: d('112.02'), factorsAgree: false });
    });

    it('the ratio, flagged, when the keyed step disagrees', () => {
      const link = unitLink({ parentToBase: d(120), toBase: d(1), unitFactor: d(12) });
      expect(link).toEqual({ unitsPerParent: d(120), factorsAgree: false });
    });

    it('a zero to-base has no answer', () => {
      expect(unitLink({ parentToBase: d(12), toBase: d(0), unitFactor: d(12) })).toEqual({
        unitsPerParent: null,
        factorsAgree: false,
      });
    });
  });

  describe('the figures a level stores (price wins)', () => {
    it('w/o tax and markup from the price and the NEW cost, 6 dp', () => {
      const figures = levelFigures(d('167.5'), d(5), d(152));
      expect(figures.price.toString()).toBe('167.5');
      expect(figures.priceWot.toString()).toBe('159.52381');
      expect(figures.markupPerc.toString()).toBe('10.197368');
    });

    it('a level priced 0 is not in use: 0 / 0 / 0, never −100 %', () => {
      expect(levelFigures(d(0), d(5), d(152))).toEqual({
        price: d(0),
        priceWot: d(0),
        markupPerc: d(0),
      });
    });

    it('an unknown cost gives markup 0, never Infinity', () => {
      expect(levelFigures(d(10), d(0), d(0)).markupPerc.toNumber()).toBe(0);
    });

    it('cost w/o tax; a −100 % tax leaves the figure as it is', () => {
      expect(exclusiveOfTax(d(152), d(5)).toString()).toBe('144.761905');
      expect(exclusiveOfTax(d(152), d(-100)).toString()).toBe('152');
    });

    it('money keeps every decimal it has, at least two', () => {
      expect(money(d(140))).toBe('140.00');
      expect(money(d('12.125'))).toBe('12.125');
      expect(dec(250.1).toString()).toBe('250.1');
    });
  });

  it('the token ignores exactly what the Price Change Log ignores', () => {
    expect(TOKEN_IGNORED_COLUMNS).toEqual(
      expect.arrayContaining([
        'ipm_updated_on',
        'ipm_updated_by',
        'ipm_sync_date',
        'ipm_key_mrp',
        'ipm_key_sp',
      ]),
    );
    expect(TOKEN_IGNORED_COLUMNS).not.toContain('ipm_cost_price');
    expect(TOKEN_IGNORED_COLUMNS).not.toContain('ipm_effective_to');
  });

  describe('planRow — the row itself', () => {
    it.each([
      ['not there', null, COST_BULK.ROW_NOT_CURRENT],
      ['not usable', stored({ usable: false }), COST_BULK.ROW_NOT_CURRENT],
      [
        'inactive',
        stored({ eligibility: { isActive: false, isBatchBased: false, presetTracks: false } }),
        COST_BULK.INACTIVE,
      ],
      [
        'tracked',
        stored({ eligibility: { isActive: true, isBatchBased: false, presetTracks: true } }),
        COST_BULK.NOT_PLAIN_STOCK,
      ],
      [
        'batch tick',
        stored({ eligibility: { isActive: true, isBatchBased: true, presetTracks: false } }),
        COST_BULK.NOT_PLAIN_STOCK,
      ],
      ['overridden / ended', stored({ current: false }), COST_BULK.ROW_NOT_CURRENT],
      ['changed since load', stored({ rowToken: 'token-2' }), COST_BULK.ROW_CHANGED],
    ])('%s → one refusal and nothing else', (_name, row, code) => {
      const plan = planRow(request({ levels: row6Levels }), row, ctx());
      expect(plan.refusals.map((n) => n.code)).toEqual([code]);
      expect(plan.warnings).toEqual([]);
      expect(plan.write).toBeNull();
      expect(plan.refusals[0]).toMatchObject({
        level: 'REFUSE',
        line: 6,
        ipmId: IPM_ID,
        overridable: false,
      });
      expect(plan.refusals[0].field.startsWith('rows.5.')).toBe(true);
    });

    it('a row equal to what is stored is unchanged: no notes, no write', () => {
      const plan = planRow(
        request({ costPrice: d(140), mrp: d(185), levels: [{ level: 1, price: d(154) }] }),
        stored(),
        ctx(),
      );
      expect(plan).toMatchObject({ changed: false, refusals: [], warnings: [], write: null });
    });
  });

  describe('planRow — the checks of a changed row', () => {
    it("the mockup's row 6 saves clean, and the write is price-wins against the new cost", () => {
      const plan = planRow(request({ mrp: d(199), levels: row6Levels }), stored(), ctx());
      expect(plan.refusals).toEqual([]);
      expect(plan.warnings).toEqual([]);
      expect(plan.changed).toBe(true);
      const write = plan.write!;
      expect(write.costPrice.toString()).toBe('152');
      expect(write.costWot.toString()).toBe('144.761905');
      expect(write.maxPrice.toString()).toBe('199');
      expect(write.minPrice.toString()).toBe('150');
      // the rule is kept unless sent
      expect(write.profitType).toBe('By %');
      expect(write.levels.map((l) => l.price.toString())).toEqual(['167.5', '182.5', '175', '190']);
      expect(write.levels.map((l) => l.priceWot.toString())).toEqual([
        '159.52381',
        '173.809524',
        '166.666667',
        '180.952381',
      ]);
      expect(write.levels[3].markupPerc.toString()).toBe('25');
      expect(write).not.toHaveProperty('roundOff');
    });

    it('a level not sent keeps its stored price; its markup is recomputed against the new cost', () => {
      const plan = planRow(request({ levels: [{ level: 1, price: d(160) }] }), stored(), ctx());
      expect(plan.write!.levels.map((l) => l.price.toNumber())).toEqual([160, 168, 161, 175]);
      expect(plan.write!.levels[1].markupPerc.toString()).toBe('10.526316');
    });

    it('a sent rule is saved', () => {
      const plan = planRow(request({ profitType: 'By Rs', levels: row6Levels }), stored(), ctx());
      expect(plan.write!.profitType).toBe('By Rs');
    });

    it('above the NEW MRP refuses, naming every level; MRP 0 is no MRP', () => {
      const plan = planRow(request({ mrp: d(180), levels: row6Levels }), stored(), ctx());
      expect(plan.refusals.map((n) => n.code)).toEqual([COST_BULK.ABOVE_MRP]);
      expect(plan.refusals[0].message).toBe(
        'Line 6 · FORRB1 Fortune Rice Bran Oil 1L · PKT: Retail 182.50, Hotel 190.00 are above the MRP 180.00.',
      );
      expect(planRow(request({ mrp: d(0), levels: row6Levels }), stored(), ctx()).refusals).toEqual(
        [],
      );
    });

    it('below the Min refuses (the new Min when sent)', () => {
      const plan = planRow(
        request({ minPrice: d(170), mrp: d(199), levels: row6Levels }),
        stored(),
        ctx(),
      );
      expect(plan.refusals.map((n) => n.code)).toEqual([COST_BULK.BELOW_MIN]);
      expect(plan.refusals[0].message).toContain('Whole Sale 167.50 is below the Min 170.00');
    });

    it('below the new cost follows inventory.below_cost_price', () => {
      const cheap = request({ costPrice: d(170), mrp: d(199), minPrice: d(0), levels: row6Levels });
      const warning = planRow(cheap, stored(), ctx({ belowCostPolicy: 'warning' }));
      expect(warning.refusals).toEqual([]);
      expect(warning.warnings).toEqual([
        expect.objectContaining({
          code: COST_BULK.BELOW_COST,
          level: 'WARN',
          overridable: true,
          line: 6,
        }),
      ]);
      expect(warning.write).not.toBeNull();

      const restrict = planRow(cheap, stored(), ctx({ belowCostPolicy: 'restrict' }));
      expect(restrict.refusals).toEqual([
        expect.objectContaining({
          code: COST_BULK.BELOW_COST,
          level: 'REFUSE',
          overridable: false,
        }),
      ]);
      expect(restrict.warnings).toEqual([]);

      const allow = planRow(cheap, stored(), ctx({ belowCostPolicy: 'allow' }));
      expect(allow.refusals).toEqual([]);
      expect(allow.warnings).toEqual([]);
    });

    it('levels priced 0 are not checked', () => {
      const plan = planRow(
        request({
          levels: [
            { level: 3, price: d(0) },
            { level: 4, price: d(0) },
          ],
        }),
        stored({ minPrice: d(150) }),
        ctx({ belowCostPolicy: 'restrict' }),
      );
      expect(plan.refusals).toEqual([]);
    });

    it('inactive levels are never judged; they keep their stored price, wot and markup still recomputed', () => {
      const hidden = ctx({ levelActive: [true, true, false, false] });
      // Hotel 190 above the new MRP 180 and Bulk W.S. 175: only the active Retail 182.50 is refused
      const plan = planRow(request({ mrp: d(180), levels: row6Levels }), stored(), hidden);
      expect(plan.refusals.map((n) => n.message)).toEqual([
        'Line 6 · FORRB1 Fortune Rice Bran Oil 1L · PKT: Retail 182.50 is above the MRP 180.00.',
      ]);
      // an inactive level stored below the new cost (and the Min) blocks nothing
      const low = stored({
        prices: [d(170), d(180), d(5), d(0)],
        minPrice: d(150),
        maxPrice: d(185),
      });
      const kept = planRow(
        request({ costPrice: d(152) }),
        low,
        ctx({ levelActive: [true, true, false, false], belowCostPolicy: 'restrict' }),
      );
      expect(kept.refusals).toEqual([]);
      expect(kept.warnings).toEqual([]);
      expect(kept.write!.levels[2].price.toString()).toBe('5');
      expect(kept.write!.levels[2].markupPerc.toString()).toBe('-96.710526');
    });

    it('By User: only the active levels count as "prices kept"', () => {
      const byUser = stored({ profitType: 'By User', minPrice: d(0), maxPrice: d(0) });
      const plan = planRow(
        request({ costPrice: d(141), levels: [{ level: 4, price: d(176) }] }),
        byUser,
        ctx({ levelActive: [true, true, true, false], belowCostPolicy: 'allow' }),
      );
      expect(plan.warnings.map((n) => n.code)).toEqual([COST_BULK.BY_USER_PRICES_KEPT]);
    });

    it('a markup the numeric(9,3) column cannot hold refuses COST_BULK_COST_TOO_LOW', () => {
      const tiny = planRow(
        request({ costPrice: d('0.01'), minPrice: d(0) }),
        stored({ minPrice: d(0) }),
        ctx({ belowCostPolicy: 'allow' }),
      );
      expect(tiny.refusals.map((n) => n.code)).toEqual([COST_BULK.COST_TOO_LOW]);
      expect(tiny.refusals[0]).toMatchObject({
        field: 'rows.5.costPrice',
        level: 'REFUSE',
        overridable: false,
      });
      expect(tiny.refusals[0].message).toContain(
        'the new cost 0.01 is too low for Whole Sale 154.00',
      );
      // every level is written, so an inactive one counts here too
      const hidden = planRow(
        request({ costPrice: d('0.02'), minPrice: d(0) }),
        stored({ minPrice: d(0), prices: [d(0), d(0), d(250), d(0)] }),
        ctx({ levelActive: [true, true, false, false], belowCostPolicy: 'allow' }),
      );
      expect(hidden.refusals.map((n) => n.code)).toEqual([COST_BULK.COST_TOO_LOW]);
      // the largest markup the column holds is fine: 999,999.999 %
      const edge = planRow(
        request({
          costPrice: d(1),
          minPrice: d(0),
          mrp: d(0),
          levels: [
            { level: 1, price: d('10000.99999') },
            { level: 2, price: d(1) },
            { level: 3, price: d(1) },
            { level: 4, price: d(1) },
          ],
        }),
        stored({ minPrice: d(0) }),
        ctx({ belowCostPolicy: 'allow' }),
      );
      expect(edge.refusals).toEqual([]);
      expect(edge.write!.levels[0].markupPerc.toString()).toBe('999999.999');
    });

    it('a company-shared row is written as a company copy', () => {
      expect(
        planRow(
          request({ levels: row6Levels, mrp: d(199) }),
          stored({ companyShared: true }),
          ctx(),
        ).companyCopy,
      ).toBe(true);
      expect(
        planRow(request({ levels: row6Levels, mrp: d(199) }), stored(), ctx()).companyCopy,
      ).toBe(false);
    });

    it('an all-branches row needs HQ', () => {
      const changed = request({ mrp: d(199), levels: row6Levels });
      expect(
        planRow(changed, stored({ isChain: true }), ctx({ isHq: false })).refusals.map(
          (n) => n.code,
        ),
      ).toEqual([COST_BULK.CHAIN_NEEDS_HQ]);
      expect(planRow(changed, stored({ isChain: true }), ctx({ isHq: true })).refusals).toEqual([]);
      expect(planRow(changed, stored({ isChain: false }), ctx({ isHq: false })).refusals).toEqual(
        [],
      );
    });

    it('a By User row whose cost changed but whose prices did not warns', () => {
      const byUser = stored({
        profitType: 'By User',
        costPrice: d(19.5),
        prices: [d(22), d(24), d('21.5'), d('20.5')],
        minPrice: d(0),
        maxPrice: d(28),
      });
      const kept = planRow(
        request({ costPrice: d(21) }),
        byUser,
        ctx({ belowCostPolicy: 'allow' }),
      );
      expect(kept.warnings.map((n) => n.code)).toEqual([COST_BULK.BY_USER_PRICES_KEPT]);
      expect(kept.warnings[0].message).toContain('from 19.50 to 21.00');

      const typed = planRow(
        request({ costPrice: d(21), levels: [{ level: 1, price: d(23) }] }),
        byUser,
        ctx({ belowCostPolicy: 'allow' }),
      );
      expect(typed.warnings).toEqual([]);

      // a By % row with the same figures is repriced by its rule: no warning
      const byPercent = planRow(
        request({ costPrice: d(21) }),
        { ...byUser, profitType: 'By %' },
        ctx({ belowCostPolicy: 'allow' }),
      );
      expect(byPercent.warnings).toEqual([]);
    });
  });

  describe('overrides', () => {
    const plans = () => [
      planRow(
        request({ costPrice: d(170), mrp: d(199), minPrice: d(0), levels: row6Levels }),
        stored(),
        ctx(),
      ),
      planRow(request({ lineNo: 7, index: 6, costPrice: d(140), mrp: d(185) }), stored(), ctx()),
    ];

    it('a tick for the line, or for every line of the code, clears a warning', () => {
      const [warned] = plans();
      const note = warned.warnings[0];
      expect(isOverridden(note, [{ code: COST_BULK.BELOW_COST, line: 6 }])).toBe(true);
      expect(isOverridden(note, [{ code: COST_BULK.BELOW_COST }])).toBe(true);
      expect(isOverridden(note, [{ code: COST_BULK.BELOW_COST, line: null }])).toBe(true);
      expect(isOverridden(note, [{ code: COST_BULK.BELOW_COST, line: 7 }])).toBe(false);
      expect(isOverridden(note, [{ code: COST_BULK.BY_USER_PRICES_KEPT, line: 6 }])).toBe(false);
    });

    it('a refusal can never be ticked', () => {
      const restricted = planRow(
        request({ costPrice: d(170), mrp: d(199), minPrice: d(0), levels: row6Levels }),
        stored(),
        ctx({ belowCostPolicy: 'restrict' }),
      );
      expect(blockingNotes([restricted], [{ code: COST_BULK.BELOW_COST }])).toHaveLength(1);
    });

    it('blocking = refusals + un-ticked warnings; counts; the log reason', () => {
      const all = plans();
      expect(blockingNotes(all, []).map((n) => n.code)).toEqual([COST_BULK.BELOW_COST]);
      expect(blockingNotes(all, [{ code: COST_BULK.BELOW_COST, line: 6 }])).toEqual([]);
      expect(countsOf(all)).toEqual({ rows: 2, changed: 1, unchanged: 1, refused: 0, warned: 1 });
      expect(tickedReason(all[0])).toMatch(
        /^Warnings ticked at save: COST_BULK_BELOW_COST \(Line 6/,
      );
      expect(tickedReason(all[1])).toBeNull();
    });
  });
});
