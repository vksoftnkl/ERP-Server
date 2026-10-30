import { HttpException } from '@nestjs/common';
import { ItemTaxHistory } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { SaveItemTaxHistoryDto } from './dto/save-item-tax-history.dto';
import { ItemsTaxHistoryMasterService } from './items-tax-history-master.service';
import { ItemTaxHistoryErrorCode } from './types/item-tax-history-error-codes';

const ITH_ID = '019c6f6c-be87-7a11-8905-36092c46ab01';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46ab02';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46ab03';
const OTHER_TAX_ID = '019c6f6c-be87-7a11-8905-36092c46ab04';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46ab05';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const historyRow = (overrides: Partial<ItemTaxHistory> = {}): ItemTaxHistory => ({
  ithId: ITH_ID,
  ithItemId: ITEM_ID,
  ithTaxId: TAX_ID,
  ithEffectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
  ithEffectiveTo: null,
  ithReason: null,
  ithCreatedOn: CREATED_ON,
  ithCreatedBy: USER_ID,
  ithSyncDate: null,
  ...overrides,
});

/** What Prisma hands back for a write: the stored row with the fields the data set. */
const written = (data: Record<string, unknown>) =>
  historyRow(
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Partial<ItemTaxHistory>,
  );

/** The body as the ValidationPipe hands it over: a DTO instance, every field an own key. */
const dtoOf = (plain: Partial<SaveItemTaxHistoryDto> = {}) =>
  plainToInstance(SaveItemTaxHistoryDto, {
    ith_item_id: ITEM_ID,
    ith_tax_id: TAX_ID,
    ith_effective_from: '2026-04-01',
    ...plain,
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

const prismaError = (code: string) => Object.assign(new Error(`Prisma ${code}`), { code });

type PrismaMock = {
  itemTaxHistory: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('ItemsTaxHistoryMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: ItemsTaxHistoryMasterService;

  beforeEach(() => {
    prisma = {
      itemTaxHistory: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => written(data)),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => written(data)),
        delete: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new ItemsTaxHistoryMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  // ── save: create ──────────────────────────────────────────────────────────
  describe('save — create (no ith_id)', () => {
    it('creates the row as the request user and audits it under item:tax:from', async () => {
      const payload = await service.save(dtoOf());

      expect(prisma.itemTaxHistory.create).toHaveBeenCalledWith({
        data: {
          ithItemId: ITEM_ID,
          ithTaxId: TAX_ID,
          ithEffectiveFrom: new Date('2026-04-01'),
          ithCreatedOn: expect.any(Date),
          ithCreatedBy: USER_ID,
        },
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        {
          action: 'New',
          tableName: 'item tax history',
          screenName: 'Item Tax History',
          screenType: 'master',
          pk: ITH_ID,
          displayName: `${ITEM_ID}:${TAX_ID}:2026-04-01`,
          originalRecord: null,
          modifiedRecord: payload,
          userId: USER_ID,
          notes: 'Item tax history created',
        },
        prisma,
      );
      expect(payload).toEqual({
        ith_id: ITH_ID,
        ith_item_id: ITEM_ID,
        ith_tax_id: TAX_ID,
        ith_effective_from: '2026-04-01T00:00:00.000Z',
        ith_effective_to: null,
        ith_reason: null,
        ith_created_on: expect.any(String),
        ith_created_by: USER_ID,
      });
    });

    it('writes the end date and reason it was sent', async () => {
      const payload = await service.save(
        dtoOf({ ith_effective_to: '2026-09-30', ith_reason: 'GST council revision' }),
      );

      expect(prisma.itemTaxHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ithEffectiveTo: new Date('2026-09-30'),
          ithReason: 'GST council revision',
        }) as object,
      });
      expect(payload).toMatchObject({
        ith_effective_to: '2026-09-30T00:00:00.000Z',
        ith_reason: 'GST council revision',
      });
    });

    it('takes the creator named in the body over the request user', async () => {
      await service.save(dtoOf({ ith_created_by: 'importer' }));

      expect(prisma.itemTaxHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ithCreatedBy: 'importer' }) as object,
      });
    });

    it('falls back to the default actor when nobody is named and no user is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save(dtoOf());

      expect(auditEntry().userId).toBe(DEFAULT_ACTOR);
    });

    it('accepts an end date equal to the start date', async () => {
      await expect(service.save(dtoOf({ ith_effective_to: '2026-04-01' }))).resolves.toBeDefined();
    });

    it.each([
      [
        'a start date that is not a date',
        { ith_effective_from: 'someday' },
        'ith_effective_from',
        ItemTaxHistoryErrorCode.DATE_INVALID,
      ],
      [
        'an end date that is not a date',
        { ith_effective_to: 'later' },
        'ith_effective_to',
        ItemTaxHistoryErrorCode.DATE_INVALID,
      ],
      [
        'an end date before the start date',
        { ith_effective_to: '2026-03-31' },
        'ith_effective_to',
        ItemTaxHistoryErrorCode.DATE_RANGE_INVALID,
      ],
    ])('refuses %s before opening a transaction', async (_label, overrides, field, code) => {
      const refusal = await refusalOf(service.save(dtoOf(overrides)));

      expect(refusal).toMatchObject({
        status: 400,
        body: { message: 'Validation failed', errors: [{ field, code }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── save: update ──────────────────────────────────────────────────────────
  describe('save — update (ith_id present)', () => {
    it('refuses an id with no row and writes nothing', async () => {
      const refusal = await refusalOf(service.save(dtoOf({ ith_id: ITH_ID })));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Item tax history not found',
          errors: [
            {
              field: 'ith_id',
              code: ItemTaxHistoryErrorCode.NOT_FOUND,
              message: `No item tax history found with id ${ITH_ID}`,
            },
          ],
        },
      });
      expect(prisma.itemTaxHistory.update).not.toHaveBeenCalled();
    });

    it('rewrites the row and audits the before and after', async () => {
      prisma.itemTaxHistory.findUnique.mockResolvedValue(historyRow());

      const payload = await service.save(
        dtoOf({ ith_id: ITH_ID, ith_tax_id: OTHER_TAX_ID, ith_reason: 'rate change' }),
      );

      expect(prisma.itemTaxHistory.update).toHaveBeenCalledWith({
        where: { ithId: ITH_ID },
        data: {
          ithItemId: ITEM_ID,
          ithTaxId: OTHER_TAX_ID,
          ithEffectiveFrom: new Date('2026-04-01'),
          ithEffectiveTo: undefined,
          ithReason: 'rate change',
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: ITH_ID,
        displayName: `${ITEM_ID}:${OTHER_TAX_ID}:2026-04-01`,
        originalRecord: expect.objectContaining({ ith_tax_id: TAX_ID, ith_reason: null }),
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Item tax history updated',
      });
    });

    it('keeps the stored end date and reason when the update leaves them out', async () => {
      const stored = historyRow({ ithEffectiveTo: new Date('2026-09-30'), ithReason: 'kept' });
      prisma.itemTaxHistory.findUnique.mockResolvedValue(stored);
      prisma.itemTaxHistory.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...stored,
          ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
        }),
      );

      const payload = await service.save(dtoOf({ ith_id: ITH_ID }));

      // Both keys are own properties of the DTO instance, holding undefined, which Prisma skips.
      const { data } = prisma.itemTaxHistory.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data.ithEffectiveTo).toBeUndefined();
      expect(data.ithReason).toBeUndefined();
      expect(payload).toMatchObject({
        ith_effective_to: '2026-09-30T00:00:00.000Z',
        ith_reason: 'kept',
      });
    });

    it('clears the end date and reason when the update sends null', async () => {
      prisma.itemTaxHistory.findUnique.mockResolvedValue(
        historyRow({ ithEffectiveTo: new Date('2026-09-30'), ithReason: 'old' }),
      );

      await service.save(dtoOf({ ith_id: ITH_ID, ith_effective_to: null, ith_reason: null }));

      expect(prisma.itemTaxHistory.update).toHaveBeenCalledWith({
        where: { ithId: ITH_ID },
        data: expect.objectContaining({ ithEffectiveTo: null, ithReason: null }) as object,
      });
    });

    it('stamps the default actor on the audit when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);
      prisma.itemTaxHistory.findUnique.mockResolvedValue(historyRow());

      await service.save(dtoOf({ ith_id: ITH_ID }));

      expect(auditEntry().userId).toBe(DEFAULT_ACTOR);
    });

    it('refuses an end date before the start date it sends', async () => {
      const refusal = await refusalOf(
        service.save(dtoOf({ ith_id: ITH_ID, ith_effective_to: '2026-01-01' })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: ItemTaxHistoryErrorCode.DATE_RANGE_INVALID }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── write errors ──────────────────────────────────────────────────────────
  describe('database refusals on save', () => {
    it('answers a unique-index clash (P2002) with a 409 on ith_id', async () => {
      prisma.itemTaxHistory.create.mockRejectedValue(prismaError('P2002'));

      const refusal = await refusalOf(service.save(dtoOf()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Item tax history already exists',
          errors: [{ field: 'ith_id', code: ItemTaxHistoryErrorCode.DUPLICATE }],
        },
      });
    });

    it('answers an item or tax that does not exist (P2003) with a 400', async () => {
      prisma.itemTaxHistory.findUnique.mockResolvedValue(historyRow());
      prisma.itemTaxHistory.update.mockRejectedValue(prismaError('P2003'));

      const refusal = await refusalOf(service.save(dtoOf({ ith_id: ITH_ID })));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          message: 'Invalid relation reference',
          errors: [{ field: 'ith_item_id', code: ItemTaxHistoryErrorCode.REFERENCE_NOT_FOUND }],
        },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.itemTaxHistory.create.mockRejectedValue(failure);

      await expect(service.save(dtoOf())).rejects.toBe(failure);
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('returns the row as a payload with ISO dates', async () => {
      prisma.itemTaxHistory.findUnique.mockResolvedValue(
        historyRow({ ithEffectiveTo: new Date('2026-09-30T00:00:00.000Z'), ithReason: 'r' }),
      );

      await expect(service.getById(ITH_ID)).resolves.toEqual({
        ith_id: ITH_ID,
        ith_item_id: ITEM_ID,
        ith_tax_id: TAX_ID,
        ith_effective_from: '2026-04-01T00:00:00.000Z',
        ith_effective_to: '2026-09-30T00:00:00.000Z',
        ith_reason: 'r',
        ith_created_on: CREATED_ON.toISOString(),
        ith_created_by: USER_ID,
      });
      expect(prisma.itemTaxHistory.findUnique).toHaveBeenCalledWith({ where: { ithId: ITH_ID } });
    });

    it('refuses an id with no row', async () => {
      const refusal = await refusalOf(service.getById(ITH_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: ItemTaxHistoryErrorCode.NOT_FOUND }] },
      });
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('hard-deletes the row and audits it as a cancel with no after-image', async () => {
      prisma.itemTaxHistory.findUnique.mockResolvedValue(historyRow());

      await expect(service.delete(ITH_ID)).resolves.toEqual({ ith_id: ITH_ID, deleted: true });

      expect(prisma.itemTaxHistory.delete).toHaveBeenCalledWith({ where: { ithId: ITH_ID } });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          pk: ITH_ID,
          displayName: `${ITEM_ID}:${TAX_ID}:2026-04-01`,
          originalRecord: expect.objectContaining({ ith_id: ITH_ID }),
          modifiedRecord: null,
          userId: USER_ID,
          notes: 'Item tax history deleted',
        }),
        prisma,
      );
    });

    it('stamps the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);
      prisma.itemTaxHistory.findUnique.mockResolvedValue(historyRow());

      await service.delete(ITH_ID);

      expect(auditEntry().userId).toBe(DEFAULT_ACTOR);
    });

    it('refuses an id with no row and deletes nothing', async () => {
      const refusal = await refusalOf(service.delete(ITH_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.itemTaxHistory.delete).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('answers a row other records still point at (P2003) with a 400', async () => {
      prisma.itemTaxHistory.findUnique.mockResolvedValue(historyRow());
      prisma.itemTaxHistory.delete.mockRejectedValue(prismaError('P2003'));

      const refusal = await refusalOf(service.delete(ITH_ID));

      expect(refusal).toEqual({
        status: 400,
        body: {
          success: false,
          message: 'Cannot delete item tax history',
          errors: [
            {
              field: 'ith_id',
              code: ItemTaxHistoryErrorCode.IN_USE,
              message: 'Item tax history is referenced by related records',
            },
          ],
        },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.itemTaxHistory.findUnique.mockResolvedValue(historyRow());
      prisma.itemTaxHistory.delete.mockRejectedValue(failure);

      await expect(service.delete(ITH_ID)).rejects.toBe(failure);
    });
  });
});
