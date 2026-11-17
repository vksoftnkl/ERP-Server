import { UnprocessableEntityException } from '@nestjs/common';
import { AccVoucherSeq, Prisma, VoucherNumberingMode, VoucherResetFreq } from '@prisma/client';
import {
  VoucherNumberScope,
  allocateVoucherNumber,
  assertCounterRules,
  assertGstDocNumber,
  compactAccYear,
  expandVoucherFormat,
  formatHasDeviceToken,
  isDeviceWideSeries,
  isSharedDeviceCode,
  longestLiveDeviceCode,
  previewNextVoucherNumber,
  scanFormatTokens,
} from './voucher-sequence.helper';

/**
 * Challan plan §5.1 / decisions 31–32 (Shared/Prathap/sales/plan-dc-dc-return-2026-11-16.md):
 * the {FYC} / {DV} tokens, {DV} refused on the shared MAIN counter, the {DV} preview with the
 * company's longest live device code, and GST16 for vchr_gst_doc_no types at counter creation
 * AND at every draw (rule GST16_DEVICE / GST16_CHARS). Formats with no '{' behave as before.
 */

const SEQ_ID = '019f0000-0000-7000-8000-0000000000d1';
const COMPANY_ID = '019f0000-0000-7000-8000-0000000000d2';
const BRANCH_ID = '019f0000-0000-7000-8000-0000000000d3';

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
  vchrGstDocNo: boolean;
}

/** Type 19 DCh as P1 left it on dev. */
const typeRow = (overrides: Partial<TypeRow> = {}): TypeRow => ({
  vchrTypeId: 19,
  vchrNoPrefix: 'DC{FYC}{DV}-',
  vchrNoSuffix: null,
  vchrNoWidth: 5,
  vchrResetFreq: VoucherResetFreq.YEARLY,
  vchrStartNo: 1,
  vchrNumberingMode: VoucherNumberingMode.AUTO,
  vchrGstSide: null,
  vchrParentId: null,
  vchrGstDocNo: true,
  ...overrides,
});

const seqRow = (overrides: Partial<AccVoucherSeq> = {}): AccVoucherSeq =>
  ({
    id: SEQ_ID,
    vchrTypeId: 19,
    voucherPrefix: 'DC2627D14-',
    voucherSuffix: null,
    noWidth: 5,
    lastNo: BigInt(0),
    deviceCode: 'D14',
    isActive: true,
    isDeleted: false,
    ...overrides,
  }) as AccVoucherSeq;

const sqlOf = (strings: unknown): string => (Array.isArray(strings) ? strings.join('?') : '');

const ANCHOR_BRANCH_ID = '019f0000-0000-7000-8000-0000000000d4';

const makeTx = (
  options: {
    type?: Partial<TypeRow>;
    existing?: AccVoucherSeq | null;
    /** What longestLiveDeviceCode reads; null = no live device. */
    longestDevice?: string | null;
  } = {},
) => {
  // The counter rows, by device code: findFirst / create / update act on them.
  const rows = new Map<string, AccVoucherSeq>();
  if (options.existing) {
    rows.set(options.existing.deviceCode ?? 'D14', options.existing);
  }
  const byId = (id: unknown) => [...rows.values()].find((r) => r.id === id) ?? null;
  const tx = {
    accVoucherType: {
      findFirst: jest.fn(async () => typeRow(options.type)),
    },
    accVoucherSeq: {
      findFirst: jest.fn(async (args?: { where: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        if (options.existing && !('deviceCode' in where)) {
          return options.existing;
        }
        const r = rows.get(String(where.deviceCode ?? ''));
        // A per-branch lookup (findOrCreateSequence) sees only its own branch's row.
        if (r && 'branchId' in where && r.branchId && where.branchId !== r.branchId) {
          return null;
        }
        // A test's one `existing` row stands for whatever scope is asked.
        return r ?? (options.existing && rows.size === 1 ? (rows.values().next().value ?? null) : null);
      }),
      create: jest.fn(async (args: { data: Partial<AccVoucherSeq> }) => {
        const r = seqRow({ ...args.data, id: `${SEQ_ID}-${String(args.data.deviceCode)}` });
        rows.set(String(args.data.deviceCode), r);
        return r;
      }),
      update: jest.fn(
        async (args: {
          where: { id: string };
          data: { lastNo?: { increment: number } } & Record<string, unknown>;
        }) => {
          const r = byId(args.where.id);
          if (!r) {
            return null;
          }
          const next = args.data.lastNo
            ? { ...r, lastNo: r.lastNo + BigInt(args.data.lastNo.increment) }
            : { ...r, ...(args.data as Partial<AccVoucherSeq>) };
          rows.set(r.deviceCode, next as AccVoucherSeq);
          return next;
        },
      ),
    },
    company: { findFirst: jest.fn(async () => ({ compCode: 'ZTA' })) },
    branchMaster: { findFirst: jest.fn(async () => ({ brCode: 'CBE' })) },
    $queryRaw: jest.fn(async (strings: unknown) => {
      const sql = sqlOf(strings);
      if (sql.includes('fixed.device_master')) {
        return options.longestDevice === null || options.longestDevice === undefined
          ? []
          : [{ dev_code: options.longestDevice }];
      }
      if (sql.includes('br_created_on')) {
        return [{ br_id: ANCHOR_BRANCH_ID }];
      }
      if (sql.includes('AS sharing')) {
        return [{ sharing: 4 }];
      }
      if (sql.includes('branch_master')) {
        return [{ code: 'CBE' }];
      }
      return [{ locked: 1 }];
    }),
  };
  return { tx, rows, client: tx as unknown as Prisma.TransactionClient };
};

const scope = (overrides: Partial<VoucherNumberScope> = {}): VoucherNumberScope => ({
  vchrTypeId: 19,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: '2026-2027',
  deviceCode: 'D14',
  documentDate: new Date('2026-11-16T00:00:00.000Z'),
  ...overrides,
});

const deviceQueries = (queryRaw: jest.Mock) =>
  queryRaw.mock.calls.filter(([strings]) => sqlOf(strings).includes('fixed.device_master'));

const refusal = (code: string, extra: Record<string, unknown> = {}) => ({
  response: { errors: [expect.objectContaining({ field: 'vchrTypeId', code, ...extra })] },
});

describe('{FYC} and {DV} tokens', () => {
  it.each([
    ['2026-2027', '2627'],
    ['1999-2000', '9900'],
    [' 2030-2031 ', '3031'],
  ])('compactAccYear(%p) = %p', (accYear, fyc) => {
    expect(compactAccYear(accYear)).toBe(fyc);
  });

  it.each(['2026-27', '2026', ''])('compactAccYear(%p) is null', (accYear) => {
    expect(compactAccYear(accYear)).toBeNull();
  });

  it('are known tokens', () => {
    expect(scanFormatTokens('DC{FYC}{DV}-')).toEqual({ names: ['FYC', 'DV'], unknown: undefined });
    expect(scanFormatTokens('DC{FYQ}-').unknown).toBe('FYQ');
    expect(formatHasDeviceToken('DC{FYC}{DV}-', null)).toBe(true);
    expect(formatHasDeviceToken('DC-', '/{DV}')).toBe(true);
    expect(formatHasDeviceToken('DC{FYC}-', null)).toBe(false);
  });

  it('treats blank and MAIN (any case) as the shared counter', () => {
    expect(isSharedDeviceCode(undefined)).toBe(true);
    expect(isSharedDeviceCode('  ')).toBe(true);
    expect(isSharedDeviceCode('main')).toBe(true);
    expect(isSharedDeviceCode('D14')).toBe(false);
  });

  it('expands {FYC}{DV} with the counter’s device code, without a query', async () => {
    const { tx, client } = makeTx();

    await expect(
      expandVoucherFormat(
        client,
        { vchrTypeId: 19, branchId: BRANCH_ID, accYear: '2026-2027', deviceCode: ' D14 ' },
        { prefix: 'DC{FYC}{DV}-', suffix: null, noWidth: 5 },
      ),
    ).resolves.toEqual({ prefix: 'DC2627D14-', suffix: null, noWidth: 5 });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('refuses 422 SEQUENCE_FORMAT_TOKEN_UNKNOWN (token FYC) for an accYear not shaped NNNN-NNNN', async () => {
    const { client } = makeTx();

    const result = expandVoucherFormat(
      client,
      { vchrTypeId: 19, branchId: BRANCH_ID, accYear: '2026-27', deviceCode: 'D14' },
      { prefix: 'DC{FYC}{DV}-', suffix: null, noWidth: 5 },
    );

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject(
      refusal('SEQUENCE_FORMAT_TOKEN_UNKNOWN', { params: { token: 'FYC' } }),
    );
  });

  it.each([undefined, null, '', 'MAIN', 'main'])(
    'refuses {DV} on the shared counter (deviceCode %p): SEQUENCE_FORMAT_TOKEN_UNKNOWN token DV',
    async (deviceCode) => {
      const { client } = makeTx();

      const result = expandVoucherFormat(
        client,
        { vchrTypeId: 19, branchId: BRANCH_ID, accYear: '2026-2027', deviceCode },
        { prefix: 'DC{FYC}{DV}-', suffix: null, noWidth: 5 },
      );

      await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(result).rejects.toMatchObject(
        refusal('SEQUENCE_FORMAT_TOKEN_UNKNOWN', { params: { token: 'DV' } }),
      );
    },
  );
});

describe('a challan counter per device (allocateVoucherNumber)', () => {
  it('opens the D14 counter at DC2627D14-00001 (15 characters)', async () => {
    const { tx, client } = makeTx();

    const result = await allocateVoucherNumber(client, scope());

    expect(result).toEqual({ lastNo: BigInt(1), refno: 'DC2627D14-00001', periodKey: '2026-2027' });
    expect(result.refno).toHaveLength(15);
    expect(tx.accVoucherSeq.create.mock.calls[0][0].data).toMatchObject({
      vchrTypeId: 19,
      deviceCode: 'D14',
      periodKey: '2026-2027',
      voucherPrefix: 'DC2627D14-',
      lastNo: BigInt(0),
    });
  });

  it('refuses a {DV} type drawn on the shared MAIN counter, and writes nothing', async () => {
    const { tx, client } = makeTx();

    const result = allocateVoucherNumber(client, scope({ deviceCode: undefined }));

    await expect(result).rejects.toMatchObject(
      refusal('SEQUENCE_FORMAT_TOKEN_UNKNOWN', { params: { token: 'DV' } }),
    );
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
    expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
  });

  it('opens a 4-character device at exactly 16 (DC2627D999-00001)', async () => {
    const { client } = makeTx();

    const { refno } = await allocateVoucherNumber(client, scope({ deviceCode: 'D999' }));

    expect(refno).toBe('DC2627D999-00001');
    expect(refno).toHaveLength(16);
  });

  it('refuses a 5-character device at counter creation: 422 rule GST16_DEVICE, nothing written', async () => {
    const { tx, client } = makeTx();

    const result = allocateVoucherNumber(client, scope({ deviceCode: 'D1000' }));

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject(
      refusal('SEQUENCE_REFNO_TOO_LONG', {
        rule: 'GST16_DEVICE',
        params: { sample: 'DC2627D1000-00001', len: '17' },
      }),
    );
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
    expect(tx.accVoucherSeq.update).not.toHaveBeenCalled();
  });

  it('refuses a device code with "_" at counter creation: 422 rule GST16_CHARS', async () => {
    const { tx, client } = makeTx();

    const result = allocateVoucherNumber(client, scope({ deviceCode: 'ZT_A' }));

    await expect(result).rejects.toMatchObject(
      refusal('SEQUENCE_REFNO_TOO_LONG', {
        rule: 'GST16_CHARS',
        params: { sample: 'DC2627ZT_A-00001' },
      }),
    );
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('draws the 99,999th number at 16 on a 4-character device', async () => {
    const { client } = makeTx({
      existing: seqRow({ voucherPrefix: 'DC2627D999-', lastNo: BigInt(99998) }),
    });

    await expect(
      allocateVoucherNumber(client, scope({ deviceCode: 'D999' })),
    ).resolves.toMatchObject({ refno: 'DC2627D999-99999' });
  });

  it('refuses the draw that grows to 17 (the 100,000th): rule GST16_DEVICE, no refno written', async () => {
    const { tx, client } = makeTx({
      existing: seqRow({ voucherPrefix: 'DC2627D999-', lastNo: BigInt(99999) }),
    });

    const result = allocateVoucherNumber(client, scope({ deviceCode: 'D999' }));

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toMatchObject(
      refusal('SEQUENCE_REFNO_TOO_LONG', {
        rule: 'GST16_DEVICE',
        params: { sample: 'DC2627D999-100000', len: '17' },
      }),
    );
    // Only the increment ran (the caller's transaction rolls it back); seq_last_refno was not written.
    expect(tx.accVoucherSeq.update).toHaveBeenCalledTimes(1);
    expect(tx.accVoucherSeq.update.mock.calls[0][0].data).not.toHaveProperty('lastRefno');
  });

  it('refuses a draw from a counter whose snapshot holds a character GST does not allow', async () => {
    const { client } = makeTx({
      existing: seqRow({ voucherPrefix: 'DC_', lastNo: BigInt(4) }),
    });

    await expect(allocateVoucherNumber(client, scope())).rejects.toMatchObject(
      refusal('SEQUENCE_REFNO_TOO_LONG', { rule: 'GST16_CHARS', params: { sample: 'DC_00005' } }),
    );
  });

  it('still draws the old MAIN counter of type 19 (dc00016), which never expands again', async () => {
    const { tx, client } = makeTx({
      existing: seqRow({ voucherPrefix: 'dc', lastNo: BigInt(15) }),
    });

    await expect(
      allocateVoucherNumber(client, scope({ deviceCode: undefined })),
    ).resolves.toMatchObject({ lastNo: BigInt(16), refno: 'dc00016' });
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('applies the GST16_DEVICE rule (not GST16) to a type both outward and a GST document', async () => {
    const { client } = makeTx({ type: { vchrGstSide: 'OUTPUT' } });

    await expect(
      allocateVoucherNumber(client, scope({ deviceCode: 'D1000' })),
    ).rejects.toMatchObject(refusal('SEQUENCE_REFNO_TOO_LONG', { rule: 'GST16_DEVICE' }));
  });
});

describe('one series per PC (user 11-16): a device-wide type at every branch', () => {
  const OTHER_BRANCH_ID = '019f0000-0000-7000-8000-0000000000d5';

  it('files the first counter under the company\'s anchor branch, not the document\'s', async () => {
    const { tx, client } = makeTx();

    await allocateVoucherNumber(client, scope({ branchId: OTHER_BRANCH_ID }));

    expect(tx.accVoucherSeq.create.mock.calls[0][0].data).toMatchObject({
      branchId: ANCHOR_BRANCH_ID,
      deviceCode: 'D14',
    });
  });

  it('continues ONE series when the same PC posts for two branches: no repeated number', async () => {
    const { tx, client } = makeTx();

    const first = await allocateVoucherNumber(client, scope({ branchId: BRANCH_ID }));
    const second = await allocateVoucherNumber(client, scope({ branchId: OTHER_BRANCH_ID }));
    const third = await allocateVoucherNumber(client, scope({ branchId: BRANCH_ID }));

    expect([first.refno, second.refno, third.refno]).toEqual([
      'DC2627D14-00001',
      'DC2627D14-00002',
      'DC2627D14-00003',
    ]);
    expect(tx.accVoucherSeq.create).toHaveBeenCalledTimes(1);
  });

  it('gives two PCs two series, each from 00001', async () => {
    const { tx, client } = makeTx();

    const a1 = await allocateVoucherNumber(client, scope({ deviceCode: 'D3' }));
    const b1 = await allocateVoucherNumber(client, scope({ deviceCode: 'D4' }));
    const a2 = await allocateVoucherNumber(client, scope({ deviceCode: 'D3', branchId: OTHER_BRANCH_ID }));

    expect([a1.refno, b1.refno, a2.refno]).toEqual([
      'DC2627D3-00001',
      'DC2627D4-00001',
      'DC2627D3-00002',
    ]);
    expect(tx.accVoucherSeq.create).toHaveBeenCalledTimes(2);
  });

  it('locks the series on one key whatever branch the document is for', async () => {
    const a = makeTx();
    await allocateVoucherNumber(a.client, scope({ branchId: BRANCH_ID }));
    const b = makeTx();
    await allocateVoucherNumber(b.client, scope({ branchId: OTHER_BRANCH_ID }));

    const lockKeys = (q: jest.Mock) =>
      q.mock.calls
        .filter(([strings]) => sqlOf(strings).includes('pg_advisory_xact_lock'))
        .map((call) => call.slice(1).join('|'));
    expect(lockKeys(a.tx.$queryRaw)).toEqual(lockKeys(b.tx.$queryRaw));
    expect(lockKeys(a.tx.$queryRaw).join()).toContain('*device-series*');
  });

  it('is a rule of the type: vchr_gst_doc_no + {DV} + no {BR}, never the shared counter', () => {
    expect(isDeviceWideSeries({ vchrGstDocNo: true, vchrNoPrefix: 'DC{FYC}{DV}-', vchrNoSuffix: null })).toBe(true);
    expect(isDeviceWideSeries({ vchrGstDocNo: true, vchrNoPrefix: 'DC{FYC}{DV}-', vchrNoSuffix: null }, 'MAIN')).toBe(false);
    expect(isDeviceWideSeries({ vchrGstDocNo: true, vchrNoPrefix: 'DC{BR}{DV}-', vchrNoSuffix: null })).toBe(false);
    expect(isDeviceWideSeries({ vchrGstDocNo: false, vchrNoPrefix: 'DC{FYC}{DV}-', vchrNoSuffix: null })).toBe(false);
    expect(isDeviceWideSeries({ vchrGstDocNo: true, vchrNoPrefix: 'dc', vchrNoSuffix: null })).toBe(false);
  });

  it('keeps a per-branch series for a type that is not device-wide', async () => {
    const { tx, client } = makeTx({ type: { vchrNoPrefix: 'STK/{DV}/', vchrGstDocNo: false } });

    await allocateVoucherNumber(client, scope({ branchId: OTHER_BRANCH_ID, deviceCode: 'D3' }));

    expect(tx.accVoucherSeq.create.mock.calls[0][0].data).toMatchObject({ branchId: OTHER_BRANCH_ID });
  });

  it('previews the device\'s series found at any branch', async () => {
    const { client } = makeTx({
      existing: seqRow({ voucherPrefix: 'DC2627D14-', lastNo: BigInt(41), branchId: ANCHOR_BRANCH_ID }),
    });

    await expect(
      previewNextVoucherNumber(client, scope({ branchId: OTHER_BRANCH_ID })),
    ).resolves.toEqual({ refno: 'DC2627D14-00042', code: null });
  });

  it('marks the DV refusal with the wording rule DEVICE_COUNTER', async () => {
    const { client } = makeTx();

    await expect(allocateVoucherNumber(client, scope({ deviceCode: undefined }))).rejects.toMatchObject(
      refusal('SEQUENCE_FORMAT_TOKEN_UNKNOWN', { rule: 'DEVICE_COUNTER', params: { token: 'DV' } }),
    );
  });
});

describe('formats with no "{" and types not flagged behave as before', () => {
  it('expandVoucherFormat hands a plain format back as it is, without a query', async () => {
    const { tx, client } = makeTx();
    const format = { prefix: 'dc', suffix: null, noWidth: 5 };

    await expect(
      expandVoucherFormat(
        client,
        { vchrTypeId: 19, branchId: BRANCH_ID, accYear: '2026-2027', deviceCode: undefined },
        format,
      ),
    ).resolves.toBe(format);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('opens a plain counter on MAIN with no device query', async () => {
    const { tx, client } = makeTx({
      type: { vchrNoPrefix: 'dc', vchrGstDocNo: false },
    });

    await expect(
      allocateVoucherNumber(client, scope({ deviceCode: undefined })),
    ).resolves.toMatchObject({ refno: 'dc00001' });
    expect(deviceQueries(tx.$queryRaw)).toHaveLength(0);
  });

  it('does not check the draws of a type that is not flagged (25 characters is fine)', async () => {
    const { client } = makeTx({
      type: { vchrNoPrefix: 'X', vchrGstDocNo: false },
      existing: seqRow({ voucherPrefix: 'LONG_PREFIX_OF_20_CHR', lastNo: BigInt(1) }),
    });

    await expect(
      allocateVoucherNumber(client, scope({ deviceCode: undefined })),
    ).resolves.toMatchObject({ refno: 'LONG_PREFIX_OF_20_CHR00002' });
  });

  it('prints {DV} for a non-GST type with a device, unchecked up to 50', async () => {
    const { client } = makeTx({
      type: { vchrNoPrefix: 'STK/{FY}/{DV}/', vchrGstDocNo: false },
    });

    await expect(
      allocateVoucherNumber(client, scope({ deviceCode: 'D1000' })),
    ).resolves.toMatchObject({ refno: 'STK/2026-2027/D1000/00001' });
  });
});

describe('assertCounterRules / assertGstDocNumber (the /sequences/create path)', () => {
  it('refuses a typed {DV} format on a 5-character device for a GST document type', async () => {
    const { client } = makeTx();

    await expect(
      assertCounterRules(
        client,
        { vchrTypeId: 19, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: '2026-2027' },
        { vchrNoPrefix: 'DC{FYC}{DV}-', vchrNoSuffix: null, vchrGstSide: null, vchrGstDocNo: true },
        { prefix: 'DC2627ZTA-5-', suffix: null, noWidth: 5 },
        1,
      ),
    ).rejects.toMatchObject(
      refusal('SEQUENCE_REFNO_TOO_LONG', {
        rule: 'GST16_DEVICE',
        params: { sample: 'DC2627ZTA-5-00001', len: '17' },
      }),
    );
  });

  it('passes a type that is neither outward nor flagged, whatever its length', async () => {
    const { client } = makeTx();

    await expect(
      assertCounterRules(
        client,
        { vchrTypeId: 19, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: '2026-2027' },
        { vchrNoPrefix: 'x', vchrNoSuffix: null },
        { prefix: 'A_VERY_LONG_PREFIX/', suffix: null, noWidth: 5 },
        1,
      ),
    ).resolves.toBeUndefined();
  });

  it('judges the length before the characters', () => {
    expect(() => assertGstDocNumber('DC2627ZT_A9-00001', 19, 'counter')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errors: [expect.objectContaining({ rule: 'GST16_DEVICE' })],
        }),
      }),
    );
    expect(() => assertGstDocNumber('DC2627D14-00001', 19, 'draw')).not.toThrow();
    expect(() => assertGstDocNumber('DC/26-27/D1-001', 19, 'draw')).not.toThrow();
  });
});

describe('the {DV} preview (previewNextVoucherNumber)', () => {
  it('shows a {DV} type with no device as the longest live device code would number it', async () => {
    const { tx, client } = makeTx({ longestDevice: 'D14' });

    await expect(
      previewNextVoucherNumber(client, scope({ deviceCode: undefined })),
    ).resolves.toEqual({ refno: 'DC2627D14-00001', code: null });
    expect(deviceQueries(tx.$queryRaw)).toHaveLength(1);
    expect(tx.accVoucherSeq.findFirst.mock.calls[0][0]?.where.deviceCode).toBe('D14');
    expect(tx.accVoucherSeq.create).not.toHaveBeenCalled();
  });

  it('shows the next number of that device’s counter when it is open', async () => {
    const { client } = makeTx({
      longestDevice: 'D14',
      existing: seqRow({ voucherPrefix: 'DC2627D14-', lastNo: BigInt(14) }),
    });

    await expect(previewNextVoucherNumber(client, scope({ deviceCode: 'MAIN' }))).resolves.toEqual({
      refno: 'DC2627D14-00015',
      code: null,
    });
  });

  it('uses the device given, with no device query', async () => {
    const { tx, client } = makeTx({ longestDevice: 'D14' });

    await expect(previewNextVoucherNumber(client, scope({ deviceCode: 'D3' }))).resolves.toEqual({
      refno: 'DC2627D3-00001',
      code: null,
    });
    expect(deviceQueries(tx.$queryRaw)).toHaveLength(0);
  });

  it('answers the {DV} refusal code when no live device has a code', async () => {
    const { client } = makeTx({ longestDevice: null });

    await expect(
      previewNextVoucherNumber(client, scope({ deviceCode: undefined })),
    ).resolves.toEqual({ refno: null, code: 'SEQUENCE_FORMAT_TOKEN_UNKNOWN' });
  });

  it('answers SEQUENCE_REFNO_TOO_LONG when the longest device code is 5 characters', async () => {
    const { client } = makeTx({ longestDevice: 'ZTA-5' });

    await expect(
      previewNextVoucherNumber(client, scope({ deviceCode: undefined })),
    ).resolves.toEqual({ refno: null, code: 'SEQUENCE_REFNO_TOO_LONG' });
  });

  it('answers SEQUENCE_REFNO_TOO_LONG when the open counter’s next draw would pass 16', async () => {
    const { client } = makeTx({
      existing: seqRow({ voucherPrefix: 'DC2627D999-', lastNo: BigInt(99999) }),
    });

    await expect(previewNextVoucherNumber(client, scope({ deviceCode: 'D999' }))).resolves.toEqual({
      refno: null,
      code: 'SEQUENCE_REFNO_TOO_LONG',
    });
  });

  it('never asks for devices for a type without {DV}', async () => {
    const { tx, client } = makeTx({ type: { vchrNoPrefix: 'dc', vchrGstDocNo: false } });

    await expect(
      previewNextVoucherNumber(client, scope({ deviceCode: undefined })),
    ).resolves.toEqual({ refno: 'dc00001', code: null });
    expect(deviceQueries(tx.$queryRaw)).toHaveLength(0);
  });
});

describe('longestLiveDeviceCode', () => {
  it('reads live devices of the company and of no company, longest first', async () => {
    const { tx, client } = makeTx({ longestDevice: ' D14 ' });

    await expect(longestLiveDeviceCode(client, COMPANY_ID)).resolves.toBe('D14');
    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [string[], ...unknown[]];
    const sql = strings.join('?');
    expect(sql).toContain('dev_is_deleted = false');
    expect(sql).toContain('dev_is_active = true');
    expect(sql).toContain('dev_company_id IS NULL');
    expect(sql).toContain('ORDER BY length(btrim(dev_code)) DESC');
    expect(values).toContain(COMPANY_ID);
  });

  it('is null when no live device has a code', async () => {
    const { client } = makeTx({ longestDevice: null });

    await expect(longestLiveDeviceCode(client, null)).resolves.toBeNull();
  });
});
