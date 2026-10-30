import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockErrorCode } from '../types/stock-error-codes';
import { LotByBatchController } from './lot-by-batch.controller';
import { LotByBatchService } from './lot-by-batch.service';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';

const statementOf = (mock: jest.Mock): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};
const squash = (sql: Prisma.Sql) => sql.text.replace(/\s+/g, ' ');

describe('LotByBatchService', () => {
  let queryRaw: jest.Mock;
  let service: LotByBatchService;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([{ lotId: 'L1' }]);
    service = new LotByBatchService({ $queryRaw: queryRaw } as unknown as PrismaService);
  });

  it('matches the batch as the lot key folds it, and counts SALEABLE stock at the branch', async () => {
    await service.find({ companyId: COMPANY_ID, branchId: BRANCH_ID, batchNo: 'cbe26-00001' });

    const sql = statementOf(queryRaw);
    expect(squash(sql)).toContain('slt.slt_key_batch = upper(btrim($7))');
    // Notes 150 #10 — the bucket is a parameter now, SALEABLE unless asked.
    expect(squash(sql)).toContain("($2::text = 'ALL' OR sbl.sbl_bucket = $3::text)");
    expect(sql.values).toEqual([
      BRANCH_ID,
      'SALEABLE',
      'SALEABLE',
      null,
      null,
      COMPANY_ID,
      'cbe26-00001',
    ]);
  });

  it('notes 150 #10: counts every bucket under bucket=ALL, in one godown when asked', async () => {
    const GODOWN_ID = '01000000-0000-7000-8000-0000000000d1';
    await service.find({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      batchNo: 'CBE26-00001',
      bucket: 'ALL',
      godownId: GODOWN_ID,
      includeEmpty: true,
    });

    const sql = statementOf(queryRaw);
    expect(squash(sql)).toContain("'bucket', sbl.sbl_bucket");
    expect(squash(sql)).toContain('OR sbl.sbl_godown_id = $5::uuid');
    expect(sql.values).toEqual([
      BRANCH_ID,
      'ALL',
      'ALL',
      GODOWN_ID,
      GODOWN_ID,
      COMPANY_ID,
      'CBE26-00001',
    ]);
  });

  it("carries the batch's size, colour and model (addendum 2 E3.1)", async () => {
    await service.find({ companyId: COMPANY_ID, branchId: BRANCH_ID, batchNo: 'X' });

    const sql = squash(statementOf(queryRaw));
    expect(sql).toContain('sbd.sbd_batch_no = slt.slt_key_batch');
    expect(sql).toContain('sbd.sbd_item_id = slt.slt_item_id');
    expect(sql).toContain('isz.isz_name AS "sizeName"');
    expect(sql).toContain('icl.icl_name AS "colourName"');
  });

  it('leaves out a lot with no stock unless includeEmpty', async () => {
    await service.find({ companyId: COMPANY_ID, branchId: BRANCH_ID, batchNo: 'X' });
    expect(squash(statementOf(queryRaw))).toContain('AND COALESCE(held.on_hand, 0) > 0');

    queryRaw.mockClear();
    await service.find({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      batchNo: 'X',
      includeEmpty: true,
    });
    expect(squash(statementOf(queryRaw))).not.toContain('held.on_hand, 0) > 0');
  });

  it('404s STOCK_BATCH_NOT_FOUND "No stock with batch …" on no row', async () => {
    queryRaw.mockResolvedValue([]);

    await expect(
      service.find({ companyId: COMPANY_ID, branchId: BRANCH_ID, batchNo: ' cbe26-00001 ' }),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        message: 'No stock with batch CBE26-00001',
        errors: [{ field: 'batchNo', code: StockErrorCode.BATCH_NOT_FOUND }],
      },
    });
  });
});

describe('LotByBatchController', () => {
  it('counts the lots in its message', async () => {
    const controller = new LotByBatchController({
      find: jest.fn().mockResolvedValue([{}, {}]),
    } as unknown as LotByBatchService);

    await expect(
      controller.find({ companyId: COMPANY_ID, branchId: BRANCH_ID, batchNo: 'X' }),
    ).resolves.toMatchObject({ success: true, message: '2 lot(s)' });
  });
});
