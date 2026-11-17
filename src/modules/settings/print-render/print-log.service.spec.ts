import { PrintLogEntry, PrintLogService } from './print-log.service';

/** PRINT_COUNTERS: the gate pass (doc type DELIVERY_NOTE) bumps sdn_print_count — delivery tracking P5. */
describe('PrintLogService print counters', () => {
  const entry = (over: Partial<PrintLogEntry> = {}): PrintLogEntry => ({
    accYear: '2026-2027',
    companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
    branchId: null,
    deviceId: null,
    srcModule: 'SALES',
    srcDocType: 'DELIVERY_NOTE',
    srcDocId: '01a1e303-8daa-7d8c-9275-f7f62f7107b4',
    srcAccYear: '2026-2027',
    purposeId: 'p',
    templateId: 't',
    versionId: 'v',
    printerId: null,
    outputMode: 'PRINT',
    copyNo: 1,
    copyLabel: 'GATE COPY',
    lang: 'en-IN',
    params: null,
    status: 'SUCCESS',
    error: null,
    pageCount: 1,
    byteCount: 10,
    durationMs: 1,
    printedBy: null,
    ...over,
  });

  const make = () => {
    const prisma = {
      printLog: { create: jest.fn(() => ({})) },
      $transaction: jest.fn(async (ops: unknown[]) => ops.map((_, i) => ({ plgId: `plg${i}` }))),
      $executeRaw: jest.fn(async () => 1),
    };
    return { log: new PrintLogService(prisma as never), prisma };
  };

  const sqlOf = (call: unknown[]) => {
    const q = call[0] as { sql?: string; strings?: string[]; values?: unknown[] };
    return { text: (q.sql ?? q.strings?.join('?') ?? '').replace(/\s+/g, ' '), values: q.values };
  };

  it('a PRINT of a gate pass bumps sdn_print_count once (copy 1 only)', async () => {
    const { log, prisma } = make();
    await log.record([entry(), entry({ copyNo: 2, copyLabel: 'DRIVER / CUSTOMER COPY' })]);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const { text, values } = sqlOf(prisma.$executeRaw.mock.calls[0] as unknown[]);
    expect(text).toContain(
      'UPDATE sales.sale_delivery_note SET sdn_print_count = sdn_print_count + 1',
    );
    expect(values).toEqual(['01a1e303-8daa-7d8c-9275-f7f62f7107b4', '2026-2027']);
  });

  it.each([
    [
      'DELIVERY_CHALLAN',
      'UPDATE sales.sale_dc SET sdc_print_count = sdc_print_count + 1',
      'sdc_acc_year',
    ],
    [
      'DC_RETURN',
      'UPDATE sales.sale_dc_return SET sdr_print_count = sdr_print_count + 1',
      'sdr_acc_year',
    ],
  ])(
    'Sales DC P5: a PRINT of a %s bumps its count once, by id and year (copy 1 only)',
    async (docType, update, yearCol) => {
      const { log, prisma } = make();
      const DOC = '01a1e7cb-c786-75fd-b973-21b78e6a7a0e';
      await log.record([
        entry({ srcDocType: docType, srcDocId: DOC, copyLabel: 'ORIGINAL' }),
        entry({ srcDocType: docType, srcDocId: DOC, copyNo: 2, copyLabel: 'DUPLICATE' }),
        entry({ srcDocType: docType, srcDocId: DOC, copyNo: 3, copyLabel: 'TRIPLICATE' }),
      ]);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const { text, values } = sqlOf(prisma.$executeRaw.mock.calls[0]);
      expect(text).toContain(update);
      expect(text).toContain(`${yearCol} = ?::char(9)`);
      expect(values).toEqual([DOC, '2026-2027']);
    },
  );

  it('a REPRINT of a challan counts too; a preview-only FILE does not', async () => {
    const { log, prisma } = make();
    await log.record([entry({ srcDocType: 'DELIVERY_CHALLAN', outputMode: 'REPRINT' })]);
    await log.record([entry({ srcDocType: 'DC_RETURN', outputMode: 'FILE' })]);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('a file save or a failed print does not count', async () => {
    const { log, prisma } = make();
    await log.record([entry({ outputMode: 'FILE' })]);
    await log.record([entry({ status: 'FAILED', error: 'x' })]);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
