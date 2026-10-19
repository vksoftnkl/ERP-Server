import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DcFulfilmentService } from './dc-fulfilment.service';

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46af01';
const DC_A = '019c6f6c-be87-7a11-8905-36092c46afa1';
const DC_B = '019c6f6c-be87-7a11-8905-36092c46afb2';
const NOW = new Date('2026-10-19T06:00:00.000Z');

describe('DcFulfilmentService', () => {
  const service = new DcFulfilmentService({} as PrismaService);

  it('lists the challans a bill drew on, with the char(9) year trimmed', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      { sdi_dc_id: DC_A, sdi_acc_year: '2026-2027' },
      { sdi_dc_id: DC_B, sdi_acc_year: '2025-2026 ' },
    ]);

    const refs = await service.dcRefsOfBill(
      { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient,
      BILL_ID,
      '2026-2027',
    );

    expect(refs).toEqual([
      { dcId: DC_A, accYear: '2026-2027' },
      { dcId: DC_B, accYear: '2025-2026' },
    ]);
    expect(queryRaw.mock.calls[0].slice(1)).toEqual([BILL_ID, '2026-2027']);
  });

  it('re-derives each challan once — lines, line status, then the header', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient;

    await service.recompute(
      tx,
      [
        { dcId: DC_A, accYear: '2026-2027' },
        { dcId: DC_A, accYear: '2026-2027' },
        { dcId: DC_B, accYear: '2026-2027' },
      ],
      'actor',
      NOW,
    );

    const statements = executeRaw.mock.calls.map(([strings]) => {
      const sql = (strings as TemplateStringsArray).join('?');
      if (sql.includes('sdc_fulfil_status')) return 'header';
      if (sql.includes('sdi_line_status = CASE')) return 'status';
      return 'quantities';
    });
    expect(statements).toEqual([
      'quantities',
      'status',
      'header',
      'quantities',
      'status',
      'header',
    ]);
    const dcOf = (call: unknown[]) => call.find((v) => v === DC_A || v === DC_B);
    expect(executeRaw.mock.calls.map(dcOf)).toEqual([DC_A, DC_A, DC_A, DC_B, DC_B, DC_B]);
  });

  it('treats the same challan in another year as another challan', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);

    await service.recompute(
      { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
      [
        { dcId: DC_A, accYear: '2025-2026' },
        { dcId: DC_A, accYear: '2026-2027' },
      ],
      'actor',
      NOW,
    );

    expect(executeRaw).toHaveBeenCalledTimes(6);
  });
});
