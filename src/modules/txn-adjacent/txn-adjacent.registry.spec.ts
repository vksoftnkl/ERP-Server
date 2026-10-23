import { TXN_DOC_REGISTRY, TXN_DOC_TYPES } from './txn-adjacent.registry';

/**
 * The registry's strings go into the walk's SQL through Prisma.raw. These
 * checks are what keep that safe: every identifier is a plain name, and the
 * fixed fragments use only the aliases the query defines.
 */
describe('TXN_DOC_REGISTRY', () => {
  const COLUMN = /^[a-z][a-z0-9_]*$/;
  const QUALIFIED = /^(h|vt)\.[a-z][a-z0-9_]*$/;

  it('has a spec for every docType and nothing else', () => {
    expect(Object.keys(TXN_DOC_REGISTRY).sort()).toEqual([...TXN_DOC_TYPES].sort());
  });

  it.each(TXN_DOC_TYPES)('%s names only plain identifiers', (docType) => {
    const spec = TXN_DOC_REGISTRY[docType];
    expect(spec.table).toMatch(/^[a-z]+\.[a-z][a-z0-9_]*$/);
    for (const column of [
      spec.id,
      spec.company,
      spec.branch,
      spec.year,
      spec.date,
      spec.slno,
      spec.createdOn,
      spec.status,
      spec.deleted,
      spec.refno,
    ]) {
      expect(column).toMatch(COLUMN);
    }
    expect(spec.type).toMatch(QUALIFIED);
    expect(spec.statuses.length).toBeGreaterThan(0);
  });

  it.each(TXN_DOC_TYPES)('%s reads `vt.` only through its own voucher-types join', (docType) => {
    const spec = TXN_DOC_REGISTRY[docType];
    const usesVt =
      [spec.type, spec.where ?? ''].some((s) => s.includes('vt.')) || spec.menu === 'VOUCHER_TYPE';
    if (usesVt) {
      expect(spec.join).toBe(
        'JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id',
      );
    } else {
      expect(spec.join).toBeUndefined();
    }
  });

  it('keeps the stock types apart: no voucher type walks under two stock docTypes', () => {
    const stock = TXN_DOC_TYPES.filter((t) => TXN_DOC_REGISTRY[t].table === 'stock.stock_voucher');
    const types = stock.flatMap((t) => TXN_DOC_REGISTRY[t].types ?? []);
    expect(new Set(types).size).toBe(types.length);
    expect(stock.every((t) => TXN_DOC_REGISTRY[t].types?.length)).toBe(true);
  });

  it('puts drafts where each list draws them', () => {
    expect(TXN_DOC_REGISTRY.SALE_BILL.draftSlno).toBe('HIGH');
    expect(TXN_DOC_REGISTRY.RECEIPT.draftSlno).toBe('HIGH');
    expect(TXN_DOC_REGISTRY.PAYMENT.draftSlno).toBe('HIGH');
    expect(TXN_DOC_REGISTRY.VOUCHER.draftSlno).toBe('LOW');
  });
});
