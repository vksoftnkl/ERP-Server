import { NotFoundException } from '@nestjs/common';
import { PrintRenderService } from './print-render.service';

/**
 * WhatsApp decision 16 — renderForWhatsApp: the WHATSAPP assignment, else PDF,
 * else PRINT; a PDF of one copy; NO print_log row; never throws.
 */
function harness(resolveByMode: Record<string, unknown>) {
  const prisma = {
    printPurpose: { findFirst: jest.fn().mockResolvedValue({ ppoId: 'pp', ppoDocType: 'SALES_ORDER' }) },
  };
  const assignments = {
    resolve: jest.fn(async ({ outputMode }: { outputMode: string }) => {
      const hit = resolveByMode[outputMode];
      if (!hit) throw new NotFoundException('none');
      return hit;
    }),
  };
  const printLog = { currentAccYear: jest.fn().mockResolvedValue('2026-2027'), record: jest.fn() };
  const service = new PrintRenderService(
    prisma as never,
    {} as never,
    assignments as never,
    printLog as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const internals = service as unknown as Record<string, jest.Mock>;
  internals.loadVersion = jest.fn().mockResolvedValue({
    template: { ptlCode: 'SALE_ORDER_A5' },
    version: { ptvParams: [{ name: 'as_on' }] },
    datasets: [],
  });
  internals.build = jest.fn().mockReturnValue({ definition: {}, layoutMode: 'GRAPHIC' });
  internals.renderDefinition = jest.fn().mockResolvedValue({ bytes: Buffer.from('%PDF-1.7'), versionId: 'rev-1' });
  return { service, assignments, printLog, internals };
}

const resolution = (mode: string) => ({ publishedRevId: `rev-${mode}`, ptaOutputMode: mode, copyLabels: ['ORIGINAL', 'DUPLICATE'] });
const request = {
  purposeCode: 'SALE_ORDER',
  context: { companyId: 'co', branchId: 'br', accYear: '2026-2027', docId: 'so', userId: null, deviceId: null },
  params: { as_on: '2026-11-17', not_declared: 'x' },
};

describe('PrintRenderService.renderForWhatsApp', () => {
  it('uses the WHATSAPP assignment when one resolves', async () => {
    const h = harness({ WHATSAPP: resolution('WHATSAPP'), PRINT: resolution('PRINT') });
    await expect(h.service.renderForWhatsApp(request)).resolves.toMatchObject({ ok: true, assignmentMode: 'WHATSAPP', versionId: 'rev-1' });
    expect(h.assignments.resolve).toHaveBeenCalledTimes(1);
  });
  it('falls back WHATSAPP → PDF → PRINT', async () => {
    const h = harness({ PRINT: resolution('PRINT') });
    await expect(h.service.renderForWhatsApp(request)).resolves.toMatchObject({ ok: true, assignmentMode: 'PRINT' });
    expect(h.assignments.resolve.mock.calls.map((c) => c[0].outputMode)).toEqual(['WHATSAPP', 'PDF', 'PRINT']);
  });
  it('renders a PDF of ONE copy with the first label, only the declared params, and writes no print_log row', async () => {
    const h = harness({ PDF: resolution('PDF') });
    await h.service.renderForWhatsApp(request);
    expect(h.internals.renderDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ requestedMode: 'PDF', copies: 1, copyLabels: ['ORIGINAL'], params: { as_on: '2026-11-17' } }),
    );
    expect(h.printLog.record).not.toHaveBeenCalled();
  });
  it('no assignment at any mode → NO_DESIGN; a roll (GRID) design → NO_DESIGN; a render error → FAILED', async () => {
    await expect(harness({}).service.renderForWhatsApp(request)).resolves.toMatchObject({ ok: false, reason: 'NO_DESIGN' });
    const grid = harness({ PRINT: resolution('PRINT') });
    grid.internals.build.mockReturnValue({ definition: {}, layoutMode: 'GRID' });
    await expect(grid.service.renderForWhatsApp(request)).resolves.toMatchObject({ ok: false, reason: 'NO_DESIGN' });
    const broken = harness({ PRINT: resolution('PRINT') });
    broken.internals.renderDefinition.mockRejectedValue(new Error('dataset failed'));
    await expect(broken.service.renderForWhatsApp(request)).resolves.toMatchObject({ ok: false, reason: 'FAILED', message: 'dataset failed' });
  });
});
