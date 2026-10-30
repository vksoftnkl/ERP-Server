import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AccTenderType, Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveTenderTypeMasterDto } from './dto/save-tender-type-master.dto';
import { TenderTypeMasterService } from './tender-type-master.service';
import { TenderTypeErrorCode } from './types/tender-type-master-error-codes';

const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a0ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeType = (overrides: Partial<AccTenderType> = {}): AccTenderType => ({
  ttmTypeId: 12,
  ttmTypeName: 'WALLET',
  ttmDisplayName: 'Wallet',
  ttmIsCash: false,
  ttmNeedsRef: false,
  ttmRefLabel: null,
  ttmSaleOnly: false,
  ttmAllowChange: false,
  ttmAllowInReturn: true,
  ttmDisplayOrder: 0,
  ttmCloseMode: 'NONE',
  ttmHandover: false,
  ttmIsActive: true,
  ttmIsDeleted: false,
  ttmSyncDate: null,
  ttmCreatedOn: CREATED_ON,
  ttmCreatedBy: USER_ID,
  ttmModifiedOn: MODIFIED_ON,
  ttmModifiedBy: USER_ID,
  ...overrides,
});

type TypeCreateArgs = { data: Prisma.AccTenderTypeUncheckedCreateInput };
type TypeUpdateArgs = {
  where: { ttmTypeId: number };
  data: Prisma.AccTenderTypeUncheckedUpdateInput;
};
type TypeFindArgs = { where: Record<string, unknown>; select?: Record<string, boolean> };
type TypeFindResult = AccTenderType | { ttmTypeId: number } | null;
type TypeUpdateManyArgs = { where: unknown; data: Record<string, unknown> };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  accTenderType: {
    findFirst: jest.Mock<Promise<TypeFindResult>, [TypeFindArgs]>;
    aggregate: jest.Mock<Promise<{ _max: { ttmTypeId: number | null } }>, [unknown]>;
    create: jest.Mock<Promise<AccTenderType>, [TypeCreateArgs]>;
    update: jest.Mock<Promise<AccTenderType>, [TypeUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [TypeUpdateManyArgs]>;
  };
  accTenderMaster: { count: jest.Mock<Promise<number>, [unknown]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

/** The refusal body a thrown HttpException carries. */
const bodyOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error.getResponse();
    throw error;
  }
  throw new Error('expected the call to refuse');
};

const idInvalidBody = (field = 'ttmTypeId') => ({
  success: false,
  message: 'Validation failed',
  errors: [
    {
      field,
      message: `${field} must be a valid numeric identifier`,
      code: TenderTypeErrorCode.ID_INVALID,
    },
  ],
});

describe('TenderTypeMasterService', () => {
  let service: TenderTypeMasterService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      accTenderType: {
        // Default: no live type by id, and no type (deleted or not) holds the name.
        findFirst: jest.fn<Promise<TypeFindResult>, [TypeFindArgs]>(() => Promise.resolve(null)),
        // Migration seeds ids 1..11.
        aggregate: jest.fn<Promise<{ _max: { ttmTypeId: number | null } }>, [unknown]>(() =>
          Promise.resolve({ _max: { ttmTypeId: 11 } }),
        ),
        create: jest.fn(({ data }: TypeCreateArgs) =>
          Promise.resolve(
            makeType({ ...(data as unknown as Partial<AccTenderType>), ttmModifiedOn: null }),
          ),
        ),
        update: jest.fn(({ where, data }: TypeUpdateArgs) =>
          Promise.resolve(
            makeType({
              ...(data as unknown as Partial<AccTenderType>),
              ttmTypeId: where.ttmTypeId,
            }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [TypeUpdateManyArgs]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      accTenderMaster: { count: jest.fn<Promise<number>, [unknown]>(() => Promise.resolve(0)) },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new TenderTypeMasterService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no ttmTypeId)', () => {
    it('takes the next id after the highest, trims the name and stamps the creator', async () => {
      const payload = await service.save({ ttmTypeName: '  WALLET ', ttmDisplayName: ' Wallet ' });

      const { data } = prisma.accTenderType.create.mock.calls[0][0];
      expect(data).toEqual({
        ttmTypeId: 12,
        ttmTypeName: 'WALLET',
        ttmDisplayName: 'Wallet',
        ttmCreatedOn: expect.any(Date) as Date,
        ttmCreatedBy: USER_ID,
      });
      expect(prisma.accTenderType.aggregate).toHaveBeenCalledWith({ _max: { ttmTypeId: true } });
      // The id goes out as a string; a never-modified row has no modified stamp.
      expect(payload).toMatchObject({
        ttmTypeId: '12',
        ttmTypeName: 'WALLET',
        ttmDisplayName: 'Wallet',
        ttmModifiedOn: null,
        ttmSyncDate: null,
      });
    });

    it('starts at 1 on an empty catalogue', async () => {
      prisma.accTenderType.aggregate.mockResolvedValueOnce({ _max: { ttmTypeId: null } });

      await service.save({ ttmTypeName: 'WALLET' });

      expect(prisma.accTenderType.create.mock.calls[0][0].data.ttmTypeId).toBe(1);
    });

    it.each([
      ['omitted', undefined],
      ['blank', '   '],
    ])(
      'falls back to the type name when the display name is %s',
      async (_label, ttmDisplayName) => {
        await service.save({ ttmTypeName: 'WALLET', ttmDisplayName });

        expect(prisma.accTenderType.create.mock.calls[0][0].data.ttmDisplayName).toBe('WALLET');
      },
    );

    it('writes ttmIsActive only when the body carries it', async () => {
      await service.save({ ttmTypeName: 'WALLET' });
      expect(prisma.accTenderType.create.mock.calls[0][0].data).not.toHaveProperty('ttmIsActive');

      await service.save({ ttmTypeName: 'WALLET', ttmIsActive: false });
      expect(prisma.accTenderType.create.mock.calls[1][0].data.ttmIsActive).toBe(false);
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save({ ttmTypeName: 'WALLET' });

      expect(prisma.accTenderType.create.mock.calls[0][0].data.ttmCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('files a New audit row inside the same transaction', async () => {
      const payload = await service.save({ ttmTypeName: 'WALLET' });

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'tender type',
        screenName: 'Tender Type Master',
        screenType: 'master',
        pk: '12',
        displayName: 'WALLET',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Tender type created',
      });
      expect(client).toBe(prisma);
    });

    // ux_ttm_name is a plain UNIQUE: a deleted type still holds its name.
    it('checks the name against every type, deleted ones included, in any case', async () => {
      await service.save({ ttmTypeName: 'wallet' });

      expect(prisma.accTenderType.findFirst).toHaveBeenCalledWith({
        where: { ttmTypeName: { equals: 'wallet', mode: 'insensitive' } },
        select: { ttmTypeId: true },
      });
    });

    it('refuses a name another type holds with TENDER_TYPE_NAME_TAKEN', async () => {
      prisma.accTenderType.findFirst.mockResolvedValueOnce({ ttmTypeId: 3 });

      const promise = service.save({ ttmTypeName: 'CARD' });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Tender type name already exists',
        errors: [
          {
            field: 'ttmTypeName',
            message: 'Duplicate ttmTypeName is not allowed',
            code: TenderTypeErrorCode.NAME_TAKEN,
          },
        ],
      });
      expect(prisma.accTenderType.aggregate).not.toHaveBeenCalled();
      expect(prisma.accTenderType.create).not.toHaveBeenCalled();
    });

    it('refuses a blank name before touching the table', async () => {
      const promise = service.save({ ttmTypeName: '  ' });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [{ field: 'ttmTypeName', code: 'VALIDATION_IS_NOT_EMPTY' }],
      });
      expect(prisma.accTenderType.findFirst).not.toHaveBeenCalled();
      expect(prisma.accTenderType.create).not.toHaveBeenCalled();
    });
  });

  describe('save — update (ttmTypeId sent)', () => {
    beforeEach(() => {
      // The live row by id; the name probe (ttmTypeId: { not }) finds nobody.
      prisma.accTenderType.findFirst.mockImplementation(({ where }: TypeFindArgs) =>
        Promise.resolve(where.ttmTypeId === 12 ? makeType() : null),
      );
    });

    it('updates the live row by its numeric id', async () => {
      const payload = await service.save({
        ttmTypeId: '12',
        ttmTypeName: ' E-WALLET ',
        ttmDisplayName: 'E-Wallet',
      });

      expect(prisma.accTenderType.findFirst.mock.calls[0][0]).toEqual({
        where: { ttmTypeId: 12, ttmIsDeleted: false },
      });
      const { where, data } = prisma.accTenderType.update.mock.calls[0][0];
      expect(where).toEqual({ ttmTypeId: 12 });
      expect(data).toEqual({
        ttmTypeName: 'E-WALLET',
        ttmDisplayName: 'E-Wallet',
        ttmModifiedOn: expect.any(Date) as Date,
        ttmModifiedBy: USER_ID,
      });
      expect(prisma.accTenderType.aggregate).not.toHaveBeenCalled();
      expect(payload).toMatchObject({ ttmTypeId: '12', ttmTypeName: 'E-WALLET' });
    });

    it('skips its own row when checking the name', async () => {
      await service.save({ ttmTypeId: '12', ttmTypeName: 'WALLET' });

      expect(prisma.accTenderType.findFirst.mock.calls[1][0]).toEqual({
        where: { ttmTypeName: { equals: 'WALLET', mode: 'insensitive' }, ttmTypeId: { not: 12 } },
        select: { ttmTypeId: true },
      });
    });

    // An update re-derives the label: clearing it resets it to the name.
    it('resets the display name to the type name when none is sent', async () => {
      await service.save({ ttmTypeId: '12', ttmTypeName: 'WALLET' });

      expect(prisma.accTenderType.update.mock.calls[0][0].data.ttmDisplayName).toBe('WALLET');
    });

    it('writes ttmIsActive only when the body carries it', async () => {
      await service.save({ ttmTypeId: '12', ttmTypeName: 'WALLET' });
      expect(prisma.accTenderType.update.mock.calls[0][0].data).not.toHaveProperty('ttmIsActive');

      await service.save({ ttmTypeId: '12', ttmTypeName: 'WALLET', ttmIsActive: false });
      expect(prisma.accTenderType.update.mock.calls[1][0].data.ttmIsActive).toBe(false);
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save({ ttmTypeId: '12', ttmTypeName: 'E-WALLET' });

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        tableName: 'tender type',
        pk: '12',
        displayName: 'E-WALLET',
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Tender type updated',
      });
      expect(entry.originalRecord).toMatchObject({ ttmTypeId: '12', ttmTypeName: 'WALLET' });
      expect(client).toBe(prisma);
    });

    it('refuses an id with no live type', async () => {
      const promise = service.save({ ttmTypeId: '99', ttmTypeName: 'WALLET' });

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Tender type not found',
        errors: [
          {
            field: 'ttmTypeId',
            message: 'No active tender type found with id 99',
            code: TenderTypeErrorCode.NOT_FOUND,
          },
        ],
      });
      expect(prisma.accTenderType.update).not.toHaveBeenCalled();
    });

    it('refuses a name another type holds', async () => {
      prisma.accTenderType.findFirst.mockImplementation(({ where }: TypeFindArgs) =>
        Promise.resolve(where.ttmTypeId === 12 ? makeType() : { ttmTypeId: 3 }),
      );

      await expect(
        bodyOf(service.save({ ttmTypeId: '12', ttmTypeName: 'CARD' })),
      ).resolves.toMatchObject({ errors: [{ code: TenderTypeErrorCode.NAME_TAKEN }] });
      expect(prisma.accTenderType.update).not.toHaveBeenCalled();
    });

    it('refuses an id that is not a whole number before opening a transaction', async () => {
      await expect(
        bodyOf(service.save({ ttmTypeId: '12a', ttmTypeName: 'WALLET' })),
      ).resolves.toEqual(idInvalidBody());
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('reads a live type by the numeric id and sends the id back as a string', async () => {
      prisma.accTenderType.findFirst.mockResolvedValueOnce(
        makeType({ ttmSyncDate: new Date('2026-10-03T09:00:00.000Z') }),
      );

      await expect(service.getById(' 12 ')).resolves.toEqual({
        ttmTypeId: '12',
        ttmTypeName: 'WALLET',
        ttmDisplayName: 'Wallet',
        ttmIsActive: true,
        ttmIsDeleted: false,
        ttmSyncDate: '2026-10-03T09:00:00.000Z',
        ttmCreatedOn: CREATED_ON.toISOString(),
        ttmCreatedBy: USER_ID,
        ttmModifiedOn: MODIFIED_ON.toISOString(),
        ttmModifiedBy: USER_ID,
      });
      expect(prisma.accTenderType.findFirst).toHaveBeenCalledWith({
        where: { ttmTypeId: 12, ttmIsDeleted: false },
      });
    });

    it('refuses an id with no live type', async () => {
      await expect(bodyOf(service.getById('99'))).resolves.toMatchObject({
        errors: [{ field: 'ttmTypeId', code: TenderTypeErrorCode.NOT_FOUND }],
      });
    });

    // A missing query param arrives as undefined: a 400, never a TypeError 500.
    it.each([
      ['missing', undefined as unknown as string],
      ['blank', '  '],
      ['not numeric', 'abc'],
      ['negative', '-1'],
      ['fractional', '1.5'],
      ['wider than 32 bits', '2147483648'],
      ['beyond a safe integer', '9007199254740993'],
    ])('refuses an id that is %s with TENDER_TYPE_ID_INVALID', async (_label, id) => {
      const promise = service.getById(id);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual(idInvalidBody());
      expect(prisma.accTenderType.findFirst).not.toHaveBeenCalled();
    });

    it('accepts the widest 32-bit id', async () => {
      prisma.accTenderType.findFirst.mockResolvedValueOnce(makeType({ ttmTypeId: 2147483647 }));

      await expect(service.getById('2147483647')).resolves.toMatchObject({
        ttmTypeId: '2147483647',
      });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.accTenderType.findFirst.mockResolvedValue(makeType());
    });

    it('marks a type no live tender uses deleted and inactive', async () => {
      await expect(service.softDelete('12')).resolves.toEqual({ ttmTypeId: '12', deleted: true });

      expect(prisma.accTenderMaster.count).toHaveBeenCalledWith({
        where: { tndTypeId: 12, tndIsDeleted: false },
      });
      const [{ where, data }] = prisma.accTenderType.updateMany.mock.calls[0];
      expect(where).toEqual({ ttmTypeId: 12, ttmIsDeleted: false });
      expect(data).toEqual({
        ttmIsDeleted: true,
        ttmIsActive: false,
        ttmModifiedOn: expect.any(Date) as Date,
        ttmModifiedBy: USER_ID,
      });
    });

    it('files a cancel audit row holding the row before and after', async () => {
      await service.softDelete('12');

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        tableName: 'tender type',
        pk: '12',
        displayName: 'WALLET',
        userId: USER_ID,
        notes: 'Tender type soft deleted',
      });
      expect(entry.originalRecord).toMatchObject({ ttmIsDeleted: false, ttmIsActive: true });
      expect(entry.modifiedRecord).toMatchObject({ ttmIsDeleted: true, ttmIsActive: false });
      expect(client).toBe(prisma);
    });

    it('refuses while live tenders still use the type', async () => {
      prisma.accTenderMaster.count.mockResolvedValueOnce(2);

      const promise = service.softDelete('12');

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Cannot delete tender type with active tenders',
        errors: [
          {
            field: 'ttmTypeId',
            message: 'Tender type 12 is used by 2 tender(s).',
            code: TenderTypeErrorCode.IN_USE,
          },
        ],
      });
      expect(prisma.accTenderType.updateMany).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('refuses an id with no live type before counting tenders', async () => {
      prisma.accTenderType.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('12')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.accTenderMaster.count).not.toHaveBeenCalled();
    });

    it('refuses an id that is not a whole number before opening a transaction', async () => {
      await expect(bodyOf(service.softDelete('x'))).resolves.toEqual(idInvalidBody());
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Someone else deleted it between the read and the write.
    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.accTenderType.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete('12')).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });

  it('save routes by whether ttmTypeId is present', async () => {
    const dto: SaveTenderTypeMasterDto = { ttmTypeName: 'WALLET' };

    await service.save(dto);

    expect(prisma.accTenderType.create).toHaveBeenCalledTimes(1);
    expect(prisma.accTenderType.update).not.toHaveBeenCalled();
  });
});
