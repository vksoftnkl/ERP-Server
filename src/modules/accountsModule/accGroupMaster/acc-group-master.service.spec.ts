import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AccGroupMaster, Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccGroupMasterService } from './acc-group-master.service';
import { SaveAccGroupMasterDto } from './dto/save-acc-group-master.dto';
import { AccGroupErrorCode } from './types/acc-group-master-error-codes';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f201';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f202';
const ROOT_ID = '019c6f6c-be87-7a11-8905-36092c46f210';
const PARENT_ID = '019c6f6c-be87-7a11-8905-36092c46f211';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f212';
const CHILD_ID = '019c6f6c-be87-7a11-8905-36092c46f213';
const GRANDCHILD_ID = '019c6f6c-be87-7a11-8905-36092c46f214';
const OTHER_PARENT_ID = '019c6f6c-be87-7a11-8905-36092c46f215';
const NEW_ID = '019c6f6c-be87-7a11-8905-36092c46f2aa';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f2ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeGroup = (overrides: Partial<AccGroupMaster> = {}): AccGroupMaster => ({
  accGroupId: GROUP_ID,
  accGroupCompanyId: COMPANY_ID,
  accGroupName: 'Sundry Debtors - North',
  accGroupAlias: null,
  accGroupShort: null,
  accGroupDescription: null,
  accGroupTallyName: null,
  accGroupPrimaryName: null,
  accGroupNature: 'Assets',
  accLedgerProfile: 'Party',
  accGroupTallyGuid: null,
  accGroupTallyMasterId: null,
  accGroupTallyAlterId: null,
  accGroupParentId: PARENT_ID,
  accGroupSort: null,
  accGroupType: 'BALANCESHEET',
  accGroupIsDefault: false,
  accGroupIsReserved: false,
  accGroupBehaveAsSubledger: false,
  accGroupNetDebitCredit: false,
  accGroupUsedForCalculation: false,
  accGroupAffectsGrossProfit: false,
  accGroupIsActive: true,
  accGroupIsDeleted: false,
  accGroupSyncDate: null,
  accGroupCreatedOn: CREATED_ON,
  accGroupCreatedBy: USER_ID,
  accGroupModifiedOn: MODIFIED_ON,
  accGroupModifiedBy: USER_ID,
  ...overrides,
});

type Where = Record<string, unknown>;
type Args = { where: Where; data?: Record<string, unknown>; select?: unknown };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  accGroupMaster: {
    findFirst: jest.Mock<Promise<unknown>, [Args]>;
    findMany: jest.Mock<Promise<Array<{ accGroupId: string }>>, [Args]>;
    count: jest.Mock<Promise<number>, [Args]>;
    create: jest.Mock<Promise<AccGroupMaster>, [Args]>;
    update: jest.Mock<Promise<AccGroupMaster>, [Args]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Args]>;
  };
  accLedgerMaster: { count: jest.Mock<Promise<number>, [Args]> };
  company: { findFirst: jest.Mock<Promise<{ compName: string } | null>, [Args]> };
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

describe('AccGroupMasterService', () => {
  let service: AccGroupMasterService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;
  /** The live tree: ROOT > PARENT > GROUP > CHILD > GRANDCHILD, plus OTHER_PARENT under ROOT. */
  let groups: Map<string, AccGroupMaster>;
  /** What the name probe finds — null for no clash. */
  let nameClash: { accGroupId: string; accGroupCompanyId: string | null } | null;

  beforeEach(() => {
    userId = USER_ID;
    nameClash = null;
    groups = new Map(
      [
        makeGroup({
          accGroupId: ROOT_ID,
          accGroupName: 'Current Assets',
          accGroupParentId: null,
          accGroupIsReserved: true,
          accGroupCompanyId: null,
        }),
        makeGroup({
          accGroupId: PARENT_ID,
          accGroupName: 'Sundry Debtors',
          accGroupParentId: ROOT_ID,
        }),
        makeGroup(),
        makeGroup({
          accGroupId: CHILD_ID,
          accGroupName: 'Debtors - Delhi',
          accGroupParentId: GROUP_ID,
        }),
        makeGroup({
          accGroupId: GRANDCHILD_ID,
          accGroupName: 'Debtors - Karol Bagh',
          accGroupParentId: CHILD_ID,
        }),
        makeGroup({
          accGroupId: OTHER_PARENT_ID,
          accGroupName: 'Indirect Expenses',
          accGroupParentId: ROOT_ID,
          accGroupCompanyId: OTHER_COMPANY_ID,
          accGroupType: 'PROFITANDLOSS',
          accLedgerProfile: 'General',
          accGroupNature: 'Expenses',
        }),
      ].map((group) => [group.accGroupId, group]),
    );
    const live = (id: unknown) => {
      const group = typeof id === 'string' ? groups.get(id) : undefined;
      return group && !group.accGroupIsDeleted ? group : null;
    };
    prisma = {
      accGroupMaster: {
        findFirst: jest.fn<Promise<unknown>, [Args]>(({ where }) =>
          Promise.resolve('accGroupName' in where ? nameClash : live(where.accGroupId)),
        ),
        findMany: jest.fn<Promise<Array<{ accGroupId: string }>>, [Args]>(({ where }) =>
          Promise.resolve(
            [...groups.values()]
              .filter((g) => g.accGroupParentId === where.accGroupParentId && !g.accGroupIsDeleted)
              .map((g) => ({ accGroupId: g.accGroupId })),
          ),
        ),
        count: jest.fn<Promise<number>, [Args]>(() => Promise.resolve(0)),
        create: jest.fn<Promise<AccGroupMaster>, [Args]>(({ data }) => {
          const created = makeGroup({ ...(data as Partial<AccGroupMaster>), accGroupId: NEW_ID });
          groups.set(NEW_ID, created);
          return Promise.resolve(created);
        }),
        update: jest.fn<Promise<AccGroupMaster>, [Args]>(({ where, data }) => {
          const merged: AccGroupMaster = {
            ...groups.get(where.accGroupId as string)!,
            ...Object.fromEntries(Object.entries(data!).filter(([, v]) => v !== undefined)),
          };
          return Promise.resolve(merged);
        }),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Args]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      accLedgerMaster: { count: jest.fn<Promise<number>, [Args]>(() => Promise.resolve(0)) },
      company: {
        findFirst: jest.fn<Promise<{ compName: string } | null>, [Args]>(() =>
          Promise.resolve({ compName: 'Acme Textiles' }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new AccGroupMasterService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  /** The name probe the service sent (the findFirst whose where names accGroupName). */
  const nameProbe = (): Where | undefined =>
    prisma.accGroupMaster.findFirst.mock.calls
      .map(([args]) => args.where)
      .find((w) => 'accGroupName' in w);

  describe('save — create (no accGroupId)', () => {
    const createDto = (overrides: Partial<SaveAccGroupMasterDto> = {}): SaveAccGroupMasterDto => ({
      accGroupName: 'Debtors - West',
      accGroupParentId: PARENT_ID,
      ...overrides,
    });

    it('inherits company, type, ledger profile and nature from the parent', async () => {
      const payload = await service.save(createDto({ accGroupName: '  Debtors - West ' }));

      expect(prisma.accGroupMaster.create.mock.calls[0][0].data).toEqual({
        accGroupCompanyId: COMPANY_ID,
        accGroupName: 'Debtors - West',
        accGroupType: 'BALANCESHEET',
        accLedgerProfile: 'Party',
        accGroupNature: 'Assets',
        accGroupCreatedOn: expect.any(Date) as Date,
        accGroupCreatedBy: USER_ID,
        accGroupParentId: PARENT_ID,
      });
      expect(payload).toMatchObject({
        accGroupId: NEW_ID,
        accGroupName: 'Debtors - West',
        accGroupParentId: PARENT_ID,
        accGroupParentName: 'Sundry Debtors',
        accGroupCompanyName: null,
      });
    });

    it('writes the alias, sort and the four Tally flags when sent', async () => {
      await service.save(
        createDto({
          accGroupAlias: 'West',
          accGroupShort: 'DW',
          accGroupDescription: null,
          accGroupSort: 4,
          accGroupBehaveAsSubledger: true,
          accGroupNetDebitCredit: true,
          accGroupUsedForCalculation: false,
          accGroupAffectsGrossProfit: true,
          accGroupIsActive: false,
        }),
      );

      expect(prisma.accGroupMaster.create.mock.calls[0][0].data).toMatchObject({
        accGroupAlias: 'West',
        accGroupShort: 'DW',
        accGroupDescription: null,
        accGroupSort: 4,
        accGroupBehaveAsSubledger: true,
        accGroupNetDebitCredit: true,
        accGroupUsedForCalculation: false,
        accGroupAffectsGrossProfit: true,
        accGroupIsActive: false,
      });
    });

    it('refuses a group with no parent', async () => {
      const promise = service.save(createDto({ accGroupParentId: null }));

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Parent account group is required',
        errors: [
          {
            field: 'accGroupParentId',
            message: 'accGroupParentId is required to create an account group',
            code: AccGroupErrorCode.PARENT_REQUIRED,
          },
        ],
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a parent with no live row', async () => {
      groups.get(PARENT_ID)!.accGroupIsDeleted = true;

      await expect(bodyOf(service.save(createDto()))).resolves.toEqual({
        success: false,
        message: 'Parent account group does not exist',
        errors: [
          {
            field: 'accGroupParentId',
            message: `No active account group found with id ${PARENT_ID}`,
            code: AccGroupErrorCode.PARENT_NOT_FOUND,
          },
        ],
      });
    });

    it('refuses a blank name before reading the parent', async () => {
      await expect(bodyOf(service.save(createDto({ accGroupName: '  ' })))).resolves.toMatchObject({
        errors: [{ field: 'accGroupName', code: 'VALIDATION_IS_NOT_EMPTY' }],
      });
      expect(prisma.accGroupMaster.findFirst).not.toHaveBeenCalled();
    });

    it('files a New audit row inside the same transaction', async () => {
      const payload = await service.save(createDto());

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'account groups',
        screenName: 'Account Group Master',
        screenType: 'master',
        pk: NEW_ID,
        displayName: 'Debtors - West',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Account group created',
      });
      expect(client).toBe(prisma);
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save(createDto());

      expect(prisma.accGroupMaster.create.mock.calls[0][0].data!.accGroupCreatedBy).toBe(
        DEFAULT_ACTOR,
      );
    });

    describe('name uniqueness — what one company can see', () => {
      // A scoped write must clash with neither its own company nor the shared pool.
      it('checks a company group against its company and the shared groups', async () => {
        await service.save(createDto());

        expect(nameProbe()).toEqual({
          accGroupIsDeleted: false,
          OR: [{ accGroupCompanyId: COMPANY_ID }, { accGroupCompanyId: null }],
          accGroupName: { equals: 'Debtors - West', mode: 'insensitive' },
        });
      });

      // A shared group is seen from every company: it must clash with nothing at all.
      it('checks a shared group against every group', async () => {
        groups.get(PARENT_ID)!.accGroupCompanyId = null;

        await service.save(createDto());

        expect(nameProbe()).toEqual({
          accGroupIsDeleted: false,
          accGroupName: { equals: 'Debtors - West', mode: 'insensitive' },
        });
      });

      it.each([
        [
          'the same company',
          COMPANY_ID,
          { accGroupId: CHILD_ID, accGroupCompanyId: COMPANY_ID },
          'Duplicate accGroupName is not allowed for this company',
        ],
        [
          'a shared group this company sees',
          COMPANY_ID,
          { accGroupId: ROOT_ID, accGroupCompanyId: null },
          'Account group "Debtors - West" already exists as a shared group, which this company also sees',
        ],
        [
          'another shared group',
          null,
          { accGroupId: ROOT_ID, accGroupCompanyId: null },
          'Account group "Debtors - West" already exists as a shared group',
        ],
        [
          'one company, for a new shared group',
          null,
          { accGroupId: CHILD_ID, accGroupCompanyId: OTHER_COMPANY_ID },
          'Account group "Debtors - West" already exists in one company, and a shared group is visible from every company',
        ],
      ])('refuses a name held by %s', async (_label, parentCompanyId, clash, message) => {
        groups.get(PARENT_ID)!.accGroupCompanyId = parentCompanyId;
        nameClash = clash;

        const promise = service.save(createDto());

        await expect(promise).rejects.toBeInstanceOf(ConflictException);
        await expect(bodyOf(promise)).resolves.toEqual({
          success: false,
          message: 'Account group name already exists',
          errors: [{ field: 'accGroupName', message, code: AccGroupErrorCode.NAME_TAKEN }],
        });
        expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
      });
    });

    it('answers a unique violation as the name taken', async () => {
      prisma.accGroupMaster.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(bodyOf(service.save(createDto()))).resolves.toEqual({
        success: false,
        message: 'Account group already exists',
        errors: [
          {
            field: 'accGroupName',
            message: 'Duplicate accGroupName is not allowed',
            code: AccGroupErrorCode.NAME_TAKEN,
          },
        ],
      });
    });

    it('answers a foreign-key violation as ACC_GROUP_REFERENCE_INVALID', async () => {
      prisma.accGroupMaster.create.mockRejectedValueOnce(
        Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }),
      );

      await expect(bodyOf(service.save(createDto()))).resolves.toMatchObject({
        message: 'Invalid reference value provided',
        errors: [{ field: 'accGroupCompanyId', code: AccGroupErrorCode.REFERENCE_INVALID }],
      });
    });
  });

  describe('save — update (accGroupId sent)', () => {
    const updateDto = (overrides: Partial<SaveAccGroupMasterDto> = {}): SaveAccGroupMasterDto => ({
      accGroupId: GROUP_ID,
      accGroupName: 'Sundry Debtors - North',
      ...overrides,
    });

    it('renames in place, keeping the parent when the body does not carry it', async () => {
      const payload = await service.save(updateDto({ accGroupName: ' Debtors - North ' }));

      const { where, data } = prisma.accGroupMaster.update.mock.calls[0][0];
      expect(where).toEqual({ accGroupId: GROUP_ID });
      expect(data).toEqual({
        accGroupCompanyId: COMPANY_ID,
        accGroupName: 'Debtors - North',
        accGroupType: 'BALANCESHEET',
        accLedgerProfile: 'Party',
        accGroupNature: 'Assets',
        accGroupModifiedOn: expect.any(Date) as Date,
        accGroupModifiedBy: USER_ID,
      });
      expect(payload).toMatchObject({
        accGroupName: 'Debtors - North',
        accGroupParentId: PARENT_ID,
        accGroupParentName: 'Sundry Debtors',
      });
    });

    it('moves under a new parent and takes its company, type, profile and nature', async () => {
      await service.save(updateDto({ accGroupParentId: OTHER_PARENT_ID }));

      expect(prisma.accGroupMaster.update.mock.calls[0][0].data).toMatchObject({
        accGroupParentId: OTHER_PARENT_ID,
        accGroupCompanyId: OTHER_COMPANY_ID,
        accGroupType: 'PROFITANDLOSS',
        accLedgerProfile: 'General',
        accGroupNature: 'Expenses',
      });
    });

    it('makes a root keep its own company, type, profile and nature', async () => {
      await service.save(updateDto({ accGroupParentId: null }));

      const { data } = prisma.accGroupMaster.update.mock.calls[0][0];
      expect(data).toMatchObject({ accGroupParentId: null, accGroupCompanyId: COMPANY_ID });
      expect(data).not.toHaveProperty('accGroupType');
      expect(data).not.toHaveProperty('accLedgerProfile');
      expect(data).not.toHaveProperty('accGroupNature');
    });

    it('refuses the group as its own parent', async () => {
      await expect(
        bodyOf(service.save(updateDto({ accGroupParentId: GROUP_ID }))),
      ).resolves.toEqual({
        success: false,
        message: 'Account group cannot be its own parent',
        errors: [
          {
            field: 'accGroupParentId',
            message: 'accGroupParentId cannot be same as accGroupId',
            code: AccGroupErrorCode.OWN_PARENT,
          },
        ],
      });
      expect(prisma.accGroupMaster.update).not.toHaveBeenCalled();
    });

    it.each([
      ['its child', CHILD_ID],
      ['its grandchild', GRANDCHILD_ID],
    ])('refuses a move under %s', async (_label, parentId) => {
      await expect(
        bodyOf(service.save(updateDto({ accGroupParentId: parentId }))),
      ).resolves.toEqual({
        success: false,
        message: 'Circular hierarchy is not allowed',
        errors: [
          {
            field: 'accGroupParentId',
            message: 'Parent cannot be a child of the same account group',
            code: AccGroupErrorCode.CIRCULAR,
          },
        ],
      });
      expect(prisma.accGroupMaster.update).not.toHaveBeenCalled();
    });

    it('does not walk the subtree when the parent is unchanged', async () => {
      await service.save(updateDto({ accGroupParentId: PARENT_ID }));

      expect(prisma.accGroupMaster.findMany).not.toHaveBeenCalled();
    });

    it('refuses a reserved group', async () => {
      await expect(
        bodyOf(service.save({ accGroupId: ROOT_ID, accGroupName: 'Current Assets' })),
      ).resolves.toEqual({
        success: false,
        message: 'Reserved account group cannot be edited',
        errors: [
          {
            field: 'accGroupId',
            message: `Account group ${ROOT_ID} is reserved and cannot be edited`,
            code: AccGroupErrorCode.RESERVED_EDIT,
          },
        ],
      });
    });

    it('refuses an id with no live group', async () => {
      const promise = service.save(updateDto({ accGroupId: NEW_ID }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [{ field: 'accGroupId', code: AccGroupErrorCode.NOT_FOUND }],
      });
    });

    // A legacy pair that already breaks the shared-name rule must stay editable.
    it('skips the name check when neither the name nor the company changes', async () => {
      nameClash = { accGroupId: ROOT_ID, accGroupCompanyId: null };

      await service.save(updateDto({ accGroupName: 'SUNDRY DEBTORS - NORTH', accGroupSort: 2 }));

      expect(nameProbe()).toBeUndefined();
      expect(prisma.accGroupMaster.update).toHaveBeenCalledTimes(1);
    });

    it('checks a new name, skipping its own row', async () => {
      await service.save(updateDto({ accGroupName: 'Debtors - East' }));

      expect(nameProbe()).toEqual({
        accGroupIsDeleted: false,
        OR: [{ accGroupCompanyId: COMPANY_ID }, { accGroupCompanyId: null }],
        accGroupName: { equals: 'Debtors - East', mode: 'insensitive' },
        accGroupId: { not: GROUP_ID },
      });
    });

    it('files an update audit row with the parent names before and after', async () => {
      const payload = await service.save(updateDto({ accGroupParentId: OTHER_PARENT_ID }));

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        pk: GROUP_ID,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Account group updated',
      });
      expect(entry.originalRecord).toMatchObject({ accGroupParentName: 'Sundry Debtors' });
      expect(entry.modifiedRecord).toMatchObject({ accGroupParentName: 'Indirect Expenses' });
      expect(client).toBe(prisma);
    });
  });

  describe('getById', () => {
    it('returns the group with its parent and company names', async () => {
      await expect(service.getById(GROUP_ID)).resolves.toMatchObject({
        accGroupId: GROUP_ID,
        accGroupParentName: 'Sundry Debtors',
        accGroupCompanyName: 'Acme Textiles',
        accGroupCreatedOn: CREATED_ON.toISOString(),
        accGroupSyncDate: null,
      });
      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID },
        select: { compName: true },
      });
    });

    it('sends the Tally ids as strings', async () => {
      groups.set(
        GROUP_ID,
        makeGroup({ accGroupTallyMasterId: 9007199254740993n, accGroupTallyAlterId: 7n }),
      );

      await expect(service.getById(GROUP_ID)).resolves.toMatchObject({
        accGroupTallyMasterId: '9007199254740993',
        accGroupTallyAlterId: '7',
      });
    });

    it('names no parent or company for a shared root', async () => {
      await expect(service.getById(ROOT_ID)).resolves.toMatchObject({
        accGroupParentName: null,
        accGroupCompanyName: null,
      });
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
    });

    it('refuses an id with no live group', async () => {
      await expect(bodyOf(service.getById(NEW_ID))).resolves.toEqual({
        success: false,
        message: 'Account group not found',
        errors: [
          {
            field: 'accGroupId',
            message: `No active account group found with id ${NEW_ID}`,
            code: AccGroupErrorCode.NOT_FOUND,
          },
        ],
      });
    });
  });

  describe('softDelete', () => {
    it('marks a leaf group with no ledgers deleted and inactive and files a cancel audit row', async () => {
      await expect(service.softDelete(GRANDCHILD_ID)).resolves.toEqual({
        accGroupId: GRANDCHILD_ID,
        deleted: true,
      });

      expect(prisma.accGroupMaster.count).toHaveBeenCalledWith({
        where: { accGroupParentId: GRANDCHILD_ID, accGroupIsDeleted: false },
      });
      expect(prisma.accLedgerMaster.count).toHaveBeenCalledWith({
        where: { ledGroupId: GRANDCHILD_ID, ledIsDeleted: false },
      });
      expect(prisma.accGroupMaster.updateMany.mock.calls[0][0]).toEqual({
        where: { accGroupId: GRANDCHILD_ID, accGroupIsDeleted: false },
        data: {
          accGroupIsDeleted: true,
          accGroupIsActive: false,
          accGroupModifiedOn: expect.any(Date) as Date,
          accGroupModifiedBy: USER_ID,
        },
      });
      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        pk: GRANDCHILD_ID,
        displayName: 'Debtors - Karol Bagh',
        notes: 'Account group soft deleted',
      });
      expect(entry.modifiedRecord).toMatchObject({
        accGroupIsDeleted: true,
        accGroupIsActive: false,
      });
    });

    it.each([
      [
        'a reserved group',
        () => ROOT_ID,
        'Reserved account group cannot be deleted',
        AccGroupErrorCode.RESERVED_DELETE,
      ],
      [
        'a group with live children',
        () => {
          prisma.accGroupMaster.count.mockResolvedValueOnce(1);
          return GROUP_ID;
        },
        'Cannot delete account group with active children',
        AccGroupErrorCode.HAS_CHILDREN,
      ],
      [
        'a group live ledgers belong to',
        () => {
          prisma.accLedgerMaster.count.mockResolvedValueOnce(3);
          return GRANDCHILD_ID;
        },
        'Cannot delete account group with active ledgers',
        AccGroupErrorCode.HAS_LEDGERS,
      ],
    ])('refuses %s', async (_label, arrange, message, code) => {
      const promise = service.softDelete(arrange());

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        message,
        errors: [{ field: 'accGroupId', code }],
      });
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });

    it('names the ledger count in the refusal', async () => {
      prisma.accLedgerMaster.count.mockResolvedValueOnce(3);

      await expect(bodyOf(service.softDelete(GRANDCHILD_ID))).resolves.toMatchObject({
        errors: [{ message: `Account group ${GRANDCHILD_ID} is used by 3 ledger(s).` }],
      });
    });

    it('refuses an id with no live group', async () => {
      await expect(service.softDelete(NEW_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.accGroupMaster.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(GRANDCHILD_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
