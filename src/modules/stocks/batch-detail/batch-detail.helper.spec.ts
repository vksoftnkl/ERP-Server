import { Prisma } from '@prisma/client';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  batchDetailId,
  foldBatchNo,
  syncBatchDetails,
  withBatchDetails,
  type BatchDetailSource,
} from './batch-detail.helper';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const SVH_ID = '01000000-0000-7000-8000-0000000000d1';
const SHIRT = '01000000-0000-7000-8000-000000000001';
const SIZE_XL = '01000000-0000-7000-8000-0000000000a1';
const COLOUR_M = '01000000-0000-7000-8000-0000000000a2';
const LINE_1 = '01000000-0000-7000-8000-0000000000e1';
const LINE_2 = '01000000-0000-7000-8000-0000000000e2';

const SOURCE: BatchDetailSource = {
  companyId: COMPANY_ID,
  accYear: '2026-2027',
  srcDocType: 'OPENING',
  srcDocId: SVH_ID,
  actor: 'user-1',
};

const sqlOf = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

interface World {
  stored: {
    svi_id: string;
    svi_line_no: number;
    svi_split_no: number;
    svi_item_id: string;
    svi_batch_no: string | null;
  }[];
  owned?: { sbd_src_line_id: string; sbd_batch_no: string }[];
  live?: string[];
}

function txFor(world: World) {
  const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = Prisma.sql(strings, ...values).text;
    if (sql.includes('FROM stock.stock_voucher_item')) return Promise.resolve(world.stored);
    if (sql.includes('FROM stock.stock_batch_detail')) return Promise.resolve(world.owned ?? []);
    if (sql.includes('item_size_master'))
      return Promise.resolve((world.live ?? []).map((id) => ({ id })));
    return Promise.reject(new Error(`unexpected: ${sql}`));
  });
  const executeRaw = jest.fn().mockResolvedValue(1);
  return {
    tx: { $queryRaw: queryRaw, $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
    executeRaw,
  };
}

describe('batchDetailId', () => {
  it('is uuid v5 of company|BATCH, the same however the batch is spelt', () => {
    const id = batchDetailId(COMPANY_ID, 'CBE26-00001');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(batchDetailId(COMPANY_ID, ' cbe26-00001 ')).toBe(id);
    expect(batchDetailId(COMPANY_ID, 'CBE26-00002')).not.toBe(id);
    expect(batchDetailId('01000000-0000-7000-8000-0000000000c2', 'CBE26-00001')).not.toBe(id);
  });

  it('folds as the lot key does', () => {
    expect(foldBatchNo('  b-2604 ')).toBe('B-2604');
  });
});

describe('syncBatchDetails (addendum 2 E2)', () => {
  it('writes a numbered line its row, keyed by the folded batch, with what it sent', async () => {
    const { tx, executeRaw } = txFor({
      stored: [
        {
          svi_id: LINE_1,
          svi_line_no: 1,
          svi_split_no: 1,
          svi_item_id: SHIRT,
          svi_batch_no: 'CBE26-00001',
        },
      ],
      live: [SIZE_XL, COLOUR_M],
    });

    await syncBatchDetails(
      tx,
      SOURCE,
      [{ lineNo: 1, sizeId: SIZE_XL, colourId: COLOUR_M, model: '  Slim fit ' }],
      new Set([0]),
    );

    const insert = sqlOf(executeRaw.mock.calls[0]);
    expect(insert.text).toContain('ON CONFLICT (sbd_id) DO UPDATE');
    expect(insert.values).toEqual([
      batchDetailId(COMPANY_ID, 'CBE26-00001'),
      COMPANY_ID,
      'CBE26-00001',
      SHIRT,
      SIZE_XL,
      COLOUR_M,
      'Slim fit',
      'OPENING',
      SVH_ID,
      LINE_1,
      'user-1',
    ]);
    // The document's other rows go; this one is kept.
    const retire = sqlOf(executeRaw.mock.calls[1]);
    expect(retire.text).toContain('SET sbd_is_deleted = true');
    expect(retire.values).toEqual(['user-1', SVH_ID, [batchDetailId(COMPANY_ID, 'CBE26-00001')]]);
  });

  it('keeps writing a line that already owns its row under the batch it still carries', async () => {
    const { tx, executeRaw } = txFor({
      stored: [
        {
          svi_id: LINE_1,
          svi_line_no: 1,
          svi_split_no: 1,
          svi_item_id: SHIRT,
          svi_batch_no: 'CBE26-00007',
        },
      ],
      owned: [{ sbd_src_line_id: LINE_1, sbd_batch_no: 'CBE26-00007' }],
    });

    await syncBatchDetails(tx, SOURCE, [{ lineNo: 1, model: 'Regular' }], new Set());

    expect(sqlOf(executeRaw.mock.calls[0]).values).toContain('Regular');
  });

  it('refuses size / colour / model on a typed batch, and on no batch at all', async () => {
    const { tx, executeRaw } = txFor({
      stored: [
        {
          svi_id: LINE_1,
          svi_line_no: 1,
          svi_split_no: 1,
          svi_item_id: SHIRT,
          svi_batch_no: 'my-typed',
        },
        { svi_id: LINE_2, svi_line_no: 2, svi_split_no: 1, svi_item_id: SHIRT, svi_batch_no: null },
      ],
    });

    await expect(
      syncBatchDetails(
        tx,
        SOURCE,
        [
          { lineNo: 1, sizeId: SIZE_XL },
          { lineNo: 2, model: 'Slim' },
        ],
        new Set(),
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [
          { field: 'lines.0', code: StockErrorCode.BATCH_DETAIL_NEEDS_AUTO_BATCH },
          { field: 'lines.1', code: StockErrorCode.BATCH_DETAIL_NEEDS_AUTO_BATCH },
        ],
      },
    });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('refuses a size or colour that is not live in the company', async () => {
    const { tx } = txFor({
      stored: [
        {
          svi_id: LINE_1,
          svi_line_no: 1,
          svi_split_no: 1,
          svi_item_id: SHIRT,
          svi_batch_no: 'CBE26-00001',
        },
      ],
      live: [SIZE_XL],
    });

    await expect(
      syncBatchDetails(
        tx,
        SOURCE,
        [{ lineNo: 1, sizeId: SIZE_XL, colourId: COLOUR_M }],
        new Set([0]),
      ),
    ).rejects.toMatchObject({
      response: {
        errors: [{ field: 'lines.0.colourId', code: StockErrorCode.BATCH_COLOUR_NOT_FOUND }],
      },
    });
  });

  it('a line whose batch is now typed loses its row; nothing kept retires every row', async () => {
    const { tx, executeRaw } = txFor({
      stored: [
        {
          svi_id: LINE_1,
          svi_line_no: 1,
          svi_split_no: 1,
          svi_item_id: SHIRT,
          svi_batch_no: 'my-typed',
        },
      ],
      owned: [{ sbd_src_line_id: LINE_1, sbd_batch_no: 'CBE26-00007' }],
    });

    await syncBatchDetails(tx, SOURCE, [{ lineNo: 1 }], new Set());

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlOf(executeRaw.mock.calls[0]).values).toEqual(['user-1', SVH_ID, []]);
  });
});

describe('withBatchDetails (E3.3)', () => {
  it('adds <p>SizeName / ColourName / Model by item and folded batch, null when none', async () => {
    const client = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          itemId: SHIRT,
          batchNo: 'CBE26-00001',
          sizeId: SIZE_XL,
          sizeName: 'XL',
          colourId: COLOUR_M,
          colourName: 'Maroon',
          model: 'Slim fit',
        },
      ]),
    };

    const rows = await withBatchDetails(client, COMPANY_ID, 'sdi', [
      { sdiItemId: SHIRT, sdiBatchNo: 'cbe26-00001' },
      { sdiItemId: SHIRT, sdiBatchNo: null },
    ]);

    expect(rows).toEqual([
      {
        sdiItemId: SHIRT,
        sdiBatchNo: 'cbe26-00001',
        sdiSizeName: 'XL',
        sdiColourName: 'Maroon',
        sdiModel: 'Slim fit',
      },
      {
        sdiItemId: SHIRT,
        sdiBatchNo: null,
        sdiSizeName: null,
        sdiColourName: null,
        sdiModel: null,
      },
    ]);
    expect(sqlOf(client.$queryRaw.mock.calls[0]).values).toEqual([COMPANY_ID, ['CBE26-00001']]);
  });

  it('reads nothing when no line carries a batch', async () => {
    const client = { $queryRaw: jest.fn() };
    await withBatchDetails(client, COMPANY_ID, 'sri', [{ sriItemId: SHIRT, sriBatchNo: '' }]);
    expect(client.$queryRaw).not.toHaveBeenCalled();
  });
});
