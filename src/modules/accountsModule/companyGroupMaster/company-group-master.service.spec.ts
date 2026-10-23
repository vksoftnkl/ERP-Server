import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { CompanyGroupMaster, Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CompanyGroupMasterService } from './company-group-master.service';
import { SaveCompanyGroupMasterDto } from './dto/save-company-group-master.dto';
import { CompanyGroupErrorCode } from './types/company-group-master-error-codes';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46c001';
const OTHER_GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46c002';
const COMPANY_A = '019c6f6c-be87-7a11-8905-36092c46c0a1';
const COMPANY_B = '019c6f6c-be87-7a11-8905-36092c46c0a2';
const COMPANY_C = '019c6f6c-be87-7a11-8905-36092c46c0a3';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46c0ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeGroup = (overrides: Partial<CompanyGroupMaster> = {}): CompanyGroupMaster => ({
  cogGroupId: GROUP_ID,
  cogGroupName: 'North Region',
  cogCompanyIds: [COMPANY_A, COMPANY_B],
  cogIsActive: true,
  cogIsDeleted: false,
  cogSyncDate: null,
  cogCreatedOn: CREATED_ON,
  cogCreatedBy: USER_ID,
  cogModifiedOn: MODIFIED_ON,
  cogModifiedBy: USER_ID,
  ...overrides,
});

const createDto = (
  overrides: Partial<SaveCompanyGroupMasterDto> = {},
): SaveCompanyGroupMasterDto => ({
  cogGroupName: 'North Region',
  cogCompanyIds: [COMPANY_A, COMPANY_B],
  ...overrides,
});

const updateDto = (overrides: Partial<SaveCompanyGroupMasterDto> = {}): SaveCompanyGroupMasterDto =>
  createDto({ cogGroupId: GROUP_ID, ...overrides });

type GroupCreateArgs = { data: Prisma.CompanyGroupMasterUncheckedCreateInput };
type GroupUpdateArgs = {
  where: { cogGroupId: string };
  data: Prisma.CompanyGroupMasterUncheckedUpdateInput;
};
type GroupFindArgs = { where: Record<string, unknown>; select?: Record<string, boolean> };
type GroupFindResult = CompanyGroupMaster | { cogGroupId: string } | null;

type PrismaMock = {
  companyGroupMaster: {
    findFirst: jest.Mock<Promise<GroupFindResult>, [GroupFindArgs]>;
    create: jest.Mock<Promise<CompanyGroupMaster>, [GroupCreateArgs]>;
    update: jest.Mock<Promise<CompanyGroupMaster>, [GroupUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

type AuditEntry = Record<string, unknown>;

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

const uniqueViolation = (): Error =>
  Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

describe('CompanyGroupMasterService', () => {
  let service: CompanyGroupMasterService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      companyGroupMaster: {
        // Default: no live group by id, and no other group holds the name.
        findFirst: jest.fn<Promise<GroupFindResult>, [GroupFindArgs]>(() => Promise.resolve(null)),
        create: jest.fn(({ data }: GroupCreateArgs) =>
          Promise.resolve(
            makeGroup({
              ...(data as unknown as Partial<CompanyGroupMaster>),
              cogModifiedOn: data.cogCreatedOn as Date,
              cogModifiedBy: null,
            }),
          ),
        ),
        update: jest.fn(({ where, data }: GroupUpdateArgs) =>
          Promise.resolve(
            makeGroup({
              ...(data as unknown as Partial<CompanyGroupMaster>),
              cogGroupId: where.cogGroupId,
            }),
          ),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new CompanyGroupMasterService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no cogGroupId)', () => {
    it('trims the name, keeps the first of each repeated company id and stamps the creator', async () => {
      const payload = await service.save(
        createDto({
          cogGroupName: '  North Region  ',
          cogCompanyIds: [COMPANY_B, COMPANY_A, COMPANY_B, COMPANY_C, COMPANY_A],
        }),
      );

      const { data } = prisma.companyGroupMaster.create.mock.calls[0][0];
      expect(data).toMatchObject({
        cogGroupName: 'North Region',
        cogCompanyIds: [COMPANY_B, COMPANY_A, COMPANY_C],
        cogCreatedBy: USER_ID,
      });
      expect(data.cogCreatedOn).toBeInstanceOf(Date);
      expect(prisma.companyGroupMaster.update).not.toHaveBeenCalled();
      expect(payload).toMatchObject({
        cogGroupId: GROUP_ID,
        cogGroupName: 'North Region',
        cogCompanyIds: [COMPANY_B, COMPANY_A, COMPANY_C],
        cogIsActive: true,
        cogIsDeleted: false,
        cogSyncDate: null,
        cogCreatedBy: USER_ID,
      });
    });

    it('returns every timestamp as an ISO string', async () => {
      const syncDate = new Date('2026-10-03T09:00:00.000Z');
      prisma.companyGroupMaster.create.mockResolvedValueOnce(makeGroup({ cogSyncDate: syncDate }));

      const payload = await service.save(createDto());

      expect(payload.cogSyncDate).toBe('2026-10-03T09:00:00.000Z');
      expect(payload.cogCreatedOn).toBe('2026-10-01T09:00:00.000Z');
      expect(payload.cogModifiedOn).toBe('2026-10-02T09:00:00.000Z');
    });

    // The column defaults to true; an absent flag must leave that default alone.
    it('writes cogIsActive only when the body carries it', async () => {
      await service.save(createDto());
      expect(prisma.companyGroupMaster.create.mock.calls[0][0].data).not.toHaveProperty(
        'cogIsActive',
      );

      await service.save(createDto({ cogIsActive: false }));
      expect(prisma.companyGroupMaster.create.mock.calls[1][0].data.cogIsActive).toBe(false);
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save(createDto());

      expect(prisma.companyGroupMaster.create.mock.calls[0][0].data.cogCreatedBy).toBe(
        DEFAULT_ACTOR,
      );
      expect(auditLogService.logEntityChange.mock.calls[0][0].userId).toBe(DEFAULT_ACTOR);
    });

    it('files a New audit row inside the same transaction', async () => {
      const payload = await service.save(createDto());

      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'company group master',
        screenName: 'Company Group Master',
        screenType: 'master',
        pk: GROUP_ID,
        displayName: 'North Region',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Company group created',
      });
      expect(client).toBe(prisma);
    });

    it('checks the name against live groups in any letter case', async () => {
      await service.save(createDto({ cogGroupName: 'north region' }));

      expect(prisma.companyGroupMaster.findFirst).toHaveBeenCalledWith({
        where: {
          cogIsDeleted: false,
          cogGroupName: { equals: 'north region', mode: 'insensitive' },
        },
        select: { cogGroupId: true },
      });
    });

    it('refuses a name another live group holds with COMPANY_GROUP_NAME_TAKEN', async () => {
      prisma.companyGroupMaster.findFirst.mockResolvedValueOnce({ cogGroupId: OTHER_GROUP_ID });

      const promise = service.save(createDto());

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Company group name already exists',
        errors: [
          {
            field: 'cogGroupName',
            message: 'Duplicate cogGroupName is not allowed',
            code: CompanyGroupErrorCode.NAME_TAKEN,
          },
        ],
      });
      expect(prisma.companyGroupMaster.create).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('refuses a blank name before touching the table', async () => {
      const promise = service.save(createDto({ cogGroupName: '   ' }));

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'cogGroupName',
            message: 'cogGroupName must not be empty',
            code: 'VALIDATION_IS_NOT_EMPTY',
          },
        ],
      });
      expect(prisma.companyGroupMaster.findFirst).not.toHaveBeenCalled();
      expect(prisma.companyGroupMaster.create).not.toHaveBeenCalled();
    });

    it.each([
      ['an ORM unique violation (P2002)', uniqueViolation()],
      [
        'a raw unique violation (P2010 / 23505)',
        Object.assign(new Error('Raw query failed'), { code: 'P2010', meta: { code: '23505' } }),
      ],
    ])('answers %s with COMPANY_GROUP_DUPLICATE', async (_label, error) => {
      prisma.companyGroupMaster.create.mockRejectedValueOnce(error);

      const promise = service.save(createDto());

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Company group already exists',
        errors: [
          {
            field: 'cogGroupName',
            message: 'Duplicate company group unique value is not allowed',
            code: CompanyGroupErrorCode.DUPLICATE,
          },
        ],
      });
    });

    it('lets any other failure through unchanged', async () => {
      const failure = Object.assign(new Error('FK violated'), { code: 'P2003' });
      prisma.companyGroupMaster.create.mockRejectedValueOnce(failure);

      await expect(service.save(createDto())).rejects.toBe(failure);
    });

    it('lets an audit failure fail the save', async () => {
      const failure = new Error('audit insert failed');
      auditLogService.logEntityChange.mockRejectedValueOnce(failure);

      await expect(service.save(createDto())).rejects.toBe(failure);
    });
  });

  describe('save — update (cogGroupId sent)', () => {
    beforeEach(() => {
      // First call: the live row by id. Later calls (the name probe): nobody else.
      prisma.companyGroupMaster.findFirst.mockImplementation(({ where }: GroupFindArgs) =>
        Promise.resolve(where.cogGroupId === GROUP_ID ? makeGroup() : null),
      );
    });

    it('updates the live row by id with the trimmed name and de-duplicated ids', async () => {
      const payload = await service.save(
        updateDto({
          cogGroupName: '  South Region ',
          cogCompanyIds: [COMPANY_C, COMPANY_C, COMPANY_A],
        }),
      );

      expect(prisma.companyGroupMaster.findFirst.mock.calls[0][0]).toEqual({
        where: { cogGroupId: GROUP_ID, cogIsDeleted: false },
      });
      const { where, data } = prisma.companyGroupMaster.update.mock.calls[0][0];
      expect(where).toEqual({ cogGroupId: GROUP_ID });
      expect(data).toMatchObject({
        cogGroupName: 'South Region',
        cogCompanyIds: [COMPANY_C, COMPANY_A],
        cogModifiedBy: USER_ID,
      });
      expect(data.cogModifiedOn).toBeInstanceOf(Date);
      // An update never re-stamps the creator.
      expect(data).not.toHaveProperty('cogCreatedOn');
      expect(data).not.toHaveProperty('cogCreatedBy');
      expect(prisma.companyGroupMaster.create).not.toHaveBeenCalled();
      expect(payload).toMatchObject({ cogGroupId: GROUP_ID, cogGroupName: 'South Region' });
    });

    it('skips its own row when checking the name', async () => {
      await service.save(updateDto());

      expect(prisma.companyGroupMaster.findFirst.mock.calls[1][0]).toEqual({
        where: {
          cogIsDeleted: false,
          cogGroupName: { equals: 'North Region', mode: 'insensitive' },
          cogGroupId: { not: GROUP_ID },
        },
        select: { cogGroupId: true },
      });
    });

    it('writes cogIsActive only when the body carries it', async () => {
      await service.save(updateDto());
      expect(prisma.companyGroupMaster.update.mock.calls[0][0].data).not.toHaveProperty(
        'cogIsActive',
      );

      await service.save(updateDto({ cogIsActive: false }));
      expect(prisma.companyGroupMaster.update.mock.calls[1][0].data.cogIsActive).toBe(false);
    });

    it('files an update audit row holding the row before and after', async () => {
      const before = makeGroup();
      const payload = await service.save(updateDto({ cogGroupName: 'South Region' }));

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        tableName: 'company group master',
        screenName: 'Company Group Master',
        screenType: 'master',
        pk: GROUP_ID,
        displayName: 'South Region',
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Company group updated',
      });
      expect(entry.originalRecord).toMatchObject({
        cogGroupId: GROUP_ID,
        cogGroupName: before.cogGroupName,
        cogCompanyIds: before.cogCompanyIds,
        cogModifiedOn: MODIFIED_ON.toISOString(),
      });
      expect(client).toBe(prisma);
    });

    it('refuses an id with no live group with COMPANY_GROUP_NOT_FOUND', async () => {
      prisma.companyGroupMaster.findFirst.mockReset();
      prisma.companyGroupMaster.findFirst.mockResolvedValue(null);

      const promise = service.save(updateDto());

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Company group not found',
        errors: [
          {
            field: 'cogGroupId',
            message: `No active company group found with id ${GROUP_ID}`,
            code: CompanyGroupErrorCode.NOT_FOUND,
          },
        ],
      });
      expect(prisma.companyGroupMaster.update).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('refuses a name another live group holds', async () => {
      prisma.companyGroupMaster.findFirst.mockImplementation(({ where }: GroupFindArgs) =>
        Promise.resolve(
          where.cogGroupId === GROUP_ID ? makeGroup() : { cogGroupId: OTHER_GROUP_ID },
        ),
      );

      const promise = service.save(updateDto({ cogGroupName: 'South Region' }));

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [expect.objectContaining({ code: CompanyGroupErrorCode.NAME_TAKEN })],
      });
      expect(prisma.companyGroupMaster.update).not.toHaveBeenCalled();
    });

    it('refuses a blank name', async () => {
      await expect(service.save(updateDto({ cogGroupName: ' ' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.companyGroupMaster.update).not.toHaveBeenCalled();
    });

    it('answers a unique violation on the write with COMPANY_GROUP_DUPLICATE', async () => {
      prisma.companyGroupMaster.update.mockRejectedValueOnce(uniqueViolation());

      const promise = service.save(updateDto());

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [expect.objectContaining({ code: CompanyGroupErrorCode.DUPLICATE })],
      });
    });
  });

  describe('getById', () => {
    it('reads a live group only and returns its payload', async () => {
      prisma.companyGroupMaster.findFirst.mockResolvedValueOnce(makeGroup());

      await expect(service.getById(GROUP_ID)).resolves.toEqual({
        cogGroupId: GROUP_ID,
        cogGroupName: 'North Region',
        cogCompanyIds: [COMPANY_A, COMPANY_B],
        cogIsActive: true,
        cogIsDeleted: false,
        cogSyncDate: null,
        cogCreatedOn: CREATED_ON.toISOString(),
        cogCreatedBy: USER_ID,
        cogModifiedOn: MODIFIED_ON.toISOString(),
        cogModifiedBy: USER_ID,
      });
      expect(prisma.companyGroupMaster.findFirst).toHaveBeenCalledWith({
        where: { cogGroupId: GROUP_ID, cogIsDeleted: false },
      });
    });

    // Deactivated is not deleted: an inactive group still opens.
    it('returns an inactive group', async () => {
      prisma.companyGroupMaster.findFirst.mockResolvedValueOnce(makeGroup({ cogIsActive: false }));

      await expect(service.getById(GROUP_ID)).resolves.toMatchObject({ cogIsActive: false });
    });

    it('refuses an id with no live group with COMPANY_GROUP_NOT_FOUND', async () => {
      const promise = service.getById(GROUP_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [
          expect.objectContaining({ field: 'cogGroupId', code: CompanyGroupErrorCode.NOT_FOUND }),
        ],
      });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.companyGroupMaster.findFirst.mockResolvedValue(makeGroup());
    });

    it('marks the live row deleted and inactive and stamps who did it', async () => {
      await expect(service.softDelete(GROUP_ID)).resolves.toEqual({
        cogGroupId: GROUP_ID,
        deleted: true,
      });

      const [args] = prisma.companyGroupMaster.updateMany.mock.calls[0] as [
        { where: unknown; data: Record<string, unknown> },
      ];
      expect(args.where).toEqual({ cogGroupId: GROUP_ID, cogIsDeleted: false });
      expect(args.data).toMatchObject({
        cogIsDeleted: true,
        cogIsActive: false,
        cogModifiedBy: USER_ID,
      });
      expect(args.data.cogModifiedOn).toBeInstanceOf(Date);
    });

    it('files a cancel audit row holding the row before and after', async () => {
      await service.softDelete(GROUP_ID);

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        tableName: 'company group master',
        screenName: 'Company Group Master',
        screenType: 'master',
        pk: GROUP_ID,
        displayName: 'North Region',
        userId: USER_ID,
        notes: 'Company group soft deleted',
      });
      expect(entry.originalRecord).toMatchObject({ cogIsDeleted: false, cogIsActive: true });
      expect(entry.modifiedRecord).toMatchObject({
        cogIsDeleted: true,
        cogIsActive: false,
        cogModifiedBy: USER_ID,
      });
      expect(client).toBe(prisma);
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.softDelete(GROUP_ID);

      const [args] = prisma.companyGroupMaster.updateMany.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(args.data.cogModifiedBy).toBe(DEFAULT_ACTOR);
    });

    it('refuses an id with no live group and writes nothing', async () => {
      prisma.companyGroupMaster.findFirst.mockResolvedValue(null);

      const promise = service.softDelete(GROUP_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [expect.objectContaining({ code: CompanyGroupErrorCode.NOT_FOUND })],
      });
      expect(prisma.companyGroupMaster.updateMany).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    // Someone else deleted it between the read and the write.
    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.companyGroupMaster.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(GROUP_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
