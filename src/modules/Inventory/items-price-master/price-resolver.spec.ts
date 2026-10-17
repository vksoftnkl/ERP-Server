import { bucketKeyFor } from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import {
  HEADLINE_KEY,
  bucketKeyOfRow,
  livePriceRows,
  resolveEffectivePrice,
  type PriceRowScope,
} from './price-resolver';

const COMPANY = 'COMPANY-1';
const BRANCH = 'BRANCH-1';
const OTHER_BRANCH = 'BRANCH-2';
const TODAY = '2026-09-30';

type Row = PriceRowScope & { id: string };

const row = (id: string, overrides: Partial<Row> = {}): Row => ({
  id,
  ipmCompanyId: COMPANY,
  ipmBranchId: null,
  ipmKeyMrp: -1,
  ipmKeySp: -1,
  ipmEffectiveFrom: new Date('1900-01-01T00:00:00Z'),
  ipmEffectiveTo: new Date('9999-12-31T00:00:00Z'),
  ipmIsDeleted: false,
  ...overrides,
});

const at = { companyId: COMPANY, branchId: BRANCH };

describe('resolveEffectivePrice — one table, one resolver (plan §2)', () => {
  it('answers the headline as MASTER when there is no bucket row', () => {
    const answer = resolveEffectivePrice([row('H')], { mrp: 40, salePrice: null }, TODAY, at);
    expect(answer).toMatchObject({ row: { id: 'H' }, source: 'MASTER', scope: 'CHAIN' });
  });

  it('prefers the exact bucket over the headline', () => {
    const rows = [row('H'), row('B40', { ipmKeyMrp: '40.000000' })];
    expect(resolveEffectivePrice(rows, { mrp: 40, salePrice: null }, TODAY, at)).toMatchObject({
      row: { id: 'B40' },
      source: 'BUCKET',
    });
    expect(resolveEffectivePrice(rows, { mrp: 45, salePrice: null }, TODAY, at)).toMatchObject({
      row: { id: 'H' },
      source: 'MASTER',
    });
  });

  it('asking for the headline key is MASTER even though its row matches exactly', () => {
    expect(resolveEffectivePrice([row('H')], HEADLINE_KEY, TODAY, at)?.source).toBe('MASTER');
  });

  it('branch beats chain within a bucket; another branch reads the chain row', () => {
    const rows = [
      row('CHAIN40', { ipmKeyMrp: 40 }),
      row('BR40', { ipmKeyMrp: 40, ipmBranchId: BRANCH }),
      row('H'),
    ];
    expect(resolveEffectivePrice(rows, { mrp: 40, salePrice: null }, TODAY, at)).toMatchObject({
      row: { id: 'BR40' },
      scope: 'BRANCH',
    });
    expect(
      resolveEffectivePrice(rows, { mrp: 40, salePrice: null }, TODAY, {
        companyId: COMPANY,
        branchId: OTHER_BRANCH,
      }),
    ).toMatchObject({ row: { id: 'CHAIN40' }, scope: 'CHAIN' });
  });

  it('company beats shared once branch has tied', () => {
    const rows = [row('SHARED', { ipmCompanyId: null }), row('OWN')];
    expect(resolveEffectivePrice(rows, HEADLINE_KEY, TODAY, at)?.row.id).toBe('OWN');
  });

  it("never reads another branch's or another company's row", () => {
    const rows = [
      row('THEIRS', { ipmBranchId: OTHER_BRANCH }),
      row('OTHER-CO', { ipmCompanyId: 'COMPANY-2' }),
    ];
    expect(resolveEffectivePrice(rows, HEADLINE_KEY, TODAY, at)).toBeNull();
  });

  it('honours the effective window: a bucket dated from tomorrow is MASTER today', () => {
    const rows = [
      row('H'),
      row('B40', { ipmKeyMrp: 40, ipmEffectiveFrom: new Date('2026-10-01T00:00:00Z') }),
    ];
    expect(resolveEffectivePrice(rows, { mrp: 40, salePrice: null }, TODAY, at)?.source).toBe(
      'MASTER',
    );
    expect(
      resolveEffectivePrice(rows, { mrp: 40, salePrice: null }, '2026-10-01', at)?.source,
    ).toBe('BUCKET');
  });

  it('skips deleted rows and answers null when nothing is left', () => {
    expect(
      resolveEffectivePrice([row('H', { ipmIsDeleted: true })], HEADLINE_KEY, TODAY, at),
    ).toBeNull();
  });

  it('matches both dimensions: an MRP bucket does not answer a sale-price key', () => {
    const rows = [row('B40', { ipmKeyMrp: 40 }), row('SP38', { ipmKeySp: 38 })];
    expect(resolveEffectivePrice(rows, { mrp: null, salePrice: 38 }, TODAY, at)?.row.id).toBe(
      'SP38',
    );
    expect(resolveEffectivePrice(rows, { mrp: 40, salePrice: 38 }, TODAY, at)).toBeNull();
  });

  it('switches a scope half off when the caller gives none', () => {
    const rows = [row('THEIRS', { ipmBranchId: OTHER_BRANCH })];
    expect(livePriceRows(rows, TODAY, { companyId: COMPANY })).toHaveLength(1);
  });

  it('reads a stored key back as a bucket, the sentinel as none', () => {
    expect(bucketKeyOfRow({ ipmKeyMrp: '40.000000', ipmKeySp: '-1.000000' })).toEqual({
      mrp: 40,
      salePrice: null,
    });
  });
});

describe('bucketKeyFor — the lot rule, for prices', () => {
  it('keeps only what the policy tracks', () => {
    expect(
      bucketKeyFor({ trackMrp: true, trackSalePrice: false }, { mrp: 40, salePrice: 38 }),
    ).toEqual({
      mrp: 40,
      salePrice: null,
    });
    expect(
      bucketKeyFor({ trackMrp: false, trackSalePrice: true }, { mrp: 40, salePrice: 38 }),
    ).toEqual({
      mrp: null,
      salePrice: 38,
    });
  });

  it('an untracked item always asks for its headline, whatever MRP the bill typed', () => {
    expect(bucketKeyFor({ trackMrp: false, trackSalePrice: false }, { mrp: 40 })).toEqual(
      HEADLINE_KEY,
    );
    expect(bucketKeyFor(null, { mrp: 40 })).toEqual(HEADLINE_KEY);
  });

  it('treats 0 and negatives as no value — MRP 0 is a skip_mrp shop, not a bucket', () => {
    expect(
      bucketKeyFor({ trackMrp: true, trackSalePrice: true }, { mrp: 0, salePrice: -1 }),
    ).toEqual(HEADLINE_KEY);
  });
});
