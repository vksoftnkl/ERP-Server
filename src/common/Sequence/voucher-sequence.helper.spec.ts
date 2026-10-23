import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccVoucherSeq, Prisma, VoucherResetFreq } from '@prisma/client';
import {
  VoucherNumberScope,
  allocateVoucherNumber,
  allocateVoucherSlno,
  buildRefno,
} from './voucher-sequence.helper';

const SEQ_ID = '019f0000-0000-7000-8000-0000000000a1';
const COMPANY_ID = '019f0000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '019f0000-0000-7000-8000-0000000000c2';

const seq = (overrides: Partial<AccVoucherSeq> = {}): AccVoucherSeq =>
  ({
    id: SEQ_ID,
    vchrTypeId: 3,
    voucherPrefix: 'SB/',
    voucherSuffix: null,
    noWidth: 5,
    lastNo: BigInt(41),
    isActive: true,
    isDeleted: false,
    ...overrides,
  }) as AccVoucherSeq;

const makeTx = (
  options: {
    resetFreq?: VoucherResetFreq;
    voucherType?: boolean;
    existing?: AccVoucherSeq | null;
    company?: boolean;
    branch?: boolean;
  } = {},
) => {
  let lastNo = options.existing?.lastNo ?? BigInt(0);
  let row = options.existing ?? null;
  const tx = {
    accVoucherType: {
      findFirst: jest.fn(async () =>
        options.voucherType === false
          ? null
          : {
              vchrTypeId: 3,
              vchrNoPrefix: 'SB/',
              vchrNoSuffix: '/26',
              vchrNoWidth: 4,
              vchrResetFreq: options.resetFreq ?? VoucherResetFreq.YEARLY,
            },
      ),
    },
    accVoucherSeq: {
      findFirst: jest.fn(async (_args: { where: Record<string, unknown> }) => options.existing ?? null),
      create: jest.fn(async (args: { data: Partial<AccVoucherSeq> }) => {
        row = seq({ ...args.data, lastNo: args.data.lastNo ?? BigInt(0) });
        return row;
      }),
      update: jest.fn(
        async (args: { where: { id: string }; data: { lastNo?: { increment: number } } & Record<string, unknown> }) => {
          if (args.data.lastNo) lastNo += BigInt(args.data.lastNo.increment);
          return seq({ ...(row ?? {}), lastNo });
        },
      ),
    },
    company: {
      findFirst: jest.fn(async () => (options.company === false ? null : { compCode: 'ZTS' })),
    },
    branchMaster: {
      findFirst: jest.fn(async () => (options.branch === false ? null : { brCode: 'BR1' })),
    },
    $queryRaw: jest.fn(async (..._args: unknown[]) => [{ locked: 1 }]),
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
};

const scope = (overrides: Partial<VoucherNumberScope> = {}): VoucherNumberScope => ({
  vchrTypeId: 3,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: '2026-2027',
  documentDate: new Date('2026-10-23T00:00:00.000Z'),
  ...overrides,
});

describe('buildRefno', () => {
  it('pads the number to the width between prefix and suffix', () => {
    expect(buildRefno(seq({ lastNo: BigInt(7), voucherSuffix: '/A' }))).toBe('SB/00007/A');
  });

  it('trims the prefix and suffix and copes with neither', () => {
    expect(buildRefno(seq({ voucherPrefix: ' INV ', voucherSuffix: ' X ', lastNo: BigInt(1), noWidth: 2 }))).toBe(
      'INV01X',
    );
    expect(buildRefno(seq({ voucherPrefix: null, lastNo: BigInt(12), noWidth: 1 }))).toBe('12');
  });

  it('keeps counting past the width instead of truncating', () => {
    expect(buildRefno(seq({ lastNo: BigInt(123456), noWidth: 3 }))).toBe('SB/123456');
  });

  it('refuses a number longer than the refno column', () => {
    const run = () => buildRefno(seq({ voucherPrefix: 'P'.repeat(96), lastNo: BigInt(1) }));

    expect(run).toThrow(BadRequestException);
    try {
      run();
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        errors: [{ field: 'vchrTypeId', code: 'SEQUENCE_REFNO_TOO_LONG' }],
      });
    }
  });
});

describe('allocateVoucherNumber', () => {
  it('consumes the next number of an existing counter and writes the refno back', async () => {
    const { tx, client } = makeTx({ existing: seq({ lastNo: BigInt(41) }) });

    await expect(allocateVoucherNumber(client, scope())).resolves.toEqual({
      lastNo: BigInt(42),
      refno: 'SB/00042',
      periodKey: '2026-2027',
    });
    expect(tx.accVoucherSeq.update).toHaveBeenNthCalledWith(1, {
      where: { id: SEQ_ID },
      data: { lastNo: { increment: 1 } },
    });
    expect(tx.accVoucherSeq.update).toHaveBeenNthCalledWith(2, {
      where: { id: SEQ_ID },
      data: { lastRefno: 'SB/00042', modifiedOn: expect.any(Date) },
    });
  });

  it('opens a counter on first use from the voucher type’s format', async () => {
    const { tx, client } = makeTx({ existing: null });

    const result = await allocateVoucherNumber(client, scope());

    expect(tx.accVoucherSeq.create).toHaveBeenCalledWith({
      data: {
        vchrTypeId: 3,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: '2026-2027',
        deviceCode: 'MAIN',
        periodKey: '2026-2027',
        lastNo: BigInt(0),
        voucherPrefix: 'SB/',
        voucherSuffix: '/26',
        noWidth: 4,
        companyCode: 'ZTS',
        branchCode: 'BR1',
      },
    });
    expect(result).toMatchObject({ lastNo: BigInt(1), refno: 'SB/0001/26' });
  });

  it('locks the scope before looking the counter up', async () => {
    const { tx, client } = makeTx({ existing: seq() });

    await allocateVoucherNumber(client, scope({ deviceCode: ' POS1 ' }));

    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([
      'accounts.acc_voucher_seq.allocate',
      `3|${COMPANY_ID}|${BRANCH_ID}|2026-2027|POS1|2026-2027`,
    ]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.accVoucherSeq.findFirst.mock.invocationCallOrder[0],
    );
  });

  it.each([
    [VoucherResetFreq.NEVER, 'ALL'],
    [VoucherResetFreq.YEARLY, '2026-2027'],
    [VoucherResetFreq.MONTHLY, '2026-10'],
    [VoucherResetFreq.DAILY, '2026-10-23'],
  ])('draws a %s counter from period %s', async (resetFreq, periodKey) => {
    const { tx, client } = makeTx({ resetFreq, existing: seq() });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({ periodKey });
    expect(tx.accVoucherSeq.findFirst.mock.calls[0][0].where).toMatchObject({ periodKey });
  });

  it('keys a daily counter on the document’s date, not the save time', async () => {
    const { client } = makeTx({ resetFreq: VoucherResetFreq.DAILY, existing: seq() });

    await expect(
      allocateVoucherNumber(client, scope({ documentDate: new Date('2026-03-31T00:00:00.000Z') })),
    ).resolves.toMatchObject({ periodKey: '2026-03-31' });
  });

  it('falls back to today for a missing or invalid document date', async () => {
    jest.useFakeTimers({ now: new Date('2026-12-05T06:00:00.000Z') });
    try {
      const { client } = makeTx({ resetFreq: VoucherResetFreq.MONTHLY, existing: seq() });

      await expect(
        allocateVoucherNumber(client, scope({ documentDate: new Date('nope') })),
      ).resolves.toMatchObject({ periodKey: '2026-12' });
      await expect(
        allocateVoucherNumber(client, scope({ documentDate: null })),
      ).resolves.toMatchObject({ periodKey: '2026-12' });
    } finally {
      jest.useRealTimers();
    }
  });

  // isActive / isDeleted are admin switches — never quietly revived.
  it.each([
    ['deactivated', { isActive: false }],
    ['deleted', { isDeleted: true }],
  ])('refuses a %s counter', async (_label, overrides) => {
    const { tx, client } = makeTx({ existing: seq(overrides) });

    await expect(allocateVoucherNumber(client, scope())).rejects.toMatchObject({
      response: { errors: [{ field: 'vchrTypeId', code: 'SEQUENCE_INACTIVE' }] },
    });
    expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown voucher type', async () => {
    const { client } = makeTx({ voucherType: false });

    const result = allocateVoucherNumber(client, scope());

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({
      response: { errors: [{ code: 'SEQUENCE_VOUCHER_TYPE_NOT_FOUND' }] },
    });
  });

  it.each([
    ['company', 'SEQUENCE_COMPANY_NOT_FOUND'],
    ['branch', 'SEQUENCE_BRANCH_NOT_FOUND'],
  ])('refuses to open a counter for a missing %s', async (missing, code) => {
    const { tx, client } = makeTx({ existing: null, [missing]: false });

    await expect(allocateVoucherNumber(client, scope())).rejects.toMatchObject({
      response: { errors: [{ code }] },
    });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses voucher type id %s', async (vchrTypeId) => {
    const { tx, client } = makeTx();

    await expect(allocateVoucherNumber(client, scope({ vchrTypeId }))).rejects.toMatchObject({
      response: { errors: [{ field: 'vchrTypeId', code: 'VALIDATION_IS_INT' }] },
    });
    expect(tx.accVoucherType.findFirst).not.toHaveBeenCalled();
  });

  it.each(['companyId', 'branchId', 'accYear'] as const)('requires %s', async (field) => {
    const { client } = makeTx();

    await expect(
      allocateVoucherNumber(client, scope({ [field]: '   ' })),
    ).rejects.toMatchObject({
      response: { errors: [{ field, code: 'VALIDATION_IS_NOT_EMPTY' }] },
    });
  });
});

describe('allocateVoucherSlno', () => {
  it('takes the company/year lock, then the next serial', async () => {
    const $queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ locked: 1 }])
      .mockResolvedValueOnce([{ next_slno: BigInt(1001) }]);

    await expect(
      allocateVoucherSlno({ $queryRaw } as unknown as Prisma.TransactionClient, COMPANY_ID, '2026-2027'),
    ).resolves.toBe(BigInt(1001));
    expect($queryRaw.mock.calls[0].slice(1)).toEqual([
      'accounts.acc_voucher_header.voucher_slno',
      `${COMPANY_ID}|2026-2027`,
    ]);
    expect($queryRaw.mock.calls[1].slice(1)).toEqual([COMPANY_ID, '2026-2027']);
  });

  it('starts at 1 when the read returns nothing', async () => {
    const $queryRaw = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(
      allocateVoucherSlno({ $queryRaw } as unknown as Prisma.TransactionClient, COMPANY_ID, '2026-2027'),
    ).resolves.toBe(BigInt(1));
  });
});
