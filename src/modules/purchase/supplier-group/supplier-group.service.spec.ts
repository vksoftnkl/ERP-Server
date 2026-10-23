import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierGroup } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSupplierGroupDto } from './dto/save-supplier-group.dto';
import { SupplierGroupService } from './supplier-group.service';
import { SupplierGroupErrorCode } from './types/supplier-group-error-codes';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f001';
const OTHER_GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f002';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f0ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeGroup = (overrides: Partial<SupplierGroup> = {}): SupplierGroup => ({
  spgId: GROUP_ID,
  spgName: 'Fabric Mills',
  spgAlias: 'Mills',
  spgShort: 'FM',
  spgDesc: 'Weaving and processing mills',
  spgIsActive: true,
  spgIsDeleted: false,
  spgSyncDate: null,
  spgCreatedOn: CREATED_ON,
  spgCreatedBy: USER_ID,
  spgModifiedOn: MODIFIED_ON,
  spgModifiedBy: USER_ID,
  ...overrides,
});

type GroupCreateArgs = { data: Prisma.SupplierGroupUncheckedCreateInput };
type GroupUpdateArgs = { where: { spgId: string }; data: Prisma.SupplierGroupUncheckedUpdateInput };
type GroupFindArgs = { where: Record<string, unknown>; select?: Record<string, boolean> };
type GroupFindResult = SupplierGroup | { spgId: string } | null;
type GroupUpdateManyArgs = { where: unknown; data: Record<string, unknown> };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  supplierGroup: {
    findFirst: jest.Mock<Promise<GroupFindResult>, [GroupFindArgs]>;
    create: jest.Mock<Promise<SupplierGroup>, [GroupCreateArgs]>;
    update: jest.Mock<Promise<SupplierGroup>, [GroupUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [GroupUpdateManyArgs]>;
  };
  supplier: { count: jest.Mock<Promise<number>, [unknown]> };
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

const NAME_EXISTS_BODY = {
  success: false,
  message: 'Supplier group name already exists',
  errors: [
    {
      field: 'spgName',
      message: 'Duplicate supplier group name is not allowed',
      code: SupplierGroupErrorCode.NAME_EXISTS,
    },
  ],
};

describe('SupplierGroupService', () => {
  let service: SupplierGroupService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      supplierGroup: {
        // Default: no live group by id, and no other group holds the name.
        findFirst: jest.fn<Promise<GroupFindResult>, [GroupFindArgs]>(() => Promise.resolve(null)),
        create: jest.fn(({ data }: GroupCreateArgs) =>
          Promise.resolve(makeGroup({ ...(data as unknown as Partial<SupplierGroup>) })),
        ),
        update: jest.fn(({ where, data }: GroupUpdateArgs) =>
          Promise.resolve(
            makeGroup({ ...(data as unknown as Partial<SupplierGroup>), spgId: where.spgId }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [GroupUpdateManyArgs]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      supplier: { count: jest.fn<Promise<number>, [unknown]>(() => Promise.resolve(0)) },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new SupplierGroupService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no spgId)', () => {
    it('trims the name, writes the optional fields sent and stamps the creator', async () => {
      const payload = await service.save({
        spgName: '  Fabric Mills ',
        spgAlias: 'Mills',
        spgShort: 'FM',
        spgDesc: null,
        spgIsActive: false,
      });

      const { data } = prisma.supplierGroup.create.mock.calls[0][0];
      expect(data).toEqual({
        spgName: 'Fabric Mills',
        spgAlias: 'Mills',
        spgShort: 'FM',
        spgDesc: null,
        spgIsActive: false,
        spgCreatedOn: expect.any(Date) as Date,
        spgCreatedBy: USER_ID,
      });
      expect(payload).toMatchObject({
        spgId: GROUP_ID,
        spgName: 'Fabric Mills',
        spgDesc: null,
        spgIsActive: false,
        spgSyncDate: null,
        spgCreatedOn: (data.spgCreatedOn as Date).toISOString(),
        spgModifiedOn: MODIFIED_ON.toISOString(),
      });
      expect(prisma.supplierGroup.update).not.toHaveBeenCalled();
    });

    it('leaves out every optional field the body does not carry', async () => {
      await service.save({ spgName: 'Fabric Mills' });

      expect(Object.keys(prisma.supplierGroup.create.mock.calls[0][0].data).sort()).toEqual([
        'spgCreatedBy',
        'spgCreatedOn',
        'spgName',
      ]);
    });

    // A DTO instance owns every declared field (ES2022 class fields), so an unsent
    // optional arrives as undefined — which Prisma skips — never as null.
    it('never nulls an unsent optional on a body that came through the pipe', async () => {
      const dto = await validateDto({ spgName: 'Fabric Mills' }, SaveSupplierGroupDto);

      await service.save(dto);

      const { data } = prisma.supplierGroup.create.mock.calls[0][0];
      expect(data.spgAlias).toBeUndefined();
      expect(data.spgDesc).toBeUndefined();
      expect(data.spgIsActive).toBeUndefined();
    });

    it.each([
      ['the body actor over the request user', { spgCreatedBy: ' clerk1 ' }, USER_ID, 'clerk1'],
      ['the request user when the body names none', {}, USER_ID, USER_ID],
      ['the default actor when there is neither', {}, undefined, DEFAULT_ACTOR],
    ])('stamps %s', async (_label, extra, contextUser, expected) => {
      userId = contextUser;

      await service.save({ spgName: 'Fabric Mills', ...extra });

      expect(prisma.supplierGroup.create.mock.calls[0][0].data.spgCreatedBy).toBe(expected);
      expect(auditLogService.logEntityChange.mock.calls[0][0].userId).toBe(expected);
    });

    it('files a New audit row inside the same transaction', async () => {
      const payload = await service.save({ spgName: 'Fabric Mills' });

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'supplier groups',
        screenName: 'Supplier Group Master',
        screenType: 'master',
        pk: GROUP_ID,
        displayName: 'Fabric Mills',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Supplier group created',
      });
      expect(client).toBe(prisma);
    });

    it('checks the name against live groups in any letter case', async () => {
      await service.save({ spgName: 'fabric mills' });

      expect(prisma.supplierGroup.findFirst).toHaveBeenCalledWith({
        where: { spgIsDeleted: false, spgName: { equals: 'fabric mills', mode: 'insensitive' } },
        select: { spgId: true },
      });
    });

    it('refuses a name another live group holds', async () => {
      prisma.supplierGroup.findFirst.mockResolvedValueOnce({ spgId: OTHER_GROUP_ID });

      const promise = service.save({ spgName: 'Fabric Mills' });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual(NAME_EXISTS_BODY);
      expect(prisma.supplierGroup.create).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('refuses a blank name with PURCHASE_SUPPLIER_GROUP_NAME_REQUIRED before the transaction', async () => {
      const promise = service.save({ spgName: '   ' });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'spgName',
            message: 'spgName must not be empty',
            code: SupplierGroupErrorCode.NAME_REQUIRED,
          },
        ],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('answers a unique violation on the insert as the same name clash', async () => {
      prisma.supplierGroup.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const promise = service.save({ spgName: 'Fabric Mills' });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual(NAME_EXISTS_BODY);
    });

    it('lets any other failure through unchanged', async () => {
      const failure = new Error('connection reset');
      prisma.supplierGroup.create.mockRejectedValueOnce(failure);

      await expect(service.save({ spgName: 'Fabric Mills' })).rejects.toBe(failure);
    });
  });

  describe('save — update (spgId sent)', () => {
    beforeEach(() => {
      // The live row by id; the name probe (which carries spgId: { not }) finds nobody.
      prisma.supplierGroup.findFirst.mockImplementation(({ where }: GroupFindArgs) =>
        Promise.resolve(where.spgId === GROUP_ID ? makeGroup() : null),
      );
    });

    it('updates the live row with the trimmed name and only the optional fields sent', async () => {
      const payload = await service.save({
        spgId: GROUP_ID,
        spgName: ' Weaving Mills ',
        spgDesc: null,
      });

      expect(prisma.supplierGroup.findFirst.mock.calls[0][0]).toEqual({
        where: { spgId: GROUP_ID, spgIsDeleted: false },
      });
      const { where, data } = prisma.supplierGroup.update.mock.calls[0][0];
      expect(where).toEqual({ spgId: GROUP_ID });
      expect(data).toEqual({
        spgName: 'Weaving Mills',
        spgDesc: null,
        spgModifiedOn: expect.any(Date) as Date,
        spgModifiedBy: USER_ID,
      });
      expect(payload).toMatchObject({ spgName: 'Weaving Mills', spgDesc: null });
      expect(prisma.supplierGroup.create).not.toHaveBeenCalled();
    });

    it('skips its own row when checking the name', async () => {
      await service.save({ spgId: GROUP_ID, spgName: 'Fabric Mills' });

      expect(prisma.supplierGroup.findFirst.mock.calls[1][0]).toEqual({
        where: {
          spgIsDeleted: false,
          spgName: { equals: 'Fabric Mills', mode: 'insensitive' },
          spgId: { not: GROUP_ID },
        },
        select: { spgId: true },
      });
    });

    it('stamps the body modifier over the request user', async () => {
      await service.save({ spgId: GROUP_ID, spgName: 'Fabric Mills', spgModifiedBy: 'clerk2' });

      expect(prisma.supplierGroup.update.mock.calls[0][0].data.spgModifiedBy).toBe('clerk2');
      expect(auditLogService.logEntityChange.mock.calls[0][0].userId).toBe('clerk2');
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save({ spgId: GROUP_ID, spgName: 'Weaving Mills' });

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        tableName: 'supplier groups',
        screenName: 'Supplier Group Master',
        pk: GROUP_ID,
        displayName: 'Weaving Mills',
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Supplier group updated',
      });
      expect(entry.originalRecord).toMatchObject({ spgName: 'Fabric Mills' });
      expect(client).toBe(prisma);
    });

    it('refuses an id with no live group', async () => {
      prisma.supplierGroup.findFirst.mockReset();
      prisma.supplierGroup.findFirst.mockResolvedValue(null);

      const promise = service.save({ spgId: GROUP_ID, spgName: 'Fabric Mills' });

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Supplier group not found',
        errors: [
          {
            field: 'spgId',
            message: `No active supplier group found with id ${GROUP_ID}`,
            code: SupplierGroupErrorCode.NOT_FOUND,
          },
        ],
      });
      expect(prisma.supplierGroup.update).not.toHaveBeenCalled();
    });

    it('refuses a blank name', async () => {
      const promise = service.save({ spgId: GROUP_ID, spgName: ' ' });

      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [expect.objectContaining({ code: SupplierGroupErrorCode.NAME_REQUIRED })],
      });
      expect(prisma.supplierGroup.update).not.toHaveBeenCalled();
    });

    it('refuses a name another live group holds', async () => {
      prisma.supplierGroup.findFirst.mockImplementation(({ where }: GroupFindArgs) =>
        Promise.resolve(where.spgId === GROUP_ID ? makeGroup() : { spgId: OTHER_GROUP_ID }),
      );

      await expect(bodyOf(service.save({ spgId: GROUP_ID, spgName: 'Taken' }))).resolves.toEqual(
        NAME_EXISTS_BODY,
      );
      expect(prisma.supplierGroup.update).not.toHaveBeenCalled();
    });

    it('answers a unique violation on the write as the name clash', async () => {
      prisma.supplierGroup.update.mockRejectedValueOnce(
        Object.assign(new Error('Raw query failed'), { code: 'P2010', meta: { code: '23505' } }),
      );

      await expect(
        bodyOf(service.save({ spgId: GROUP_ID, spgName: 'Fabric Mills' })),
      ).resolves.toEqual(NAME_EXISTS_BODY);
    });
  });

  describe('getById', () => {
    it('reads a live group only', async () => {
      prisma.supplierGroup.findFirst.mockResolvedValueOnce(
        makeGroup({ spgSyncDate: new Date('2026-10-03T09:00:00.000Z') }),
      );

      await expect(service.getById(GROUP_ID)).resolves.toEqual({
        spgId: GROUP_ID,
        spgName: 'Fabric Mills',
        spgAlias: 'Mills',
        spgShort: 'FM',
        spgDesc: 'Weaving and processing mills',
        spgIsActive: true,
        spgIsDeleted: false,
        spgSyncDate: '2026-10-03T09:00:00.000Z',
        spgCreatedOn: CREATED_ON.toISOString(),
        spgCreatedBy: USER_ID,
        spgModifiedOn: MODIFIED_ON.toISOString(),
        spgModifiedBy: USER_ID,
      });
      expect(prisma.supplierGroup.findFirst).toHaveBeenCalledWith({
        where: { spgId: GROUP_ID, spgIsDeleted: false },
      });
    });

    it('refuses an id with no live group', async () => {
      const promise = service.getById(GROUP_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [expect.objectContaining({ code: SupplierGroupErrorCode.NOT_FOUND })],
      });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.supplierGroup.findFirst.mockResolvedValue(makeGroup());
    });

    it('marks a group with no live suppliers deleted and inactive', async () => {
      await expect(service.softDelete(GROUP_ID)).resolves.toEqual({
        spgId: GROUP_ID,
        deleted: true,
      });

      expect(prisma.supplier.count).toHaveBeenCalledWith({
        where: { supGroupId: GROUP_ID, supIsDeleted: false },
      });
      const [{ where, data }] = prisma.supplierGroup.updateMany.mock.calls[0];
      expect(where).toEqual({ spgId: GROUP_ID, spgIsDeleted: false });
      expect(data).toEqual({
        spgIsDeleted: true,
        spgIsActive: false,
        spgModifiedOn: expect.any(Date) as Date,
        spgModifiedBy: USER_ID,
      });
    });

    it('files a cancel audit row holding the row before and after', async () => {
      await service.softDelete(GROUP_ID);

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        tableName: 'supplier groups',
        pk: GROUP_ID,
        displayName: 'Fabric Mills',
        userId: USER_ID,
        notes: 'Supplier group soft deleted',
      });
      expect(entry.originalRecord).toMatchObject({ spgIsDeleted: false, spgIsActive: true });
      expect(entry.modifiedRecord).toMatchObject({ spgIsDeleted: true, spgIsActive: false });
      expect(client).toBe(prisma);
    });

    it('refuses while live suppliers still point at the group', async () => {
      prisma.supplier.count.mockResolvedValueOnce(3);

      const promise = service.softDelete(GROUP_ID);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Cannot delete supplier group with active suppliers',
        errors: [
          {
            field: 'spgId',
            message: `Supplier group ${GROUP_ID} is used by 3 supplier(s).`,
            code: SupplierGroupErrorCode.HAS_SUPPLIERS,
          },
        ],
      });
      expect(prisma.supplierGroup.updateMany).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('refuses an id with no live group before counting suppliers', async () => {
      prisma.supplierGroup.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(GROUP_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.supplier.count).not.toHaveBeenCalled();
      expect(prisma.supplierGroup.updateMany).not.toHaveBeenCalled();
    });

    // Someone else deleted it between the read and the write.
    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.supplierGroup.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(GROUP_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
