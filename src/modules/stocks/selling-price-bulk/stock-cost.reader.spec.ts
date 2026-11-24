import { stockCostColumns } from './stock-cost.reader';

/** Review NIT 10 — the U2 / S7 rules live in SQL text; these pin the CASE they build. */
describe('stockCostColumns', () => {
  const sqlOf = (s: { strings: readonly string[] }) => s.strings.join('?');

  it('U2: a line keyed on an MRP takes only that MRP\'s lot cost — no fallback to the branch average', () => {
    const c = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'f', mrpKey: 'k.mrp > 0' });
    expect(sqlOf(c.rate)).toBe(
      'CASE WHEN COALESCE((k.mrp > 0), false) THEN NULLIF(mc.cost_rate, 0) * f ELSE NULLIF(sic.sic_avg_cost_rate, 0) * f END',
    );
    expect(sqlOf(c.basis)).toContain("THEN CASE WHEN NULLIF(mc.cost_rate, 0) IS NOT NULL THEN 'MRP' END");
    expect(sqlOf(c.rate)).not.toContain('COALESCE(NULLIF(mc');
  });

  it('S7: the `none` predicate comes first and gives NULL (an MRP item\'s "other MRPs" line)', () => {
    const c = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'f', mrpKey: 'k.mrp > 0', none: 'k.track AND k.mrp IS NULL' });
    for (const part of [c.rate, c.wot, c.basis]) {
      expect(sqlOf(part).startsWith('CASE WHEN COALESCE((k.track AND k.mrp IS NULL), false) THEN NULL WHEN')).toBe(true);
    }
  });

  it('without `none` the SQL has no NULL branch', () => {
    const c = stockCostColumns({ mc: 'mc', sic: 'sic', factor: 'f', mrpKey: 'k.mrp > 0' });
    expect(sqlOf(c.rate)).not.toMatch(/THEN NULL (WHEN|ELSE|END)/);
  });
});
