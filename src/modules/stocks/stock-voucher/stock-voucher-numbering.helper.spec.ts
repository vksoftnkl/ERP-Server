import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  StockVoucherNumberScope,
  allocateStockVoucherNumber,
  buildStockVoucherRefno,
  nextStockVoucherSlno,
  resolveDeviceCode,
} from './stock-voucher-numbering.helper';

// The accounts counter is its own helper with its own tests; here it only has
// to be asked, with the right scope, and only when the rules name a type.
jest.mock('src/common/Sequence/voucher-sequence.helper', () => ({
  allocateVoucherNumber: jest.fn(),
}));
const accountsCounter = allocateVoucherNumber as jest.MockedFunction<typeof allocateVoucherNumber>;

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const DEVICE_ID = '01000000-0000-7000-8000-0000000000d1';
const ACC_YEAR = '2026-2027';

const SCOPE: StockVoucherNumberScope = {
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: ACC_YEAR,
  voucherType: 'OPENING',
  deviceId: DEVICE_ID,
};

const device = (overrides: Record<string, unknown> = {}) => ({
  devDeviceUid: 'TILL-01',
  devDeviceName: 'Till 1',
  devIsActive: true,
  devIsBlocked: false,
  devBlockReason: null,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

/** The SQL text of a tagged-template $queryRaw call. */
const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join('?');

describe('stock-voucher-numbering.helper', () => {
  let tx: { deviceMaster: { findFirst: jest.Mock }; $queryRaw: jest.Mock };
  const client = () => tx as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    accountsCounter.mockReset();
    accountsCounter.mockResolvedValue({
      lastNo: BigInt(7),
      refno: 'OPN0007',
      periodKey: ACC_YEAR,
    } as never);
    tx = {
      deviceMaster: { findFirst: jest.fn().mockResolvedValue(device()) },
      $queryRaw: jest.fn((strings: TemplateStringsArray) =>
        Promise.resolve(
          strings.join('?').includes('next_slno') ? [{ next_slno: BigInt(41) }] : [{ locked: 1 }],
        ),
      ),
    };
  });

  // ── resolveDeviceCode ─────────────────────────────────────────────────────
  describe('resolveDeviceCode', () => {
    it('answers the device uid, trimmed, for a live device', async () => {
      tx.deviceMaster.findFirst.mockResolvedValue(device({ devDeviceUid: '  TILL-01  ' }));

      await expect(resolveDeviceCode(client(), DEVICE_ID)).resolves.toBe('TILL-01');
      expect(tx.deviceMaster.findFirst).toHaveBeenCalledWith({
        where: { devId: DEVICE_ID, devIsDeleted: false },
        select: {
          devDeviceUid: true,
          devDeviceName: true,
          devIsActive: true,
          devIsBlocked: true,
          devBlockReason: true,
        },
      });
    });

    it('falls back to the device name, then to the id itself', async () => {
      tx.deviceMaster.findFirst.mockResolvedValueOnce(device({ devDeviceUid: '  ' }));
      tx.deviceMaster.findFirst.mockResolvedValueOnce(
        device({ devDeviceUid: null, devDeviceName: null }),
      );

      await expect(resolveDeviceCode(client(), DEVICE_ID)).resolves.toBe('Till 1');
      await expect(resolveDeviceCode(client(), DEVICE_ID)).resolves.toBe(DEVICE_ID);
    });

    it('refuses a device with no live master row as 404 STOCK_DEVICE_NOT_FOUND', async () => {
      tx.deviceMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(resolveDeviceCode(client(), DEVICE_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'Device not found',
          errors: [{ field: 'deviceId', code: StockErrorCode.DEVICE_NOT_FOUND }],
        },
      });
    });

    it('refuses a blocked device, quoting its block reason', async () => {
      tx.deviceMaster.findFirst.mockResolvedValue(
        device({ devIsBlocked: true, devBlockReason: '  Reported stolen ' }),
      );

      const refusal = await refusalOf(resolveDeviceCode(client(), DEVICE_ID));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Device unavailable',
          errors: [
            {
              field: 'deviceId',
              code: StockErrorCode.DEVICE_BLOCKED,
              message: `Device ${DEVICE_ID} is blocked: Reported stolen`,
            },
          ],
        },
      });
    });

    it('refuses an inactive device with the generic wording when no reason is on file', async () => {
      tx.deviceMaster.findFirst.mockResolvedValue(device({ devIsActive: false }));

      const refusal = await refusalOf(resolveDeviceCode(client(), DEVICE_ID));

      expect(refusal).toMatchObject({
        body: {
          errors: [
            {
              code: StockErrorCode.DEVICE_BLOCKED,
              message: `Device ${DEVICE_ID} is blocked or inactive.`,
            },
          ],
        },
      });
    });
  });

  // ── nextStockVoucherSlno ──────────────────────────────────────────────────
  describe('nextStockVoucherSlno', () => {
    it('takes the advisory lock INSIDE count(), never in a CTE nothing reads', async () => {
      await nextStockVoucherSlno(client(), SCOPE);

      const [lockCall] = tx.$queryRaw.mock.calls;
      const sql = sqlOf(lockCall);
      // The CTE shape was a silent no-op: PostgreSQL never evaluates a CTE
      // nobody references, so no lock was ever taken (memory: numbering lock).
      expect(sql).toMatch(/SELECT\s+count\(pg_advisory_xact_lock\(/);
      expect(sql).not.toMatch(/WITH\s+\w+\s+AS\s*\(\s*SELECT\s+pg_advisory_xact_lock/i);
      // Keyed on the full ux_svh_slno scope — the device is the counter.
      expect(lockCall.slice(1)).toEqual([
        'stock.stock_voucher.slno',
        [COMPANY_ID, BRANCH_ID, ACC_YEAR, 'OPENING', DEVICE_ID].join('|'),
      ]);
    });

    it('locks BEFORE it reads MAX(svh_slno), and answers MAX + 1 for the scope', async () => {
      await expect(nextStockVoucherSlno(client(), SCOPE)).resolves.toBe(BigInt(41));

      const [lockCall, maxCall] = tx.$queryRaw.mock.calls;
      expect(sqlOf(lockCall)).toContain('pg_advisory_xact_lock');
      expect(sqlOf(maxCall)).toContain('COALESCE(MAX(svh_slno), 0) + 1');
      expect(maxCall.slice(1)).toEqual([COMPANY_ID, BRANCH_ID, ACC_YEAR, 'OPENING', DEVICE_ID]);
    });

    it('starts at 1 when the read answers nothing', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(nextStockVoucherSlno(client(), SCOPE)).resolves.toBe(BigInt(1));
    });
  });

  // ── buildStockVoucherRefno ────────────────────────────────────────────────
  describe('buildStockVoucherRefno', () => {
    it('joins type, trimmed year, device and serial with slashes', () => {
      expect(buildStockVoucherRefno('PHY', ' 2026-2027 ', 'TILL-01', BigInt(12))).toBe(
        'PHY/2026-2027/TILL-01/12',
      );
    });

    it('accepts a refno of exactly 100 characters', () => {
      // 'OPN/2026-2027/' (14) + device + '/1' (2) = 100.
      const deviceCode = 'D'.repeat(84);

      expect(buildStockVoucherRefno('OPN', ACC_YEAR, deviceCode, BigInt(1))).toHaveLength(100);
    });

    it('fails loudly past 100 characters rather than truncate into another device’s number', () => {
      expect(() => buildStockVoucherRefno('OPN', ACC_YEAR, 'D'.repeat(85), BigInt(1))).toThrow(
        /exceeds 100 characters\. Shorten the device code on device_master\./,
      );
    });
  });

  // ── allocateStockVoucherNumber ────────────────────────────────────────────
  describe('allocateStockVoucherNumber', () => {
    it('uses a slno and refno the device already printed, verbatim, and reads nothing', async () => {
      await expect(
        allocateStockVoucherNumber(client(), SCOPE, 'OPN', { slno: '17', refno: ' OFF/17 ' }),
      ).resolves.toEqual({ slno: BigInt(17), refno: 'OFF/17' });

      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.deviceMaster.findFirst).not.toHaveBeenCalled();
      expect(accountsCounter).not.toHaveBeenCalled();
    });

    it('builds the device refno around a supplied slno', async () => {
      await expect(
        allocateStockVoucherNumber(client(), SCOPE, 'OPN', { slno: BigInt(9) }),
      ).resolves.toEqual({ slno: BigInt(9), refno: 'OPN/2026-2027/TILL-01/9' });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('allocates a slno around a supplied refno, and builds nothing', async () => {
      await expect(
        allocateStockVoucherNumber(client(), SCOPE, 'OPN', { refno: 'MY-REF-1' }),
      ).resolves.toEqual({ slno: BigInt(41), refno: 'MY-REF-1' });
      expect(tx.deviceMaster.findFirst).not.toHaveBeenCalled();
    });

    it.each([
      ['nothing', {}],
      ['an empty slno and a blank refno', { slno: '', refno: '   ' }],
      ['null for both', { slno: null, refno: null }],
    ])('allocates both when the client sends %s', async (_label, supplied) => {
      await expect(allocateStockVoucherNumber(client(), SCOPE, 'OPN', supplied)).resolves.toEqual({
        slno: BigInt(41),
        refno: 'OPN/2026-2027/TILL-01/41',
      });
    });

    it('takes a numeric slno as well as a string one', async () => {
      await expect(
        allocateStockVoucherNumber(client(), SCOPE, 'OPN', { slno: 5, refno: 'R5' }),
      ).resolves.toEqual({ slno: BigInt(5), refno: 'R5' });
    });

    it('draws the printed number from the accounts counter when the rules name a voucher type', async () => {
      await expect(allocateStockVoucherNumber(client(), SCOPE, 'OPN', {}, 1)).resolves.toEqual({
        slno: BigInt(41),
        refno: 'OPN0007',
      });

      // No deviceCode: every till in the branch shares the 'MAIN' counter.
      expect(accountsCounter).toHaveBeenCalledWith(client(), {
        vchrTypeId: 1,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });
    });

    it('checks the device BEFORE it consumes an accounts number', async () => {
      tx.deviceMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(allocateStockVoucherNumber(client(), SCOPE, 'OPN', {}, 1));

      expect(refusal.status).toBe(404);
      expect(accountsCounter).not.toHaveBeenCalled();
    });

    it('lets a supplied refno win over the accounts counter', async () => {
      await allocateStockVoucherNumber(client(), SCOPE, 'OPN', { refno: 'KEYED-1' }, 1);

      expect(accountsCounter).not.toHaveBeenCalled();
    });
  });
});
