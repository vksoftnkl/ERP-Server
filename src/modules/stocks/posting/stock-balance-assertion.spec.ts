import { Prisma } from '@prisma/client';
import { assertStockBalances, type StockBalanceFinding } from './stock-balance-assertion';

const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const BRANCH_ID = '33333333-3333-4333-8333-333333333333';
const ITEM_ID = '44444444-4444-4444-8444-444444444444';

const FINDING: StockBalanceFinding = {
  kind: 'BALANCE_QTY',
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  itemId: ITEM_ID,
  lotId: 'lot-1',
  godownId: 'godown-1',
  bucket: 'SALEABLE',
  stored: '10.000000',
  derived: '9.000000',
};

const clientReturning = (rows: StockBalanceFinding[]) => {
  const $queryRaw = jest.fn().mockResolvedValue(rows);
  return {
    client: { $queryRaw } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>,
    $queryRaw,
  };
};

const sqlOf = ($queryRaw: jest.Mock) =>
  ($queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');

describe('assertStockBalances', () => {
  it('reads once and hands the findings back as they came — detect, never fix', async () => {
    const { client, $queryRaw } = clientReturning([FINDING]);

    await expect(assertStockBalances(client)).resolves.toEqual([FINDING]);
    expect($queryRaw).toHaveBeenCalledTimes(1);
    expect(sqlOf($queryRaw)).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/);
  });

  it('runs over the whole book when no scope is given', async () => {
    const { client, $queryRaw } = clientReturning([]);

    await assertStockBalances(client);

    // company, branch, item for the scope row, then the branch again for LOT_TOTAL.
    expect($queryRaw.mock.calls[0].slice(1)).toEqual([null, null, null, null]);
  });

  it('binds the scope it is given', async () => {
    const { client, $queryRaw } = clientReturning([]);

    await assertStockBalances(client, {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      itemId: ITEM_ID,
    });

    expect($queryRaw.mock.calls[0].slice(1)).toEqual([COMPANY_ID, BRANCH_ID, ITEM_ID, BRANCH_ID]);
  });

  it('treats an explicit null scope like an absent one', async () => {
    const { client, $queryRaw } = clientReturning([]);

    await assertStockBalances(client, { companyId: null, branchId: null, itemId: COMPANY_ID });

    expect($queryRaw.mock.calls[0].slice(1)).toEqual([null, null, COMPANY_ID, null]);
  });

  it('checks every derived figure the contract names', async () => {
    const { client, $queryRaw } = clientReturning([]);

    await assertStockBalances(client);

    const sql = sqlOf($queryRaw);
    for (const kind of [
      'BALANCE_QTY',
      'BALANCE_ORPHAN',
      'ITEM_COST_QTY',
      'ITEM_COST_VALUE',
      'RESERVED',
      'TRANSIT_IN',
      'LOT_TOTAL',
    ]) {
      expect(sql).toContain(`'${kind}'`);
    }
    // Only live ledger rows count, and a lot's chain-wide total is compared only
    // when the scope is not narrowed to one branch.
    expect(sql).toContain('sml.sml_is_deleted = false');
    expect(sql).toMatch(/\?::uuid IS NULL\s+AND slt\.slt_total_on_hand <> COALESCE\(t\.qty, 0\)/);
    // Open reservations and transit still in flight are the sources of truth.
    expect(sql).toContain("x.srv_status IN ('OPEN', 'PARTIAL')");
    expect(sql).toContain("x.stt_status IN ('IN_TRANSIT', 'PARTIAL')");
  });
});
