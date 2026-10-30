import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StockAdjReasonsService } from './stock-adj-reasons.service';
import { StockAdjReasonsErrorCode } from './types/stock-adj-reasons-error-codes';

const REASON_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const reasonRow = (overrides: Record<string, unknown> = {}) => ({
  sarId: REASON_ID,
  sarCode: 'DAMAGE',
  sarName: 'Damaged in store',
  sarReasonKind: 'LOSS',
  sarDefaultResolution: 'WRITE_OFF',
  sarAffectsAccounts: true,
  sarIsActive: true,
  sarIsDeleted: false,
  sarCreatedOn: CREATED_ON,
  sarCreatedBy: null,
  sarModifiedOn: null,
  sarModifiedBy: null,
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

describe('StockAdjReasonsService.get', () => {
  let findMany: jest.Mock;
  let service: StockAdjReasonsService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([reasonRow()]);
    service = new StockAdjReasonsService({
      stockAdjReason: { findMany },
    } as unknown as PrismaService);
  });

  const where = () => (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;

  it('defaults to active, non-deleted reasons ordered by code', async () => {
    const result = await service.get({});

    expect(where()).toEqual({ sarIsActive: true, sarIsDeleted: false });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ sarCode: 'asc' }, { sarId: 'asc' }] }),
    );
    expect(result.meta).toEqual({
      sarId: undefined,
      sarCode: undefined,
      sarReasonKind: undefined,
      activeOnly: true,
      includeDeleted: false,
      count: 1,
    });
  });

  it('drops both guards when asked for inactive and deleted rows too', async () => {
    await service.get({ activeOnly: false, includeDeleted: true });

    expect(where()).toEqual({});
  });

  it('matches code and kind case-insensitively', async () => {
    await service.get({ sarCode: 'damage', sarReasonKind: 'loss' });

    expect(where()).toMatchObject({
      sarCode: { equals: 'damage', mode: 'insensitive' },
      sarReasonKind: { equals: 'loss', mode: 'insensitive' },
    });
  });

  it('renders the dates as ISO text and keeps an unmodified row null', async () => {
    findMany.mockResolvedValue([
      reasonRow(),
      reasonRow({ sarModifiedOn: new Date('2026-10-05T00:00:00.000Z'), sarModifiedBy: 'u1' }),
    ]);

    const { items } = await service.get({});

    expect(items[0]).toMatchObject({
      sarCreatedOn: CREATED_ON.toISOString(),
      sarModifiedOn: null,
      sarModifiedBy: null,
    });
    expect(items[1]).toMatchObject({
      sarModifiedOn: '2026-10-05T00:00:00.000Z',
      sarModifiedBy: 'u1',
    });
  });

  it('refuses a sarId that names no reason', async () => {
    findMany.mockResolvedValue([]);

    const refusal = await refusalOf(service.get({ sarId: REASON_ID }));

    expect(refusal).toMatchObject({
      status: 404,
      body: { errors: [{ field: 'sarId', code: StockAdjReasonsErrorCode.NOT_FOUND }] },
    });
  });

  it('answers a code that matches nothing with an empty list, not a 404', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.get({ sarCode: 'NOPE' })).resolves.toMatchObject({
      items: [],
      meta: { count: 0 },
    });
  });
});
