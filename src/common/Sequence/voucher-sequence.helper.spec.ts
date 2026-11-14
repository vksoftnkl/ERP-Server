import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AccVoucherSeq, Prisma, VoucherResetFreq } from '@prisma/client';
import {
  VoucherNumberScope,
  allocateVoucherNumber,
  allocateVoucherSlno,
  buildRefno,
  expandVoucherFormat,
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
    /** The voucher type's prefix / suffix / width; default 'SB/', '/26', 4. */
    format?: { prefix: string | null; suffix: string | null; width?: number };
    /** What the shared branch-code query (branch-number-code.helper) answers. */
    branchCode?: string | null;
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
              vchrNoPrefix: options.format ? options.format.prefix : 'SB/',
              vchrNoSuffix: options.format ? options.format.suffix : '/26',
              vchrNoWidth: options.format?.width ?? 4,
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
    $queryRaw: jest.fn(async (strings: unknown, ..._values: unknown[]) =>
      isBranchCodeQuery(strings) ? [{ code: options.branchCode ?? null }] : [{ locked: 1 }],
    ),
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
};

const isBranchCodeQuery = (strings: unknown): boolean =>
  Array.isArray(strings) && strings.join('?').includes('branch_master');

const branchCodeCalls = (queryRaw: jest.Mock) =>
  queryRaw.mock.calls.filter(([strings]) => isBranchCodeQuery(strings));

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

// Branch serial plan §5.2 / §5.5 (approved 2026-11-04): {FY} / {BR} expand once,
// as the year's counter row is created; the row is the frozen format.
describe('allocateVoucherNumber — {FY} / {BR} formats', () => {
  const open = (options: Parameters<typeof makeTx>[0]) => {
    const harness = makeTx({ existing: null, ...options });
    return { ...harness, result: allocateVoucherNumber(harness.client, scope()) };
  };
  const createdData = (tx: ReturnType<typeof makeTx>['tx']) =>
    (tx.accVoucherSeq.create.mock.calls[0][0] as { data: Partial<AccVoucherSeq> }).data;

  it('expands {FY} and {BR} in the prefix and the suffix into the new counter row', async () => {
    const { tx, result } = open({
      format: { prefix: 'PO/{FY}/{BR}/', suffix: '-{BR}{FY}', width: 5 },
      branchCode: 'CBE',
    });

    await expect(result).resolves.toMatchObject({
      lastNo: BigInt(1),
      refno: 'PO/2026-2027/CBE/00001-CBE2026-2027',
    });
    expect(createdData(tx)).toMatchObject({
      voucherPrefix: 'PO/2026-2027/CBE/',
      voucherSuffix: '-CBE2026-2027',
      noWidth: 5,
    });
    // The printed number is written back as it is drawn.
    expect(tx.accVoucherSeq.update).toHaveBeenNthCalledWith(2, {
      where: { id: SEQ_ID },
      data: { lastRefno: 'PO/2026-2027/CBE/00001-CBE2026-2027', modifiedOn: expect.any(Date) },
    });
  });

  it.each([
    ['the Bill Prefix', 'CBE'],
    ['the branch code when the Bill Prefix is blank', 'COUNTER2'],
  ])('prints {BR} as %s, through the shared SQL fold', async (_label, code) => {
    const { tx, result } = open({ format: { prefix: 'GRN/{FY}/{BR}/', suffix: null }, branchCode: code });

    await expect(result).resolves.toMatchObject({ refno: `GRN/2026-2027/${code}/0001` });
    const [[strings, ...values]] = branchCodeCalls(tx.$queryRaw);
    expect(Prisma.sql(strings as string[], ...values).text.replace(/\s+/g, ' ')).toContain(
      "upper(COALESCE(NULLIF(btrim(br_bill_prefix), ''), NULLIF(btrim(br_code), '')))",
    );
    expect(values).toEqual([BRANCH_ID]);
  });

  it('expands {FY} alone without reading the branch', async () => {
    const { tx, result } = open({ format: { prefix: 'ADJ/{FY}/', suffix: null }, branchCode: null });

    await expect(result).resolves.toMatchObject({ refno: 'ADJ/2026-2027/0001' });
    expect(branchCodeCalls(tx.$queryRaw)).toHaveLength(0);
  });

  it.each([
    ['bil', null, 'bil0001'],
    ['srt', '/X', 'srt0001/X'],
    // Only a '{' marks a format: a lone '}' is text, as today.
    ['A}B', null, 'A}B0001'],
    [null, null, '0001'],
  ])('keeps a prefix %p with no "{" exactly as before, with no branch read', async (prefix, suffix, refno) => {
    const { tx, result } = open({ format: { prefix, suffix }, branchCode: 'CBE' });

    await expect(result).resolves.toMatchObject({ refno });
    expect(createdData(tx)).toMatchObject({ voucherPrefix: prefix, voucherSuffix: suffix });
    expect(branchCodeCalls(tx.$queryRaw)).toHaveLength(0);
  });

  it('never re-expands an open counter: its row is the year’s frozen format', async () => {
    const { tx, result } = open({
      existing: seq({ voucherPrefix: 'PO/2026-2027/CBE/', lastNo: BigInt(7) }),
      format: { prefix: 'PO/{FY}/{BR}/', suffix: null },
      branchCode: 'NEWCODE',
    });

    await expect(result).resolves.toMatchObject({ refno: 'PO/2026-2027/CBE/00008' });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
    expect(branchCodeCalls(tx.$queryRaw)).toHaveLength(0);
  });

  it('refuses 422 SEQUENCE_BRANCH_CODE_MISSING when the branch has neither a Bill Prefix nor a code', async () => {
    const { tx, result } = open({ format: { prefix: 'PUR/{FY}/{BR}/', suffix: null }, branchCode: null });

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject({
      response: { errors: [{ field: 'branchId', code: 'SEQUENCE_BRANCH_CODE_MISSING' }] },
    });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it.each(['CB/E', 'ABCDEFGHIJK', 'HAP CHENNAI', 'CB_E', 'CBÉ'])(
    'refuses 422 SEQUENCE_BRANCH_CODE_INVALID for the code %p',
    async (code) => {
      const { tx, result } = open({ format: { prefix: 'PUR/{FY}/{BR}/', suffix: null }, branchCode: code });

      await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(result).rejects.toMatchObject({
        response: {
          errors: [{ field: 'branchId', code: 'SEQUENCE_BRANCH_CODE_INVALID', params: { branchCode: code } }],
        },
      });
      expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['PO/{YY}/', null, 'YY'],
    ['PO/{fy}/{BR}/', null, 'fy'],
    ['PO/{FY}/', '/{DEVICE}', 'DEVICE'],
    ['PO/{}/', null, ''],
    ['PO/{FY', null, 'PO/ FY'],
    ['PO}/{FY}/', null, 'PO / FY /'],
  ])('refuses 422 SEQUENCE_FORMAT_TOKEN_UNKNOWN for %p / %p before reading the branch', async (prefix, suffix, token) => {
    const { tx, result } = open({ format: { prefix, suffix }, branchCode: 'CBE' });

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject({
      response: {
        errors: [{ field: 'vchrTypeId', code: 'SEQUENCE_FORMAT_TOKEN_UNKNOWN', params: { token } }],
      },
    });
    expect(branchCodeCalls(tx.$queryRaw)).toHaveLength(0);
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('opens a counter whose first number is exactly 50 characters', async () => {
    // 31 + 9 + 10 = 50.
    const { result } = open({
      format: { prefix: '{FY}/{FY}/{BR}/', suffix: '-{FY}', width: 9 },
      branchCode: 'ABCDEFGHIJ',
    });

    const { refno } = await result;
    expect(refno).toHaveLength(50);
  });

  it.each([
    ['a first number over 50 characters', { prefix: '{FY}/{FY}/{BR}/', suffix: '-{FY}', width: 10 }],
    ['a suffix that expands past its 20-character column', { prefix: 'X/', suffix: '/{FY}/{BR}', width: 5 }],
    ['a prefix that expands past its 60-character column', { prefix: '{BR}'.repeat(7), suffix: null, width: 1 }],
  ])('refuses 400 SEQUENCE_REFNO_TOO_LONG for %s', async (_label, format) => {
    const { tx, result } = open({ format, branchCode: 'ABCDEFGHIJ' });

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({
      response: { errors: [{ field: 'vchrTypeId', code: 'SEQUENCE_REFNO_TOO_LONG' }] },
    });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });
});

describe('expandVoucherFormat', () => {
  const formatScope = { vchrTypeId: 61, branchId: BRANCH_ID, accYear: '2026-2027' };

  it('hands a format with no "{" back untouched, without a query', async () => {
    const { tx, client } = makeTx();
    const format = { prefix: 'rct', suffix: null, noWidth: 5 };

    await expect(expandVoucherFormat(client, formatScope, format)).resolves.toBe(format);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('expands every occurrence of each token', async () => {
    const { client } = makeTx({ branchCode: 'COUNTER2' });

    await expect(
      expandVoucherFormat(client, formatScope, { prefix: '{BR}/{FY}/{BR}/', suffix: null, noWidth: 5 }),
    ).resolves.toEqual({ prefix: 'COUNTER2/2026-2027/COUNTER2/', suffix: null, noWidth: 5 });
  });
});
