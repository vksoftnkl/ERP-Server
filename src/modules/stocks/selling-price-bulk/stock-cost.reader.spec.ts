import { stockCostColumns, stockCostWithGst } from './stock-cost.reader';

/** Review NIT 10 — the U2 / S7 rules live in SQL text; these pin the CASE they build. */
describe('stockCostColumns', () => {
  const sqlOf = (s: { strings: readonly string[] }) => s.strings.join('?');

  it('U2: a line keyed on an MRP takes only that MRP\'s lot cost — no fallback to the branch average', () => {
    const c = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'f', mrpKey: 'k.mrp > 0' });
    expect(sqlOf(c.wot)).toBe(
      'CASE WHEN COALESCE((k.mrp > 0), false) THEN NULLIF(mc.cost_rate_wot, 0) * f ELSE NULLIF(sic.sic_avg_cost_rate_wot, 0) * f END',
    );
    expect(sqlOf(c.basis)).toContain("THEN CASE WHEN NULLIF(mc.cost_rate_wot, 0) IS NOT NULL THEN 'MRP' END");
    expect(sqlOf(c.wot)).not.toContain('COALESCE(NULLIF(mc');
  });

  it('2026-11-27: the SQL answers the stock cost WITHOUT GST only — the stored cost_rate is not read', () => {
    const c = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'f', mrpKey: 'k.mrp > 0' });
    expect(Object.keys(c).sort()).toEqual(['basis', 'wot']);
    for (const part of [c.wot, c.basis]) {
      expect(sqlOf(part)).not.toMatch(/cost_rate(?!_wot)/);
    }
  });

  it('S7: the `none` predicate comes first and gives NULL (an MRP item\'s "other MRPs" line)', () => {
    const c = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'f', mrpKey: 'k.mrp > 0', none: 'k.track AND k.mrp IS NULL' });
    for (const part of [c.wot, c.basis]) {
      expect(sqlOf(part).startsWith('CASE WHEN COALESCE((k.track AND k.mrp IS NULL), false) THEN NULL WHEN')).toBe(true);
    }
  });

  it('without `none` the SQL has no NULL branch', () => {
    const c = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'f', mrpKey: 'k.mrp > 0' });
    expect(sqlOf(c.wot)).not.toMatch(/THEN NULL (WHEN|ELSE|END)/);
  });
});

/** CSP P2 follow-up (user "Go" 2026-11-27) — the ONE definition of the stock cost WITH GST. */
describe('stockCostWithGst', () => {
  it('is the without-GST stock cost × (1 + GST %), 6 decimals — decision 12, the line cost\'s rule', () => {
    // E1: OIL BOX 1,348.220004 w/o GST (112.351667 a PCS × 12), GST 5 %
    expect(stockCostWithGst(1348.220004, 5)).toBe(1415.631004);
    expect(stockCostWithGst('112.351667', 5)).toBe(117.96925);
    expect(stockCostWithGst(100, 18)).toBe(118);
    expect(stockCostWithGst(80, 0)).toBe(80);
  });

  it('no stock cost (null, 0 or below) is null', () => {
    expect(stockCostWithGst(null, 5)).toBeNull();
    expect(stockCostWithGst(undefined, 5)).toBeNull();
    expect(stockCostWithGst(0, 5)).toBeNull();
    expect(stockCostWithGst(-3, 5)).toBeNull();
  });
});
