import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { AccVoucherSeq, Prisma, VoucherNumberingMode, VoucherResetFreq } from '@prisma/client';
import {
  VoucherNumberScope,
  allocateVoucherNumber,
  expandVoucherFormat,
  firstVoucherNumber,
  formatHasBranchToken,
  previewNextVoucherNumber,
  scanFormatTokens,
  shortAccYear,
} from './voucher-sequence.helper';

/**
 * Voucher Types plan §7.3 (Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md):
 * the {YY} token, the starting number, the Method, the GST 16-character check
 * at counter creation (decision 35) and the {BR} check for CHILD types only
 * (decision 40).
 */

const SEQ_ID = '019f0000-0000-7000-8000-0000000000a1';
const COMPANY_ID = '019f0000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '019f0000-0000-7000-8000-0000000000c2';

interface TypeRow {
  vchrTypeId: number;
  vchrNoPrefix: string | null;
  vchrNoSuffix: string | null;
  vchrNoWidth: number;
  vchrResetFreq: VoucherResetFreq;
  vchrStartNo: number;
  vchrNumberingMode: VoucherNumberingMode;
  vchrGstSide: string | null;
  vchrParentId: number | null;
}

const typeRow = (overrides: Partial<TypeRow> = {}): TypeRow => ({
  vchrTypeId: 70,
  vchrNoPrefix: 'RT/{YY}/',
  vchrNoSuffix: null,
  vchrNoWidth: 5,
  vchrResetFreq: VoucherResetFreq.YEARLY,
  vchrStartNo: 1,
  vchrNumberingMode: VoucherNumberingMode.AUTO,
  vchrGstSide: 'OUTPUT',
  vchrParentId: 3,
  ...overrides,
});

const seqRow = (overrides: Partial<AccVoucherSeq> = {}): AccVoucherSeq =>
  ({
    id: SEQ_ID,
    vchrTypeId: 70,
    voucherPrefix: 'RT/26-27/',
    voucherSuffix: null,
    noWidth: 5,
    lastNo: BigInt(0),
    isActive: true,
    isDeleted: false,
    ...overrides,
  }) as AccVoucherSeq;

const makeTx = (
  options: {
    type?: Partial<TypeRow>;
    existing?: AccVoucherSeq | null;
    branchCode?: string | null;
    /** Active branches of the company that share this branch's GSTIN (this one included). */
    sharing?: number;
  } = {},
) => {
  let row: AccVoucherSeq | null = options.existing ?? null;
  const tx = {
    accVoucherType: {
      findFirst: jest.fn(async () => typeRow(options.type)),
    },
    accVoucherSeq: {
      findFirst: jest.fn(async () => options.existing ?? null),
      create: jest.fn(async (args: { data: Partial<AccVoucherSeq> }) => {
        row = seqRow({ ...args.data });
        return row;
      }),
      update: jest.fn(
        async (args: { data: { lastNo?: { increment: number } } & Record<string, unknown> }) => {
          if (row && args.data.lastNo) {
            row = { ...row, lastNo: row.lastNo + BigInt(args.data.lastNo.increment) };
          }
          return row;
        },
      ),
    },
    company: { findFirst: jest.fn(async () => ({ compCode: 'ZTS' })) },
    branchMaster: { findFirst: jest.fn(async () => ({ brCode: 'BR001' })) },
    $queryRaw: jest.fn(async (strings: unknown) => {
      const sql = Array.isArray(strings) ? strings.join('?') : '';
      if (sql.includes('AS sharing')) {
        return [{ sharing: options.sharing ?? 1 }];
      }
      if (sql.includes('branch_master')) {
        return [{ code: options.branchCode ?? 'CBE' }];
      }
      return [{ locked: 1 }];
    }),
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
};

const scope = (overrides: Partial<VoucherNumberScope> = {}): VoucherNumberScope => ({
  vchrTypeId: 70,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: '2026-2027',
  documentDate: new Date('2026-11-15T00:00:00.000Z'),
  ...overrides,
});

const sharingCalls = (queryRaw: jest.Mock) =>
  queryRaw.mock.calls.filter(
    ([strings]) => Array.isArray(strings) && strings.join('?').includes('AS sharing'),
  );

describe('{YY} token', () => {
  it.each([
    ['2026-2027', '26-27'],
    ['1999-2000', '99-00'],
    [' 2030-2031 ', '30-31'],
  ])('shortAccYear(%p) = %p', (accYear, yy) => {
    expect(shortAccYear(accYear)).toBe(yy);
  });

  it.each(['2026-27', '2026', 'FY2026-2027', ''])('shortAccYear(%p) is null', (accYear) => {
    expect(shortAccYear(accYear)).toBeNull();
  });

  it('is a known token', () => {
    expect(scanFormatTokens('RT/{YY}/{BR}/')).toEqual({ names: ['YY', 'BR'], unknown: undefined });
    expect(scanFormatTokens('RT/{QQ}/').unknown).toBe('QQ');
  });

  it('expands {YY} without reading the branch', async () => {
    const { tx, client } = makeTx();

    await expect(
      expandVoucherFormat(
        client,
        { vchrTypeId: 70, branchId: BRANCH_ID, accYear: '2026-2027' },
        {
          prefix: 'RT/{YY}/',
          suffix: '-{YY}',
          noWidth: 4,
        },
      ),
    ).resolves.toEqual({ prefix: 'RT/26-27/', suffix: '-26-27', noWidth: 4 });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('expands {YY}, {FY} and {BR} together', async () => {
    const { client } = makeTx({ branchCode: 'CBE' });

    await expect(
      expandVoucherFormat(
        client,
        { vchrTypeId: 70, branchId: BRANCH_ID, accYear: '2026-2027' },
        {
          prefix: '{BR}/{YY}/',
          suffix: '/{FY}',
          noWidth: 3,
        },
      ),
    ).resolves.toEqual({ prefix: 'CBE/26-27/', suffix: '/2026-2027', noWidth: 3 });
  });

  it('refuses 422 SEQUENCE_FORMAT_TOKEN_UNKNOWN (token YY) for an accYear not shaped NNNN-NNNN', async () => {
    const { client } = makeTx();

    const result = expandVoucherFormat(
      client,
      { vchrTypeId: 70, branchId: BRANCH_ID, accYear: '2026-27' },
      {
        prefix: 'RT/{YY}/',
        suffix: null,
        noWidth: 4,
      },
    );

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject({
      response: {
        errors: [
          { field: 'vchrTypeId', code: 'SEQUENCE_FORMAT_TOKEN_UNKNOWN', params: { token: 'YY' } },
        ],
      },
    });
  });

  it('opens a counter with the {YY} snapshot', async () => {
    const { tx, client } = makeTx({ type: { vchrGstSide: null, vchrParentId: null } });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({
      lastNo: BigInt(1),
      refno: 'RT/26-27/00001',
    });
    expect(tx.accVoucherSeq.create.mock.calls[0][0].data.voucherPrefix).toBe('RT/26-27/');
  });
});

describe('starting number', () => {
  it('opens a new counter at the type’s starting number', async () => {
    const { tx, client } = makeTx({ type: { vchrStartNo: 501, vchrGstSide: null } });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({
      lastNo: BigInt(501),
      refno: 'RT/26-27/00501',
    });
    expect(tx.accVoucherSeq.create.mock.calls[0][0].data.lastNo).toBe(BigInt(500));
  });

  it('never moves an existing counter to the starting number', async () => {
    const { tx, client } = makeTx({
      type: { vchrStartNo: 501, vchrGstSide: null },
      existing: seqRow({ lastNo: BigInt(7) }),
    });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({
      lastNo: BigInt(8),
    });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('builds the first number from the starting number at the width', () => {
    expect(firstVoucherNumber({ prefix: 'RT/', suffix: null, noWidth: 5 }, 42)).toBe('RT/00042');
    expect(firstVoucherNumber({ prefix: 'RT/', suffix: '/X', noWidth: 2 }, 1234)).toBe('RT/1234/X');
    expect(firstVoucherNumber({ prefix: null, suffix: null, noWidth: 3 })).toBe('001');
  });
});

describe('Method (vchr_numbering_mode)', () => {
  it('AUTO ignores a typed number and draws from the counter', async () => {
    const { tx, client } = makeTx({ type: { vchrGstSide: null } });

    const result = await allocateVoucherNumber(client, scope({ typedRefno: 'TYPED-1' }));

    expect(result).toEqual({ lastNo: BigInt(1), refno: 'RT/26-27/00001', periodKey: '2026-2027' });
    expect(tx.accVoucherSeq.create).toHaveBeenCalled();
  });

  it('MANUAL takes the typed number and leaves the counter untouched', async () => {
    const { tx, client } = makeTx({ type: { vchrNumberingMode: VoucherNumberingMode.MANUAL } });

    await expect(
      allocateVoucherNumber(client, scope({ typedRefno: '  INV-77 ' })),
    ).resolves.toEqual({
      lastNo: BigInt(0),
      refno: 'INV-77',
      periodKey: '2026-2027',
      typed: true,
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.accVoucherSeq.findFirst).not.toHaveBeenCalled();
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
    expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '   '])(
    'MANUAL with no typed number (%p) refuses 422 SEQUENCE_NUMBER_REQUIRED',
    async (typedRefno) => {
      const { tx, client } = makeTx({ type: { vchrNumberingMode: VoucherNumberingMode.MANUAL } });

      const result = allocateVoucherNumber(client, scope({ typedRefno }));

      await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(result).rejects.toMatchObject({
        response: { errors: [{ field: 'typedRefno', code: 'SEQUENCE_NUMBER_REQUIRED' }] },
      });
      expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
    },
  );

  it('AUTO_MANUAL takes a typed number when given', async () => {
    const { tx, client } = makeTx({
      type: { vchrNumberingMode: VoucherNumberingMode.AUTO_MANUAL },
    });

    await expect(
      allocateVoucherNumber(client, scope({ typedRefno: 'X/9' })),
    ).resolves.toMatchObject({
      refno: 'X/9',
      typed: true,
    });
    expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
  });

  it('AUTO_MANUAL draws from the counter when nothing is typed', async () => {
    const { tx, client } = makeTx({
      type: { vchrNumberingMode: VoucherNumberingMode.AUTO_MANUAL, vchrGstSide: null },
    });

    const result = await allocateVoucherNumber(client, scope({ typedRefno: '' }));

    expect(result).toEqual({ lastNo: BigInt(1), refno: 'RT/26-27/00001', periodKey: '2026-2027' });
    expect(tx.accVoucherSeq.update).toHaveBeenCalled();
  });

  it('refuses 400 SEQUENCE_REFNO_TOO_LONG for a typed number over 50', async () => {
    const { client } = makeTx({ type: { vchrNumberingMode: VoucherNumberingMode.MANUAL } });

    const result = allocateVoucherNumber(client, scope({ typedRefno: 'N'.repeat(51) }));

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({
      response: { errors: [{ field: 'typedRefno', code: 'SEQUENCE_REFNO_TOO_LONG' }] },
    });
  });
});

describe('GST 16 characters at counter creation (decision 35)', () => {
  it('opens a GST outward counter whose first number is exactly 16', async () => {
    // 'ZTCBE/26-27/' (12) + 4 digits = 16.
    const { result } = (() => {
      const t = makeTx({
        type: { vchrNoPrefix: 'ZT{BR}/{YY}/', vchrNoWidth: 4 },
        branchCode: 'CBE',
      });
      return { result: allocateVoucherNumber(t.client, scope()) };
    })();

    const { refno } = await result;
    expect(refno).toBe('ZTCBE/26-27/0001');
    expect(refno).toHaveLength(16);
  });

  it('refuses 422 SEQUENCE_REFNO_TOO_LONG with rule GST16 over 16, and writes nothing', async () => {
    // 'ZT/2026-2027/' (13) + 5 = 18.
    const { tx, client } = makeTx({ type: { vchrNoPrefix: 'ZT/{FY}/' } });

    const result = allocateVoucherNumber(client, scope());

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject({
      response: {
        errors: [
          {
            field: 'vchrTypeId',
            code: 'SEQUENCE_REFNO_TOO_LONG',
            rule: 'GST16',
            params: { sample: 'ZT/2026-2027/00001', len: '18' },
          },
        ],
      },
    });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('counts the starting number’s digits', async () => {
    // 'RT/26-27/' (9) + '1000000' (7) = 16 → fine; 10000000 (8) → 17.
    const ok = makeTx({ type: { vchrStartNo: 1000000, vchrNoWidth: 5 } });
    await expect(allocateVoucherNumber(ok.client, scope())).resolves.toMatchObject({
      refno: 'RT/26-27/1000000',
    });

    const over = makeTx({ type: { vchrStartNo: 10000000, vchrNoWidth: 5 } });
    await expect(allocateVoucherNumber(over.client, scope())).rejects.toMatchObject({
      response: { errors: [{ code: 'SEQUENCE_REFNO_TOO_LONG', rule: 'GST16' }] },
    });
  });

  it('leaves a non-GST type alone up to 50', async () => {
    const { client } = makeTx({
      type: { vchrNoPrefix: 'ZT/{FY}/', vchrGstSide: 'INPUT', vchrParentId: null },
    });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({
      refno: 'ZT/2026-2027/00001',
    });
  });

  it('never re-checks a counter that already exists', async () => {
    const { client } = makeTx({
      type: { vchrNoPrefix: 'ZT/{FY}/' },
      existing: seqRow({ voucherPrefix: 'ZT/2026-2027/', lastNo: BigInt(4) }),
    });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({
      refno: 'ZT/2026-2027/00005',
    });
  });
});

describe('{BR} at counter creation (decision 40: child types only)', () => {
  it('refuses 422 VT_BR_REQUIRED for a child GST type with no {BR} where branches share the GSTIN', async () => {
    const { tx, client } = makeTx({
      type: { vchrNoPrefix: 'RT/{YY}/', vchrParentId: 3 },
      sharing: 4,
    });

    const result = allocateVoucherNumber(client, scope());

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject({
      response: { errors: [{ field: 'vchrTypeId', code: 'VT_BR_REQUIRED' }] },
    });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('opens the child counter when the branch has its own GSTIN', async () => {
    const { client } = makeTx({ type: { vchrNoPrefix: 'RT/{YY}/', vchrParentId: 3 }, sharing: 1 });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({
      refno: 'RT/26-27/00001',
    });
  });

  it('does not ask the branches when the child prints {BR}', async () => {
    const { tx, client } = makeTx({
      type: { vchrNoPrefix: '{BR}/{YY}/', vchrParentId: 3 },
      sharing: 4,
    });

    await expect(allocateVoucherNumber(client, scope())).resolves.toMatchObject({
      refno: 'CBE/26-27/00001',
    });
    expect(sharingCalls(tx.$queryRaw)).toHaveLength(0);
  });

  it('never refuses a BASE type for {BR} at counter creation (type 3 bil on Acme)', async () => {
    const { tx, client } = makeTx({
      type: { vchrTypeId: 3, vchrNoPrefix: 'bil', vchrParentId: null, vchrGstSide: 'OUTPUT' },
      sharing: 4,
    });

    await expect(allocateVoucherNumber(client, scope({ vchrTypeId: 3 }))).resolves.toMatchObject({
      refno: 'bil00001',
    });
    expect(sharingCalls(tx.$queryRaw)).toHaveLength(0);
  });

  it('formatHasBranchToken reads the raw prefix and suffix', () => {
    expect(formatHasBranchToken('RT/{BR}/', null)).toBe(true);
    expect(formatHasBranchToken('RT/', '-{BR}')).toBe(true);
    expect(formatHasBranchToken('RT/{YY}/', null)).toBe(false);
    expect(formatHasBranchToken(null, null)).toBe(false);
  });
});

describe('previewNextVoucherNumber', () => {
  it('shows the next number of an existing counter without drawing it', async () => {
    const { tx, client } = makeTx({ existing: seqRow({ lastNo: BigInt(41) }) });

    await expect(previewNextVoucherNumber(client, scope())).resolves.toEqual({
      refno: 'RT/26-27/00042',
      code: null,
    });
    expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('shows the first number of a counter not opened yet, from the starting number', async () => {
    const { tx, client } = makeTx({ type: { vchrStartNo: 9 } });

    await expect(previewNextVoucherNumber(client, scope())).resolves.toEqual({
      refno: 'RT/26-27/00009',
      code: null,
    });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('answers null with the refusal code when the counter could not open', async () => {
    const { client } = makeTx({ type: { vchrNoPrefix: 'ZT/{FY}/' } });

    await expect(previewNextVoucherNumber(client, scope())).resolves.toEqual({
      refno: null,
      code: 'SEQUENCE_REFNO_TOO_LONG',
    });
  });

  it('answers null for a type numbered by hand', async () => {
    const { client } = makeTx({ type: { vchrNumberingMode: VoucherNumberingMode.MANUAL } });

    await expect(previewNextVoucherNumber(client, scope())).resolves.toEqual({
      refno: null,
      code: 'SEQUENCE_NUMBER_REQUIRED',
    });
  });
});
