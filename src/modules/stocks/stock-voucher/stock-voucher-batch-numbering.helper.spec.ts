import { Prisma } from '@prisma/client';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  AUTO_BATCH_NO_SETTING,
  assignAutoBatchNumbers,
  type AutoBatchNoScope,
} from './stock-voucher-batch-numbering.helper';

jest.mock('src/common/Sequence/voucher-sequence.helper', () => ({
  allocateVoucherNumber: jest.fn(),
}));

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const SVH_ID = '01000000-0000-7000-8000-0000000000d1';
const SHIRT = '01000000-0000-7000-8000-000000000001';
const SALT = '01000000-0000-7000-8000-000000000002';
const SVI_1 = '01000000-0000-7000-8000-0000000000e1';

const SCOPE: AutoBatchNoScope = {
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: '2026-2027',
  docDate: '2026-10-23',
};

interface World {
  setting?: string | null;
  tracked?: string[];
  stored?: { svi_id: string; svi_batch_no: string }[];
  branchCode?: string | null;
  voucherTypeId?: number | null;
}

/** A tx whose $queryRaw answers each statement of the helper by what it reads. */
function txFor(world: World) {
  const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = Prisma.sql(strings, ...values).text;
    if (sql.includes('fn_app_settings_effective')) {
      return Promise.resolve(world.setting === undefined ? [] : [{ value: world.setting }]);
    }
    if (sql.includes('stock_track_policy')) {
      return Promise.resolve((world.tracked ?? []).map((item_id) => ({ item_id })));
    }
    if (sql.includes('stock.stock_voucher_item')) {
      return Promise.resolve(world.stored ?? []);
    }
    if (sql.includes('branch_master')) {
      return Promise.resolve([{ code: world.branchCode ?? null }]);
    }
    if (sql.includes('acc_voucher_types')) {
      return Promise.resolve(world.voucherTypeId ? [{ vchr_type_id: world.voucherTypeId }] : []);
    }
    return Promise.reject(new Error(`unexpected statement: ${sql}`));
  });
  return { tx: { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient, queryRaw };
}

const allocate = allocateVoucherNumber as jest.Mock;

describe('assignAutoBatchNumbers (textile plan D1–D3)', () => {
  beforeEach(() => {
    let next = 0;
    allocate.mockReset();
    allocate.mockImplementation(() => {
      next += 1;
      return Promise.resolve({
        lastNo: BigInt(next),
        refno: String(next).padStart(5, '0'),
        periodKey: 'ALL',
      });
    });
  });

  it('numbers each blank batch-tracked line <branch><YY>-<NNNNN> in line order, from the BATCH counter', async () => {
    const { tx } = txFor({
      setting: 'true',
      tracked: [SHIRT],
      branchCode: 'CBE',
      voucherTypeId: 45,
    });
    const lines = [
      { itemId: SHIRT, batchNo: null },
      { itemId: SHIRT, batchNo: '  ' },
    ];

    const { lines: numbered } = await assignAutoBatchNumbers(tx, SCOPE, lines);

    expect(numbered.map((l) => l.batchNo)).toEqual(['CBE26-00001', 'CBE26-00002']);
    // Two lines of one item at one price are two label runs, two numbers.
    expect(allocate).toHaveBeenCalledTimes(2);
    expect(allocate).toHaveBeenCalledWith(tx, {
      vchrTypeId: 45,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: '2026-2027',
      deviceCode: 'MAIN',
    });
    expect(lines[0].batchNo).toBeNull();
  });

  it('keeps a typed batch as typed and leaves an untracked item alone', async () => {
    const { tx } = txFor({
      setting: 'true',
      tracked: [SHIRT],
      branchCode: 'CBE',
      voucherTypeId: 45,
    });

    const { lines: numbered } = await assignAutoBatchNumbers(tx, SCOPE, [
      { itemId: SHIRT, batchNo: 'b-2604' },
      { itemId: SALT, batchNo: null },
      { itemId: SHIRT, batchNo: undefined },
    ]);

    expect(numbered.map((l) => l.batchNo)).toEqual(['b-2604', null, 'CBE26-00001']);
  });

  it('gives nothing while stock.auto_batch_no is off or unset', async () => {
    for (const setting of ['false', undefined]) {
      const { tx, queryRaw } = txFor({
        setting,
        tracked: [SHIRT],
        branchCode: 'CBE',
        voucherTypeId: 45,
      });
      const { lines: numbered } = await assignAutoBatchNumbers(tx, SCOPE, [
        { itemId: SHIRT, batchNo: null },
      ]);
      expect(numbered[0].batchNo).toBeNull();
      expect(queryRaw).toHaveBeenCalledTimes(1);
    }
    expect(allocate).not.toHaveBeenCalled();
  });

  it('reads the setting through the resolver, and nothing at all when no line is blank', async () => {
    const { tx, queryRaw } = txFor({ setting: 'true' });
    await assignAutoBatchNumbers(tx, SCOPE, [{ itemId: SHIRT, batchNo: 'X1' }]);
    expect(queryRaw).not.toHaveBeenCalled();

    await assignAutoBatchNumbers(tx, SCOPE, [{ itemId: SALT, batchNo: null }]);
    const [strings, ...values] = queryRaw.mock.calls[0];
    expect(Prisma.sql(strings, ...values).values).toEqual([
      COMPANY_ID,
      BRANCH_ID,
      AUTO_BATCH_NO_SETTING,
    ]);
  });

  it('an edit keeps the number the line already holds', async () => {
    const { tx } = txFor({
      setting: 'true',
      tracked: [SHIRT],
      stored: [{ svi_id: SVI_1, svi_batch_no: 'CBE26-00007' }],
      branchCode: 'CBE',
      voucherTypeId: 45,
    });

    const { lines: numbered } = await assignAutoBatchNumbers(tx, { ...SCOPE, svhId: SVH_ID }, [
      { sviId: SVI_1, itemId: SHIRT, batchNo: '' },
      { itemId: SHIRT, batchNo: null },
    ]);

    expect(numbered.map((l) => l.batchNo)).toEqual(['CBE26-00007', 'CBE26-00001']);
    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it('refuses with STOCK_BATCH_PREFIX_MISSING when the branch has no bill prefix and no code', async () => {
    const { tx } = txFor({
      setting: 'true',
      tracked: [SHIRT],
      branchCode: null,
      voucherTypeId: 45,
    });

    await expect(
      assignAutoBatchNumbers(tx, SCOPE, [{ itemId: SHIRT, batchNo: null }]),
    ).rejects.toMatchObject({
      status: 422,
      response: {
        message: 'Set a bill prefix on this branch to number batches.',
        errors: [{ field: 'branchId', code: StockErrorCode.BATCH_PREFIX_MISSING }],
      },
    });
    expect(allocate).not.toHaveBeenCalled();
  });

  it('upper-cases the branch code and trims the bill prefix in SQL', async () => {
    const { tx, queryRaw } = txFor({
      setting: 'true',
      tracked: [SHIRT],
      branchCode: 'TEST3',
      voucherTypeId: 45,
    });

    await assignAutoBatchNumbers(tx, SCOPE, [{ itemId: SHIRT, batchNo: null }]);

    const branchCall = queryRaw.mock.calls.find(([strings]) =>
      strings.join('?').includes('branch_master'),
    ) as [TemplateStringsArray, ...unknown[]];
    expect(Prisma.sql(...branchCall).text.replace(/\s+/g, ' ')).toContain(
      "upper(COALESCE(NULLIF(btrim(br_bill_prefix), ''), NULLIF(btrim(br_code), '')))",
    );
  });
});
