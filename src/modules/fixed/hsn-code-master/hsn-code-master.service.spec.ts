import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { HsnCodeMasterService } from './hsn-code-master.service';
import { HsnCodeMasterErrorCode } from './types/hsn-code-master-error-codes';

const hsnRow = {
  hsnId: 12,
  hsnCode: '3004',
  hsnName: 'Medicaments',
  hsnDescription: null,
  hsnIsService: false,
  hsnUqc: 'NOS',
  hsnIsActive: true,
  hsnRateOfTax: new Prisma.Decimal('12.00'),
};

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

describe('HsnCodeMasterService.get', () => {
  let findMany: jest.Mock;
  let service: HsnCodeMasterService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([hsnRow]);
    service = new HsnCodeMasterService({ hsnMaster: { findMany } } as unknown as PrismaService);
  });

  const where = () => (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;

  it('returns active rows only unless told otherwise', async () => {
    await service.get({});

    expect(where()).toEqual({ hsnIsActive: true });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ hsnCode: 'asc' }, { hsnId: 'asc' }] }),
    );
  });

  it('drops the active filter when activeOnly is false', async () => {
    await service.get({ activeOnly: false });

    expect(where()).toEqual({});
  });

  it('matches the code exactly but case-insensitively, after trimming it', async () => {
    const result = await service.get({ hsnCode: '  3004 ' });

    expect(where()).toEqual({
      hsnCode: { equals: '3004', mode: 'insensitive' },
      hsnIsActive: true,
    });
    expect(result.meta).toEqual({
      hsnId: undefined,
      hsnCode: '3004',
      activeOnly: true,
      count: 1,
    });
  });

  it('turns the tax rate into a plain number', async () => {
    const result = await service.get({ hsnId: 12 });

    expect(where()).toMatchObject({ hsnId: 12 });
    expect(result.items).toEqual([{ ...hsnRow, hsnRateOfTax: 12 }]);
  });

  it('refuses an hsnId that matches nothing, naming the hsnId field', async () => {
    findMany.mockResolvedValue([]);

    const refusal = await refusalOf(service.get({ hsnId: 99 }));

    expect(refusal).toMatchObject({
      status: 404,
      body: {
        message: 'HSN code not found for filters hsnId=99, hsnCode=NA',
        errors: [{ field: 'hsnId', code: HsnCodeMasterErrorCode.NOT_FOUND }],
      },
    });
  });

  it('refuses an hsnCode that matches nothing, naming the hsnCode field', async () => {
    findMany.mockResolvedValue([]);

    const refusal = await refusalOf(service.get({ hsnCode: '9999' }));

    expect(refusal).toMatchObject({
      status: 404,
      body: { errors: [{ field: 'hsnCode', code: HsnCodeMasterErrorCode.NOT_FOUND }] },
    });
  });

  it('answers an unfiltered query with an empty list, not a 404', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.get({ hsnCode: '   ' })).resolves.toEqual({
      items: [],
      meta: { hsnId: undefined, hsnCode: '', activeOnly: true, count: 0 },
    });
  });
});
