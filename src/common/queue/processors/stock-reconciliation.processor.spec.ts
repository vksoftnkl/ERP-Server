import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import {
  assertStockBalances,
  type StockBalanceFinding,
} from '../../../modules/stocks/posting/stock-balance-assertion';
import {
  StockReconciliationJobData,
  StockReconciliationProcessor,
} from './stock-reconciliation.processor';

jest.mock('../../../modules/stocks/posting/stock-balance-assertion', () => ({
  assertStockBalances: jest.fn(),
}));

const assertMock = assertStockBalances as jest.MockedFunction<typeof assertStockBalances>;
const prisma = {} as PrismaService;

const finding = (overrides: Partial<StockBalanceFinding> = {}): StockBalanceFinding => ({
  kind: 'BALANCE_QTY',
  companyId: 'c1',
  branchId: 'b1',
  itemId: 'i1',
  lotId: null,
  godownId: null,
  bucket: null,
  stored: '5',
  derived: '4',
  ...overrides,
});

const jobOf = (data: StockReconciliationJobData) =>
  ({ data, updateProgress: jest.fn(async () => undefined) }) as unknown as Job<
    StockReconciliationJobData
  > & { updateProgress: jest.Mock };

describe('StockReconciliationProcessor', () => {
  const processor = new StockReconciliationProcessor(prisma);
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    assertMock.mockReset();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
    warn.mockRestore();
  });

  it('asserts the scope of the job, dropping accYear (balances are not per year)', async () => {
    assertMock.mockResolvedValue([]);

    await processor.process(
      jobOf({ accYear: '2026-2027', companyId: 'c1', branchId: 'b1', itemId: 'i1' }),
    );

    expect(assertMock).toHaveBeenCalledWith(prisma, {
      companyId: 'c1',
      branchId: 'b1',
      itemId: 'i1',
    });
  });

  it('reports a clean book and finishes the job', async () => {
    assertMock.mockResolvedValue([]);
    const job = jobOf({ companyId: 'c1' });

    await expect(processor.process(job)).resolves.toEqual({ findings: [], byKind: {} });

    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenLastCalledWith(
      'Stock balance assertion: every derived figure agrees with its source.',
    );
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  // Detect and report, never silently fix.
  it('returns every disagreement, counted by kind', async () => {
    const findings = [
      finding(),
      finding({ kind: 'RESERVED', itemId: 'i2' }),
      finding({ itemId: 'i3', lotId: 'l3', godownId: 'g3', bucket: 'DAMAGED' }),
    ];
    assertMock.mockResolvedValue(findings);

    await expect(processor.process(jobOf({ companyId: 'c1' }))).resolves.toEqual({
      findings,
      byKind: { BALANCE_QTY: 2, RESERVED: 1 },
    });

    expect(warn.mock.calls[0][0]).toBe(
      'Stock balance assertion found 3 disagreement(s): BALANCE_QTY=2, RESERVED=1',
    );
    expect(warn.mock.calls[1][0]).toBe('  BALANCE_QTY item i1 lot - godown - : stored 5, derived 4');
    expect(warn.mock.calls[3][0]).toBe(
      '  BALANCE_QTY item i3 lot l3 godown g3 DAMAGED: stored 5, derived 4',
    );
  });

  it('logs at most 50 findings but returns them all', async () => {
    const findings = Array.from({ length: 60 }, (_, i) => finding({ itemId: `i${i}` }));
    assertMock.mockResolvedValue(findings);

    const result = await processor.process(jobOf({ companyId: 'c1' }));

    expect(result.findings).toHaveLength(60);
    // One summary line plus 50 detail lines.
    expect(warn).toHaveBeenCalledTimes(51);
  });
});
