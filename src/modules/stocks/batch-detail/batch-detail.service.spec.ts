import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { StockErrorCode } from '../types/stock-error-codes';
import { BatchDetailController } from './batch-detail.controller';
import { BatchDetailService } from './batch-detail.service';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const SBD_ID = '01000000-0000-7000-8000-0000000000b1';
const DOC_ID = '01000000-0000-7000-8000-0000000000d1';
const SIZE_L = '01000000-0000-7000-8000-0000000000a1';

const sqlOf = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

describe('BatchDetailService', () => {
  let queryRaw: jest.Mock;
  let executeRaw: jest.Mock;
  let logEntityChange: jest.Mock;
  let service: BatchDetailService;
  let world: { row?: Record<string, unknown>; docStatus?: string; live?: string[] };

  const record = (overrides: Record<string, unknown> = {}) => ({
    sbdId: SBD_ID,
    batchNo: 'CBE26-00001',
    sizeId: null,
    model: 'Slim',
    ...overrides,
  });

  beforeEach(() => {
    world = {
      row: {
        sbd_id: SBD_ID,
        sbd_size_id: null,
        sbd_colour_id: null,
        sbd_model: 'Slim',
        sbd_src_doc_id: DOC_ID,
      },
      docStatus: 'POSTED',
      live: [SIZE_L],
    };
    let reads = 0;
    queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Prisma.sql(strings, ...values).text;
      if (sql.includes('FOR UPDATE')) return Promise.resolve(world.row ? [world.row] : []);
      if (sql.includes('FROM stock.stock_voucher'))
        return Promise.resolve(
          world.docStatus ? [{ svh_status: world.docStatus, svh_refno: 'OPN0001' }] : [],
        );
      if (sql.includes('item_size_master') && sql.includes('UNION ALL'))
        return Promise.resolve((world.live ?? []).map((id) => ({ id })));
      if (sql.includes('AS "sbdId"')) {
        reads += 1;
        return Promise.resolve([reads === 1 ? record() : record({ sizeId: SIZE_L })]);
      }
      return Promise.resolve([]);
    });
    executeRaw = jest.fn().mockResolvedValue(1);
    logEntityChange = jest.fn().mockResolvedValue(undefined);
    const client = { $queryRaw: queryRaw, $executeRaw: executeRaw };
    service = new BatchDetailService(
      {
        ...client,
        $transaction: (fn: (tx: unknown) => unknown) => fn(client),
      } as unknown as PrismaService,
      { logEntityChange } as unknown as AuditLogService,
      { getUserId: () => 'user-1' } as unknown as RequestContextService,
    );
  });

  describe('models (E3.2)', () => {
    it('reads distinct models of the item, newest first, at most 20', async () => {
      await service.models({ companyId: COMPANY_ID, itemId: ITEM_ID });

      const sql = sqlOf(queryRaw.mock.calls[0]);
      expect(sql.text).toContain('DISTINCT ON (upper(sbd_model))');
      expect(sql.text).toContain('ORDER BY used_on DESC, model');
      expect(sql.text).not.toContain('strpos');
      expect(sql.values).toEqual([COMPANY_ID, ITEM_ID, 20]);
    });

    it('narrows to models containing q, ignoring case', async () => {
      await service.models({ companyId: COMPANY_ID, itemId: ITEM_ID, q: 'slim' });

      const sql = sqlOf(queryRaw.mock.calls[0]);
      expect(sql.text).toContain('strpos(upper(sbd_model), upper($3)) > 0');
      expect(sql.values).toEqual([COMPANY_ID, ITEM_ID, 'slim', 20]);
    });
  });

  describe('update (E2)', () => {
    const body = {
      companyId: COMPANY_ID,
      batchNo: ' cbe26-00001',
      sizeId: SIZE_L,
      reason: 'Wrong size keyed',
    };

    it('changes what was sent, keeps the rest, and audits the before / after with the reason', async () => {
      const result = await service.update(body);

      expect(sqlOf(queryRaw.mock.calls[0]).values).toEqual([COMPANY_ID, 'CBE26-00001']);
      const update = sqlOf(executeRaw.mock.calls[0]);
      expect(update.values).toEqual([SIZE_L, null, 'Slim', 'user-1', SBD_ID]);
      expect(logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'stock_batch_detail',
          screenName: 'Batch Detail',
          pk: SBD_ID,
          displayName: 'CBE26-00001',
          originalRecord: record(),
          modifiedRecord: record({ sizeId: SIZE_L }),
          notes: 'Wrong size keyed',
        }),
        expect.anything(),
      );
      expect(result.sizeId).toBe(SIZE_L);
    });

    it('writes nothing when nothing changes', async () => {
      await service.update({ ...body, sizeId: undefined, model: ' Slim ' });

      expect(executeRaw).not.toHaveBeenCalled();
      expect(logEntityChange).not.toHaveBeenCalled();
    });

    it('404s STOCK_BATCH_DETAIL_NOT_FOUND for a batch with no detail', async () => {
      world.row = undefined;
      await expect(service.update(body)).rejects.toMatchObject({
        status: 404,
        response: { errors: [{ code: StockErrorCode.BATCH_DETAIL_NOT_FOUND }] },
      });
    });

    it('409s STOCK_BATCH_DETAIL_ON_DRAFT while the inward document is a draft', async () => {
      world.docStatus = 'DRAFT';
      await expect(service.update(body)).rejects.toMatchObject({
        status: 409,
        response: { errors: [{ code: StockErrorCode.BATCH_DETAIL_ON_DRAFT }] },
      });
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('refuses a size that is not live in the company', async () => {
      world.live = [];
      await expect(service.update(body)).rejects.toMatchObject({
        status: 422,
        response: { errors: [{ field: 'sizeId', code: StockErrorCode.BATCH_SIZE_NOT_FOUND }] },
      });
    });
  });
});

describe('BatchDetailController', () => {
  it('counts the models in its message', async () => {
    const controller = new BatchDetailController({
      models: jest.fn().mockResolvedValue(['Slim', 'Regular']),
    } as unknown as BatchDetailService);

    await expect(controller.models({ companyId: COMPANY_ID, itemId: ITEM_ID })).resolves.toEqual({
      success: true,
      message: '2 model(s)',
      data: ['Slim', 'Regular'],
    });
  });
});
