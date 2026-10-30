import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { PriceLevelMasterService } from './price-level-master.service';
import { PriceLevelMasterErrorCode } from './types/price-level-master-error-codes';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fd01';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const priceLevelRow = (overrides: Record<string, unknown> = {}) => ({
  priceLvlId: 1,
  priceLvlName: 'Retail',
  priceLvlShort: 'RT',
  priceLvlIsActive: true,
  priceLvlIsAdmin: false,
  priceLvlIsDeleted: false,
  priceLvlSyncDate: null,
  priceLvlCreatedOn: CREATED_ON,
  priceLvlCreatedBy: null,
  priceLvlModifiedOn: CREATED_ON,
  priceLvlModifiedBy: null,
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

describe('PriceLevelMasterService', () => {
  let prisma: {
    priceLevel: { findMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let service: PriceLevelMasterService;

  beforeEach(() => {
    prisma = {
      priceLevel: {
        findMany: jest.fn().mockResolvedValue([priceLevelRow()]),
        update: jest.fn(async ({ where, data }: { where: { priceLvlId: number }; data: object }) =>
          priceLevelRow({ ...where, ...data }),
        ),
      },
      // The service hands $transaction the array of pending updates.
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new PriceLevelMasterService(prisma as unknown as PrismaService, context as never);
  });

  describe('get', () => {
    it('returns every price level, ordered by id, with ISO dates', async () => {
      const result = await service.get({});

      expect(prisma.priceLevel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, orderBy: [{ priceLvlId: 'asc' }] }),
      );
      expect(result).toEqual({
        items: [
          {
            ...priceLevelRow(),
            priceLvlCreatedOn: CREATED_ON.toISOString(),
            priceLvlModifiedOn: CREATED_ON.toISOString(),
          },
        ],
        meta: { priceLvlId: undefined, count: 1 },
      });
    });

    it('filters by priceLvlId when one is asked for', async () => {
      await service.get({ priceLvlId: 1 });

      expect(prisma.priceLevel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { priceLvlId: 1 } }),
      );
    });

    it('refuses a priceLvlId that names no price level', async () => {
      prisma.priceLevel.findMany.mockResolvedValue([]);

      const refusal = await refusalOf(service.get({ priceLvlId: 9 }));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'Price level not found for priceLvlId 9',
          errors: [{ field: 'priceLvlId', code: PriceLevelMasterErrorCode.NOT_FOUND }],
        },
      });
    });
  });

  describe('update', () => {
    it('refuses the whole batch, naming every missing id, before writing anything', async () => {
      prisma.priceLevel.findMany.mockResolvedValue([{ priceLvlId: 1 }]);

      const refusal = await refusalOf(
        service.update({ priceLevels: [{ priceLvlId: 1 }, { priceLvlId: 4 }, { priceLvlId: 5 }] }),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          message: 'Price level(s) not found for priceLvlId(s): 4, 5',
          errors: [{ field: 'priceLevels', code: PriceLevelMasterErrorCode.NOT_FOUND }],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('writes only the fields each row sent, plus the modified stamp', async () => {
      prisma.priceLevel.findMany.mockResolvedValue([{ priceLvlId: 1 }, { priceLvlId: 2 }]);

      const result = await service.update({
        priceLevels: [
          { priceLvlId: 1, priceLvlName: 'Retail Plus' },
          { priceLvlId: 2, priceLvlIsActive: false, priceLvlShort: null },
        ],
      });

      const [first, second] = prisma.priceLevel.update.mock.calls.map(
        ([args]) => args as { where: object; data: object },
      );
      expect(first.where).toEqual({ priceLvlId: 1 });
      expect(first.data).toEqual({
        priceLvlName: 'Retail Plus',
        priceLvlModifiedOn: expect.any(Date),
        priceLvlModifiedBy: USER_ID,
      });
      expect(second.data).toEqual({
        priceLvlShort: null,
        priceLvlIsActive: false,
        priceLvlModifiedOn: expect.any(Date),
        priceLvlModifiedBy: USER_ID,
      });
      expect(result.map((row) => row.priceLvlId)).toEqual([1, 2]);
      expect(result[0].priceLvlName).toBe('Retail Plus');
    });

    it('stamps the default actor when no user is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.update({ priceLevels: [{ priceLvlId: 1, priceLvlIsAdmin: true }] });

      expect(prisma.priceLevel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priceLvlIsAdmin: true,
            priceLvlModifiedBy: DEFAULT_ACTOR,
          }) as object,
        }),
      );
    });
  });
});
