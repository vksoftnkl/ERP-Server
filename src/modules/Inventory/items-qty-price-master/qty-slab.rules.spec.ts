import { Prisma } from '@prisma/client';
import {
  APPLY_QTY_PRICES_SETTING_KEY,
  isApplyQtyPricesOn,
  isSellingSlabLevel,
  judgeSlab,
  pickSlab,
  qtySlabOf,
  rankSlabs,
  slabAppliesTo,
  slabHoldsQty,
  slabInForce,
  slabInForceOnOrAfter,
  slabLineRate,
  slabSpecificity,
  slabUnitPrice,
  slabsFor,
  toTaxBasis,
  type QtySlab,
  type SlabCard,
} from './qty-slab.rules';

/**
 * The shared slab rule (plan 2026-11-05 §7.2 / §4.4 / §4.2 step 3.5). The Qt
 * port (src/shared/pricing/qty_slab_rules) runs the same cases.
 */
const d = (value: string | number) => new Prisma.Decimal(String(value));
const COMPANY = 'c0000000-0000-7000-8000-000000000001';
const BRANCH = 'b0000000-0000-7000-8000-000000000001';
const OTHER = 'b0000000-0000-7000-8000-000000000009';
const PARTY = 'p0000000-0000-7000-8000-000000000001';

const slab = (overrides: Partial<QtySlab> = {}): QtySlab => ({
  iqpId: 'S1',
  companyId: null,
  branchId: null,
  partyId: null,
  priceLevel: null,
  fromQty: d(10),
  toQty: d(50),
  priceMode: 'P',
  discPct: d(2),
  flatOff: null,
  price: null,
  isTaxIncl: false,
  effectiveFrom: '2026-11-01',
  effectiveTo: null,
  isActive: true,
  modifiedOn: null,
  ...overrides,
});
const scope = {
  companyId: COMPANY,
  branchId: BRANCH,
  partyId: PARTY,
  priceLevel: 2,
  onDate: '2026-11-06',
};
const inclusive = { inclTax: true, taxPerc: d(18) };

describe('qty-slab.rules', () => {
  describe('isSellingSlabLevel (C6 / Q12)', () => {
    it('takes blank or an active level 1–4, never 5 / 6 / 7 or an inactive one', () => {
      expect(isSellingSlabLevel(null, [1, 2])).toBe(true);
      expect(isSellingSlabLevel(undefined, [])).toBe(true);
      expect(isSellingSlabLevel(2, [1, 2])).toBe(true);
      expect(isSellingSlabLevel(3, [1, 2])).toBe(false);
      for (const level of [5, 6, 7, 0]) {
        expect(isSellingSlabLevel(level, [1, 2, 3, 4, 5, 6, 7])).toBe(false);
      }
    });
  });

  describe('slabSpecificity (Q3)', () => {
    it('is 8 × party + 4 × level + 2 × branch + 1 × company', () => {
      expect(slabSpecificity(slab())).toBe(0);
      expect(slabSpecificity(slab({ companyId: COMPANY }))).toBe(1);
      expect(slabSpecificity(slab({ companyId: COMPANY, branchId: BRANCH }))).toBe(3);
      expect(slabSpecificity(slab({ priceLevel: 2 }))).toBe(4);
      expect(slabSpecificity(slab({ partyId: PARTY }))).toBe(8);
      expect(
        slabSpecificity(
          slab({ partyId: PARTY, priceLevel: 1, branchId: BRANCH, companyId: COMPANY }),
        ),
      ).toBe(15);
    });
  });

  describe('the date window', () => {
    it('is inclusive at both ends, an open end runs on', () => {
      const s = slab({ effectiveFrom: '2026-11-01', effectiveTo: '2026-11-30' });
      expect(slabInForce(s, '2026-10-31')).toBe(false);
      expect(slabInForce(s, '2026-11-01')).toBe(true);
      expect(slabInForce(s, '2026-11-30')).toBe(true);
      expect(slabInForce(s, '2026-12-01')).toBe(false);
      expect(slabInForce(slab(), '2099-01-01')).toBe(true);
      expect(slabInForceOnOrAfter(s, '2026-11-30')).toBe(true);
      expect(slabInForceOnOrAfter(s, '2026-12-01')).toBe(false);
    });
  });

  describe('slabAppliesTo (§4.4 filter)', () => {
    it("takes blank scope and the line's own, never another branch / party / level", () => {
      expect(slabAppliesTo(slab(), scope)).toBe(true);
      expect(
        slabAppliesTo(
          slab({ companyId: COMPANY, branchId: BRANCH, partyId: PARTY, priceLevel: 2 }),
          scope,
        ),
      ).toBe(true);
      expect(slabAppliesTo(slab({ branchId: OTHER }), scope)).toBe(false);
      expect(slabAppliesTo(slab({ partyId: 'someone else' }), scope)).toBe(false);
      expect(slabAppliesTo(slab({ priceLevel: 1 }), scope)).toBe(false);
    });

    it('without a customer, only party-blank slabs; without a company, only company-blank ones', () => {
      expect(slabAppliesTo(slab({ partyId: PARTY }), { ...scope, partyId: null })).toBe(false);
      expect(slabAppliesTo(slab({ companyId: COMPANY }), { ...scope, companyId: undefined })).toBe(
        false,
      );
      expect(slabAppliesTo(slab(), { ...scope, partyId: null, companyId: undefined })).toBe(true);
    });

    it('gives nothing to a line at level 5 / 6 / 7, and never applies a 5 / 6 / 7 slab', () => {
      expect(slabAppliesTo(slab(), { ...scope, priceLevel: 5 })).toBe(false);
      expect(slabAppliesTo(slab({ priceLevel: 5 }), { ...scope, priceLevel: 5 })).toBe(false);
      expect(slabAppliesTo(slab({ priceLevel: 7 }), { ...scope, priceLevel: 2 })).toBe(false);
    });

    it('needs the slab active and in force on the document date (Q6)', () => {
      expect(slabAppliesTo(slab({ isActive: false }), scope)).toBe(false);
      expect(slabAppliesTo(slab({ effectiveFrom: '2026-11-07' }), scope)).toBe(false);
      expect(
        slabAppliesTo(slab({ effectiveFrom: '2026-11-07' }), { ...scope, onDate: '2026-11-07' }),
      ).toBe(true);
      expect(slabAppliesTo(slab({ effectiveTo: '2026-11-05' }), scope)).toBe(false);
    });
  });

  describe('rankSlabs / slabsFor (C9)', () => {
    it('puts the most specific first: customer, then level, then branch, then company', () => {
      const ranked = slabsFor(
        [
          slab({ iqpId: 'company', companyId: COMPANY }),
          slab({ iqpId: 'all' }),
          slab({ iqpId: 'branch', branchId: BRANCH }),
          slab({ iqpId: 'level', priceLevel: 2 }),
          slab({ iqpId: 'party', partyId: PARTY }),
          slab({ iqpId: 'other branch', branchId: OTHER }),
        ],
        scope,
      );
      expect(ranked.map((s) => s.iqpId)).toEqual(['party', 'level', 'branch', 'company', 'all']);
    });

    it('then by from_qty, then the later start, then the later change, then the id', () => {
      const ranked = rankSlabs([
        slab({ iqpId: 'b', fromQty: d(50), toQty: null }),
        slab({ iqpId: 'a', fromQty: d(10) }),
        slab({ iqpId: 'old', fromQty: d(1), effectiveFrom: '2026-01-01' }),
        slab({ iqpId: 'new', fromQty: d(1), effectiveFrom: '2026-06-01' }),
        slab({
          iqpId: 'z-late',
          fromQty: d(1),
          effectiveFrom: '2026-01-01',
          modifiedOn: '2026-10-02T00:00:00Z',
        }),
      ]);
      expect(ranked.map((s) => s.iqpId)).toEqual(['new', 'z-late', 'old', 'a', 'b']);
    });
  });

  describe('slabHoldsQty / pickSlab (Q4 / Q11)', () => {
    it('holds from ≤ qty < to; to null is and above', () => {
      expect(slabHoldsQty(slab(), d(9.999))).toBe(false);
      expect(slabHoldsQty(slab(), d(10))).toBe(true);
      expect(slabHoldsQty(slab(), d(49.999))).toBe(true);
      expect(slabHoldsQty(slab(), d(50))).toBe(false);
      expect(slabHoldsQty(slab({ toQty: null }), d(1_000_000))).toBe(true);
    });

    it('takes the FIRST ranked slab whose range holds the qty', () => {
      const ranked = rankSlabs([
        slab({ iqpId: 'all 10–50' }),
        slab({ iqpId: 'all 50+', fromQty: d(50), toQty: null }),
        slab({ iqpId: 'party 20–30', partyId: PARTY, fromQty: d(20), toQty: d(30) }),
      ]);
      expect(pickSlab(ranked, d(9))).toBeNull();
      expect(pickSlab(ranked, d(10))?.iqpId).toBe('all 10–50');
      expect(pickSlab(ranked, d(25))?.iqpId).toBe('party 20–30');
      expect(pickSlab(ranked, d(50))?.iqpId).toBe('all 50+');
    });
  });

  describe('slabUnitPrice (§7.2 item 4)', () => {
    it('P = base × (1 − pct ÷ 100), half-up to 0.01', () => {
      expect(slabUnitPrice(d(986), slab({ discPct: d(2) }), inclusive)?.toFixed(2)).toBe('966.28');
      expect(slabUnitPrice(d('10.05'), slab({ discPct: d(50) }), inclusive)?.toFixed(2)).toBe(
        '5.03',
      );
    });

    // Review 2026-11-06: three figures the Qt port rounded differently. The
    // server is right — exact Decimal products, half-up at 0.01 — and the Qt
    // rule must give these same answers (qty_slab_rules).
    it.each([
      ['6245.541', '20.61', '4958.33'], // 4958.3349999 exact (a float shows …335)
      ['41.61', '11.764', '36.71'], // 36.7149996 exact
      ['2135.353', '90.51', '202.64'], // 202.6449997 exact
    ])('P on %s at %s%% off is %s (exact, then half-up)', (base, pct, each) => {
      expect(slabUnitPrice(d(base), slab({ discPct: d(pct) }), inclusive)?.toFixed(2)).toBe(each);
    });

    it('R = base − flat_off, F = price, each moved to the basis when the slab says otherwise', () => {
      const r = slab({ priceMode: 'R', discPct: null, flatOff: d(10) });
      expect(slabUnitPrice(d(118), r, { inclTax: false, taxPerc: d(18) })?.toFixed(2)).toBe(
        '108.00',
      );
      expect(slabUnitPrice(d(118), r, inclusive)?.toFixed(2)).toBe('106.20');
      const f = slab({ priceMode: 'F', discPct: null, price: d(118), isTaxIncl: true });
      expect(slabUnitPrice(d(0), f, inclusive)?.toFixed(2)).toBe('118.00');
      expect(slabUnitPrice(d(0), f, { inclTax: false, taxPerc: d(18) })?.toFixed(2)).toBe('100.00');
    });

    it('is null when the mode has no figure', () => {
      expect(slabUnitPrice(d(100), slab({ discPct: null }), inclusive)).toBeNull();
      expect(slabUnitPrice(d(100), slab({ priceMode: 'R', flatOff: null }), inclusive)).toBeNull();
      expect(slabUnitPrice(d(100), slab({ priceMode: 'F', price: null }), inclusive)).toBeNull();
    });

    it('toTaxBasis divides incl → excl and multiplies excl → incl', () => {
      expect(toTaxBasis(d(118), true, false, d(18)).toFixed(2)).toBe('100.00');
      expect(toTaxBasis(d(100), false, true, d(18)).toFixed(2)).toBe('118.00');
      expect(toTaxBasis(d(100), true, true, d(18)).toFixed(2)).toBe('100.00');
    });
  });

  describe('slabLineRate (C10)', () => {
    it('never raises a line: a Fixed slab above the base gives no rate', () => {
      const f = (price: number) =>
        slab({ priceMode: 'F', discPct: null, price: d(price), isTaxIncl: true });
      expect(slabLineRate(d(100), f(90), inclusive)?.toFixed(2)).toBe('90.00');
      expect(slabLineRate(d(100), f(100), inclusive)).toBeNull();
      expect(slabLineRate(d(100), f(120), inclusive)).toBeNull();
    });
  });

  describe('isApplyQtyPricesOn (D9)', () => {
    it('is On by default and off only for a false value', () => {
      expect(isApplyQtyPricesOn([])).toBe(true);
      expect(isApplyQtyPricesOn([{ asdKey: APPLY_QTY_PRICES_SETTING_KEY, value: null }])).toBe(
        true,
      );
      expect(isApplyQtyPricesOn([{ asdKey: APPLY_QTY_PRICES_SETTING_KEY, value: 'true' }])).toBe(
        true,
      );
      expect(isApplyQtyPricesOn([{ asdKey: APPLY_QTY_PRICES_SETTING_KEY, value: 'false' }])).toBe(
        false,
      );
      expect(isApplyQtyPricesOn([{ asdKey: APPLY_QTY_PRICES_SETTING_KEY, value: ' FALSE ' }])).toBe(
        false,
      );
      expect(isApplyQtyPricesOn([{ asdKey: 'sales.other', value: 'false' }])).toBe(true);
    });
  });

  describe('qtySlabOf', () => {
    it('reads a stored row: dates as YYYY-MM-DD, the mode upper-cased, decimals kept', () => {
      const s = qtySlabOf({
        iqpId: 'X',
        iqpCompanyId: COMPANY,
        iqpBranchId: null,
        iqpPartyId: null,
        iqpPriceLevel: 2,
        iqpFromQty: d('10.000'),
        iqpToQty: null,
        iqpPriceMode: 'f',
        iqpDiscPct: null,
        iqpFlatOff: null,
        iqpPrice: d('850.500'),
        iqpIsTaxIncl: true,
        iqpEffectiveFrom: new Date('2026-11-06T00:00:00.000Z'),
        iqpEffectiveTo: null,
        iqpIsActive: true,
        iqpModifiedOn: new Date('2026-11-06T06:00:00.000Z'),
      });
      expect(s).toMatchObject({
        priceMode: 'F',
        effectiveFrom: '2026-11-06',
        effectiveTo: null,
        priceLevel: 2,
      });
      expect(s.price?.toFixed(3)).toBe('850.500');
    });
  });

  describe('judgeSlab (§4.2 step 3.5)', () => {
    const card = (overrides: Partial<SlabCard> = {}): SlabCard => ({
      prices: [d(1000), d(986), d(0), d(0)],
      hasPriceRow: true,
      cost: d(900),
      mrp: d(1100),
      min: d(800),
      basis: inclusive,
      ...overrides,
    });
    const active = [1, 2, 3, 4];

    it('a blank-level slab is judged at every active level in use; a level slab at its own', () => {
      const s = slab({ discPct: d(10) });
      // 1000 → 900.00 (= cost, fine); 986 → 887.40 < 900
      expect(judgeSlab(s, card(), active)).toEqual([
        expect.objectContaining({ level: 2, verdict: 'BELOW_COST' }),
      ]);
      expect(judgeSlab(slab({ discPct: d(10), priceLevel: 1 }), card(), active)).toEqual([]);
      // an inactive level is not judged
      expect(judgeSlab(s, card(), [1])).toEqual([]);
    });

    it('zero or less, above MRP, below Min, below cost — one verdict per level, in that order', () => {
      const one = (s: QtySlab, c = card()) =>
        judgeSlab({ ...s, priceLevel: 1 }, c, active)[0]?.verdict;
      expect(one(slab({ priceMode: 'R', discPct: null, flatOff: d(1000), isTaxIncl: true }))).toBe(
        'ZERO_OR_LESS',
      );
      // a tax-exclusive Fixed 700 on a tax-inclusive card is 826 each: above the Min, below the cost
      expect(one(slab({ priceMode: 'F', discPct: null, price: d(700) }))).toBe('BELOW_COST');
      expect(one(slab({ priceMode: 'F', discPct: null, price: d(1200), isTaxIncl: true }))).toBe(
        'ABOVE_MRP',
      );
      expect(one(slab({ priceMode: 'F', discPct: null, price: d(700), isTaxIncl: true }))).toBe(
        'BELOW_MIN',
      );
      expect(one(slab({ priceMode: 'F', discPct: null, price: d(850), isTaxIncl: true }))).toBe(
        'BELOW_COST',
      );
      expect(
        one(slab({ priceMode: 'F', discPct: null, price: d(950), isTaxIncl: true })),
      ).toBeUndefined();
      // no MRP, no Min, no cost: only zero or less is left
      expect(
        one(
          slab({ priceMode: 'F', discPct: null, price: d(1) }),
          card({ mrp: d(0), min: d(0), cost: d(0) }),
        ),
      ).toBeUndefined();
    });

    it('a unit with no price row: P / R not judged, F against zero and the cost only', () => {
      const none = card({ hasPriceRow: false, prices: [d(0), d(0), d(0), d(0)] });
      expect(judgeSlab(slab(), none, active)).toEqual([]);
      expect(
        judgeSlab(slab({ priceMode: 'R', discPct: null, flatOff: d(5) }), none, active),
      ).toEqual([]);
      expect(
        judgeSlab(
          slab({ priceMode: 'F', discPct: null, price: d(700), isTaxIncl: true }),
          none,
          active,
        ).map((j) => j.verdict),
      ).toEqual(['BELOW_COST']);
      expect(
        judgeSlab(slab({ priceMode: 'F', discPct: null, price: d(0) }), none, active).map(
          (j) => j.verdict,
        ),
      ).toEqual(['ZERO_OR_LESS']);
    });

    // = Qt judgeNotSellingLevel (tests/qtyslab/test_qty_slab_rules.cpp): same inputs, same verdicts.
    it('a slab whose own level is not an active selling level is not judged at all (C-b)', () => {
      const f = (priceLevel: number) =>
        slab({ priceMode: 'F', discPct: null, price: d(500), isTaxIncl: true, priceLevel });
      // level 3, active [1, 2]: no bill applies it, nothing to judge
      expect(judgeSlab(f(3), card(), [1, 2])).toEqual([]);
      // an old row on level 7 (5 / 6 / 7 are never selling levels)
      expect(judgeSlab(f(7), card(), [1, 2, 3, 4])).toEqual([]);
      // the same slab on an active level is judged
      expect(judgeSlab(f(2), card(), [1, 2]).map((j) => j.verdict)).toEqual(['BELOW_MIN']);
    });

    it('a slab on a level that is not priced is not judged unless Fixed', () => {
      expect(judgeSlab(slab({ priceLevel: 3 }), card(), active)).toEqual([]);
      expect(
        judgeSlab(
          slab({ priceLevel: 3, priceMode: 'F', discPct: null, price: d(500), isTaxIncl: true }),
          card(),
          active,
        ).map((j) => j.verdict),
      ).toEqual(['BELOW_COST']);
    });
  });
});
