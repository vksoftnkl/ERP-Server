import { Prisma } from '@prisma/client';
import { coreCtes, draftsSql, leglessSql, numberGapsSql, typeFilterSql } from './day-summary.sql';

/** Voucher Types plan §7.5 (VT-37): a filter on a base type takes its child types. */
describe('typeFilterSql', () => {
  it('matches the type itself or a child of it, and everything when unfiltered', () => {
    const sql = typeFilterSql({ voucherTypeId: 3 }, Prisma.raw('k.vt'));

    expect(sql.sql).toContain('IS NULL OR k.vt = ?::int');
    expect(sql.sql).toContain(
      'k.vt IN (SELECT vt_c.vchr_type_id FROM accounts.acc_voucher_types vt_c',
    );
    expect(sql.sql).toContain('vt_c.vchr_parent_id = ?::int');
    expect(sql.values).toEqual([3, 3, 3]);
  });

  it('is what every type filter of the shared SQL uses', () => {
    const scope = {
      companyId: 'c',
      accYear: '2026-2027',
      branchId: null,
      from: '2026-11-15',
      to: '2026-11-15',
      voucherTypeId: 3,
    };
    for (const sql of [
      coreCtes(scope, 'RANGE'),
      draftsSql(scope),
      leglessSql(scope),
      numberGapsSql(scope),
    ]) {
      expect(sql.sql).toContain('vchr_parent_id');
    }
  });
});
