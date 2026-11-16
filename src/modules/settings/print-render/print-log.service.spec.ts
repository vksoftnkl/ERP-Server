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
    expect(text).toContain('UPDATE sales.sale_delivery_note SET sdn_print_count = sdn_print_count + 1');
    expect(values).toEqual(['01a1e303-8daa-7d8c-9275-f7f62f7107b4', '2026-2027']);
  });

  it('a file save or a failed print does not count', async () => {
    const { log, prisma } = make();
    await log.record([entry({ outputMode: 'FILE' })]);
    await log.record([entry({ status: 'FAILED', error: 'x' })]);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
