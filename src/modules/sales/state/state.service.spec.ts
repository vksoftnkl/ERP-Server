import { HttpException } from '@nestjs/common';
import { Prisma, StateMaster } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { StateService } from './state.service';
import { StateErrorCode } from './types/state-error-codes';
import { STATES_ACCOUNT_GROUP_ID } from './utils/state.utils';

const STATE_ID = '019c6f6c-be87-7a11-8905-36092c46a101';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46a102';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a103';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a104';
const OTHER_PARENT_ID = '019c6f6c-be87-7a11-8905-36092c46a105';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const stateRow = (overrides: Partial<StateMaster> = {}): StateMaster => ({
  stmId: STATE_ID,
  stmName: 'Kerala',
  stmAlias: null,
  stmShort: 'KL',
  stmOrder: new Prisma.Decimal(3),
  stmDescription: null,
  stmIsActive: true,
  stmIsDeleted: false,
  stmSyncDate: null,
  stmCreatedOn: STAMP,
  stmCreatedBy: USER_ID,
  stmModifiedOn: STAMP,
  stmModifiedBy: USER_ID,
  ...overrides,
});

/** The parent group the state's own group inherits its accounting fields from. */
const PARENT_GROUP = {
  accGroupCompanyId: COMPANY_ID,
  accGroupType: 'PRIMARY',
  accLedgerProfile: 'PARTY',
  accGroupNature: 'ASSET',
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

type PrismaMock = {
  stateMaster: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  cityMaster: { count: jest.Mock };
  accGroupMaster: { findFirst: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('StateService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: StateService;

  beforeEach(() => {
    prisma = {
      stateMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<StateMaster> }) => stateRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<StateMaster> }) => stateRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cityMaster: { count: jest.fn().mockResolvedValue(0) },
      accGroupMaster: {
        findFirst: jest.fn().mockResolvedValue(PARENT_GROUP),
        create: jest.fn().mockResolvedValue({ accGroupId: GROUP_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new StateService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const groupCreateData = () =>
    (prisma.accGroupMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const stateCreateData = () =>
    (prisma.stateMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const groupMirror = () =>
    prisma.accGroupMaster.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('createStateMaster', () => {
    it('refuses a blank name before opening a transaction', async () => {
      const refusal = await refusalOf(service.createStateMaster({ stmName: '  ' }, USER_ID));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'stmName', code: StateErrorCode.NAME_REQUIRED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a name another live state holds, compared case-insensitively', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue({ stmId: 'other' });

      const refusal = await refusalOf(service.createStateMaster({ stmName: 'kerala' }, USER_ID));

      expect(prisma.stateMaster.findFirst).toHaveBeenCalledWith({
        where: { stmIsDeleted: false, stmName: { equals: 'kerala', mode: 'insensitive' } },
        select: { stmId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'stmName', code: StateErrorCode.NAME_EXISTS }] },
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
    });

    it('refuses when the parent account group is gone, before creating either row', async () => {
      prisma.accGroupMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.createStateMaster({ stmName: 'Kerala' }, USER_ID));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'parentId', code: StateErrorCode.PARENT_GROUP_NOT_FOUND }] },
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
      expect(prisma.stateMaster.create).not.toHaveBeenCalled();
    });

    it('creates the account group under the fixed States group, inheriting its accounting fields', async () => {
      await service.createStateMaster(
        { stmName: ' Kerala ', stmShort: 'KL', stmAlias: 'God’s own', stmOrder: 3 },
        USER_ID,
      );

      expect(prisma.accGroupMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accGroupId: STATES_ACCOUNT_GROUP_ID, accGroupIsDeleted: false },
        }),
      );
      expect(groupCreateData()).toEqual({
        accGroupName: 'Kerala',
        accGroupShort: 'KL',
        accGroupDescription: null,
        accGroupSort: 3,
        accGroupParentId: STATES_ACCOUNT_GROUP_ID,
        ...PARENT_GROUP,
        accGroupIsActive: true,
        accGroupIsDeleted: false,
        accGroupCreatedOn: expect.any(Date),
        accGroupCreatedBy: USER_ID,
        accGroupModifiedOn: expect.any(Date),
        accGroupModifiedBy: USER_ID,
      });
      // The alias lives on the state row only.
      expect(groupCreateData()).not.toHaveProperty('accGroupAlias');
    });

    it('gives the state the account group id as its own id', async () => {
      const result = await service.createStateMaster({ stmName: 'Kerala' }, USER_ID);

      expect(stateCreateData()).toMatchObject({
        stmId: GROUP_ID,
        stmName: 'Kerala',
        stmOrder: 0,
        stmIsActive: true,
        stmIsDeleted: false,
        stmCreatedBy: USER_ID,
      });
      expect(result.accGroupId).toBe(GROUP_ID);
      expect(result.stateMaster.stmId).toBe(GROUP_ID);
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'state master',
        pk: GROUP_ID,
        originalRecord: null,
        modifiedRecord: result.stateMaster,
        notes: 'State created with linked account group',
      });
    });

    it('creates the group under the parent a caller names', async () => {
      await service.createStateMaster({ stmName: 'Kerala' }, USER_ID, OTHER_PARENT_ID);

      expect(groupCreateData().accGroupParentId).toBe(OTHER_PARENT_ID);
    });

    it('truncates a fractional order and caps the description to fit the group columns', async () => {
      const description = 'x'.repeat(300);

      await service.createStateMaster(
        { stmName: 'Kerala', stmOrder: 2.75, stmDescription: description },
        USER_ID,
      );

      expect(groupCreateData()).toMatchObject({
        accGroupSort: 2,
        accGroupDescription: 'x'.repeat(250),
      });
      expect(stateCreateData()).toMatchObject({ stmOrder: 2.75, stmDescription: description });
    });

    it('creates an inactive state as deleted, on both rows', async () => {
      await service.createStateMaster({ stmName: 'Kerala', stmIsActive: false }, USER_ID);

      expect(groupCreateData()).toMatchObject({
        accGroupIsActive: false,
        accGroupIsDeleted: true,
      });
      expect(stateCreateData()).toMatchObject({ stmIsActive: false, stmIsDeleted: true });
    });

    it('answers a unique-index race (P2002) with a 409', async () => {
      prisma.stateMaster.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.createStateMaster({ stmName: 'Kerala' }, USER_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'stmName', code: StateErrorCode.NAME_EXISTS }] },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.accGroupMaster.create.mockRejectedValue(failure);

      await expect(service.createStateMaster({ stmName: 'Kerala' }, USER_ID)).rejects.toBe(failure);
    });
  });

  describe('save without stmId', () => {
    it('creates through createStateMaster as the request user and returns the bare state', async () => {
      const payload = await service.save({ stmName: 'Kerala' });

      expect(groupCreateData().accGroupCreatedBy).toBe(USER_ID);
      expect(payload).toMatchObject({ stmId: GROUP_ID, stmName: 'Kerala', stmOrder: 0 });
      expect(payload).not.toHaveProperty('accGroupId');
    });
  });

  describe('save with stmId (update)', () => {
    beforeEach(() => {
      prisma.stateMaster.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          // The existence read names the id alone; the duplicate-name read names the name.
          'stmName' in where ? null : stateRow(),
      );
    });

    it('refuses an id that names no live state', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save({ stmId: STATE_ID, stmName: 'Kerala' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'stmId', code: StateErrorCode.NOT_FOUND }] },
      });
      expect(prisma.stateMaster.update).not.toHaveBeenCalled();
    });

    it('refuses a blank name', async () => {
      const refusal = await refusalOf(service.save({ stmId: STATE_ID, stmName: ' ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: StateErrorCode.NAME_REQUIRED }] },
      });
    });

    it('checks the new name against every state but itself', async () => {
      prisma.stateMaster.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'stmName' in where ? { stmId: 'other' } : stateRow(),
      );

      const refusal = await refusalOf(service.save({ stmId: STATE_ID, stmName: 'Goa' }));

      expect(prisma.stateMaster.findFirst).toHaveBeenLastCalledWith({
        where: {
          stmIsDeleted: false,
          stmName: { equals: 'Goa', mode: 'insensitive' },
          stmId: { not: STATE_ID },
        },
        select: { stmId: true },
      });
      expect(refusal.status).toBe(409);
      expect(prisma.stateMaster.update).not.toHaveBeenCalled();
    });

    it('writes the name and the optional fields sent, stamped by stmModifiedBy', async () => {
      await service.save({
        stmId: STATE_ID,
        stmName: ' Kerala State ',
        stmShort: 'KER',
        stmModifiedBy: 'gst-sync',
      });

      expect(prisma.stateMaster.update).toHaveBeenCalledWith({
        where: { stmId: STATE_ID },
        data: {
          stmName: 'Kerala State',
          stmModifiedOn: expect.any(Date),
          stmModifiedBy: 'gst-sync',
          stmShort: 'KER',
        },
      });
    });

    it('mirrors the updated row onto the linked account group', async () => {
      prisma.stateMaster.update.mockResolvedValue(
        stateRow({
          stmName: 'Kerala State',
          stmShort: 'KER',
          stmOrder: new Prisma.Decimal('4.9'),
          stmDescription: 'd'.repeat(260),
          stmIsActive: false,
          stmModifiedOn: new Date('2026-10-19T06:00:00.000Z'),
          stmModifiedBy: 'gst-sync',
        }),
      );

      await service.save({ stmId: STATE_ID, stmName: 'Kerala State' });

      expect(groupMirror()).toEqual({
        where: { accGroupId: STATE_ID },
        data: {
          accGroupName: 'Kerala State',
          accGroupShort: 'KER',
          accGroupDescription: 'd'.repeat(250),
          accGroupSort: 4,
          accGroupIsActive: false,
          accGroupIsDeleted: false,
          accGroupModifiedOn: new Date('2026-10-19T06:00:00.000Z'),
          accGroupModifiedBy: 'gst-sync',
        },
      });
    });

    it('audits the before and after of the update', async () => {
      const payload = await service.save({ stmId: STATE_ID, stmName: 'Kerala State' });

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: STATE_ID,
        originalRecord: expect.objectContaining({ stmName: 'Kerala' }),
        modifiedRecord: payload,
      });
    });

    it('answers a unique-index race (P2002) with a 409', async () => {
      prisma.stateMaster.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save({ stmId: STATE_ID, stmName: 'Kerala' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: StateErrorCode.NAME_EXISTS }] },
      });
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the live state with its order as a number and ISO dates', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue(stateRow());

      await expect(service.getById(STATE_ID)).resolves.toEqual({
        stmId: STATE_ID,
        stmName: 'Kerala',
        stmAlias: null,
        stmShort: 'KL',
        stmOrder: 3,
        stmDescription: null,
        stmIsActive: true,
        stmIsDeleted: false,
        stmSyncDate: null,
        stmCreatedOn: STAMP.toISOString(),
        stmCreatedBy: USER_ID,
        stmModifiedOn: STAMP.toISOString(),
        stmModifiedBy: USER_ID,
      });
      expect(prisma.stateMaster.findFirst).toHaveBeenCalledWith({
        where: { stmId: STATE_ID, stmIsDeleted: false },
      });
    });

    it('refuses an id with no live state', async () => {
      const refusal = await refusalOf(service.getById(STATE_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              code: StateErrorCode.NOT_FOUND,
              message: `No active state found with id ${STATE_ID}`,
            },
          ],
        },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live state', async () => {
      const refusal = await refusalOf(service.softDelete(STATE_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.stateMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses while live cities still point at the state', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue(stateRow());
      prisma.cityMaster.count.mockResolvedValue(3);

      const refusal = await refusalOf(service.softDelete(STATE_ID));

      expect(prisma.cityMaster.count).toHaveBeenCalledWith({
        where: { ctmStateId: STATE_ID, ctmIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'stmId',
              code: StateErrorCode.HAS_CITIES,
              message: `State ${STATE_ID} is used by 3 city(s).`,
            },
          ],
        },
      });
      expect(prisma.stateMaster.updateMany).not.toHaveBeenCalled();
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses, and leaves the group alone, when the row went between the read and the write', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue(stateRow());
      prisma.stateMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(STATE_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('deletes the state and its linked account group together', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue(stateRow());

      await expect(service.softDelete(STATE_ID)).resolves.toEqual({
        stmId: STATE_ID,
        deleted: true,
      });

      const { data: stateData } = prisma.stateMaster.updateMany.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(stateData).toEqual({
        stmIsDeleted: true,
        stmIsActive: false,
        stmModifiedOn: expect.any(Date),
        stmModifiedBy: USER_ID,
      });
      expect(groupMirror()).toEqual({
        where: { accGroupId: STATE_ID },
        data: {
          accGroupIsActive: false,
          accGroupIsDeleted: true,
          accGroupModifiedOn: stateData.stmModifiedOn,
          accGroupModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Kerala',
        modifiedRecord: expect.objectContaining({ stmIsDeleted: true, stmIsActive: false }),
      });
    });
  });
});
