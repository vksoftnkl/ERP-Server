import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ItemInwardHistoryController } from './item-inward-history.controller';
import { ItemInwardHistoryService } from './item-inward-history.service';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';

const statementOf = (mock: jest.Mock): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};
const squash = (sql: Prisma.Sql) => sql.text.replace(/\s+/g, ' ');

describe('ItemInwardHistoryService', () => {
  let queryRaw: jest.Mock;
  let service: ItemInwardHistoryService;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([]);
    service = new ItemInwardHistoryService({ $queryRaw: queryRaw } as unknown as PrismaService);
  });

  it('reads this branch’s inward OPENING / PURCHASE rows, newest first, 10 by default', async () => {
    await service.list({ companyId: COMPANY_ID, branchId: BRANCH_ID, itemId: ITEM_ID });

    const sql = statementOf(queryRaw);
    expect(squash(sql)).toContain('AND sml.sml_direction = 1 AND sml.sml_txn_type IN ($4,$5)');
    expect(sql.values).toEqual([COMPANY_ID, BRANCH_ID, ITEM_ID, 'OPENING', 'PURCHASE', 10]);
    expect(squash(sql)).toContain(
      'ORDER BY sml.sml_doc_date DESC, sml.sml_doc_datetime DESC NULLS LAST, sml.sml_id DESC',
    );
  });

  it('leaves a cancelled document out — the forward row is live, its mirror says so', async () => {
    await service.list({ companyId: COMPANY_ID, branchId: BRANCH_ID, itemId: ITEM_ID, limit: 3 });

    const sql = squash(statementOf(queryRaw));
    expect(sql).toContain('sml.sml_is_reversal = false AND NOT EXISTS');
    expect(sql).toContain('rev.sml_reverses_id = sml.sml_id');
    expect(statementOf(queryRaw).values.at(-1)).toBe(3);
  });

  it('names the supplier from the row, else from its lot', async () => {
    await service.list({ companyId: COMPANY_ID, branchId: BRANCH_ID, itemId: ITEM_ID });

    expect(squash(statementOf(queryRaw))).toContain(
      'sup.sup_id = COALESCE(sml.sml_party_id, slt.slt_supplier_id)',
    );
  });
});

describe('ItemInwardHistoryController', () => {
  it('counts the rows in its message', async () => {
    const controller = new ItemInwardHistoryController({
      list: jest.fn().mockResolvedValue([{}, {}]),
    } as unknown as ItemInwardHistoryService);

    await expect(
      controller.list({ companyId: COMPANY_ID, branchId: BRANCH_ID, itemId: ITEM_ID }),
    ).resolves.toMatchObject({ success: true, message: '2 inward row(s)' });
  });
});
