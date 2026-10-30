import { HttpException } from '@nestjs/common';
import { CityMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CityService } from './city.service';
import { CityErrorCode } from './types/city-error-codes';

const CITY_ID = '019c6f6c-be87-7a11-8905-36092c46a201';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46a202';
const STATE_ID = '019c6f6c-be87-7a11-8905-36092c46a203';
const OTHER_STATE_ID = '019c6f6c-be87-7a11-8905-36092c46a204';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a205';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a206';
/** The fixed parent group a city's own group is created under. */
const CITY_PARENT_GROUP_ID = '019f081c-6764-73b0-b397-3f30a6efe73e';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const cityRow = (overrides: Partial<CityMaster> = {}): CityMaster => ({
  ctmId: CITY_ID,
  ctmName: 'Kochi',
  ctmAlias: null,
  ctmShort: 'COK',
  ctmStateId: STATE_ID,
  ctmOrder: new Prisma.Decimal(1),
  ctmDescription: null,
  ctmIsActive: true,
  ctmIsDeleted: false,
  ctmSyncDate: null,
  ctmCreatedOn: STAMP,
  ctmCreatedBy: USER_ID,
  ctmModifiedOn: STAMP,
  ctmModifiedBy: USER_ID,
  ...overrides,
});

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
  cityMaster: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  stateMaster: { findFirst: jest.Mock };
  areaMaster: { count: jest.Mock };
  accGroupMaster: { findFirst: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('CityService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: CityService;

  beforeEach(() => {
    prisma = {
      cityMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<CityMaster> }) => cityRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<CityMaster> }) => cityRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stateMaster: { findFirst: jest.fn().mockResolvedValue({ stmId: STATE_ID }) },
      areaMaster: { count: jest.fn().mockResolvedValue(0) },
      accGroupMaster: {
        findFirst: jest.fn().mockResolvedValue(PARENT_GROUP),
        create: jest.fn().mockResolvedValue({ accGroupId: GROUP_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new CityService(prisma as unknown as PrismaService, audit as never, context as never);
  });

  const groupCreateData = () =>
    (prisma.accGroupMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const cityCreateData = () =>
    (prisma.cityMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const groupMirror = () =>
    prisma.accGroupMaster.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('createCityMaster', () => {
    it('refuses a blank name before opening a transaction', async () => {
      const refusal = await refusalOf(
        service.createCityMaster({ ctmName: ' ', ctmStateId: STATE_ID }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'ctmName', code: CityErrorCode.NAME_REQUIRED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a state that is not live', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.createCityMaster({ ctmName: 'Kochi', ctmStateId: STATE_ID }, USER_ID),
      );

      expect(prisma.stateMaster.findFirst).toHaveBeenCalledWith({
        where: { stmId: STATE_ID, stmIsDeleted: false },
        select: { stmId: true },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'ctmStateId', code: CityErrorCode.STATE_NOT_FOUND }] },
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a name another live city of the same state holds', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue({ ctmId: 'other' });

      const refusal = await refusalOf(
        service.createCityMaster({ ctmName: 'kochi', ctmStateId: STATE_ID }, USER_ID),
      );

      expect(prisma.cityMaster.findFirst).toHaveBeenCalledWith({
        where: {
          ctmIsDeleted: false,
          ctmStateId: STATE_ID,
          ctmName: { equals: 'kochi', mode: 'insensitive' },
        },
        select: { ctmId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'ctmName', code: CityErrorCode.NAME_EXISTS }] },
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
    });

    it('refuses when the parent account group is gone, before creating either row', async () => {
      prisma.accGroupMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.createCityMaster({ ctmName: 'Kochi', ctmStateId: STATE_ID }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'parentId', code: CityErrorCode.PARENT_GROUP_NOT_FOUND }] },
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
      expect(prisma.cityMaster.create).not.toHaveBeenCalled();
    });

    it('creates the account group under the fixed parent with the mirrored city fields', async () => {
      await service.createCityMaster(
        {
          ctmName: ' Kochi ',
          ctmStateId: STATE_ID,
          ctmShort: 'COK',
          ctmAlias: 'Cochin',
          ctmOrder: 7.6,
          ctmDescription: 'q'.repeat(251),
        },
        USER_ID,
      );

      expect(prisma.accGroupMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accGroupId: CITY_PARENT_GROUP_ID, accGroupIsDeleted: false },
        }),
      );
      expect(groupCreateData()).toEqual({
        accGroupName: 'Kochi',
        accGroupShort: 'COK',
        accGroupDescription: 'q'.repeat(250),
        accGroupSort: 7,
        accGroupParentId: CITY_PARENT_GROUP_ID,
        ...PARENT_GROUP,
        accGroupIsActive: true,
        accGroupIsDeleted: false,
        accGroupCreatedOn: expect.any(Date),
        accGroupCreatedBy: USER_ID,
        accGroupModifiedOn: expect.any(Date),
        accGroupModifiedBy: USER_ID,
      });
    });

    it('gives the city the account group id and keeps the alias on the city only', async () => {
      const result = await service.createCityMaster(
        { ctmName: 'Kochi', ctmStateId: STATE_ID, ctmAlias: 'Cochin' },
        USER_ID,
      );

      expect(cityCreateData()).toMatchObject({
        ctmId: GROUP_ID,
        ctmName: 'Kochi',
        ctmAlias: 'Cochin',
        ctmStateId: STATE_ID,
        ctmOrder: 0,
        ctmIsDeleted: false,
      });
      expect(groupCreateData()).not.toHaveProperty('accGroupAlias');
      expect(result).toMatchObject({ accGroupId: GROUP_ID, cityMaster: { ctmId: GROUP_ID } });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'city master',
        pk: GROUP_ID,
        notes: 'City created with linked account group',
      });
    });

    it('takes ctmCreatedBy from the body over the user it was handed', async () => {
      await service.createCityMaster(
        { ctmName: 'Kochi', ctmStateId: STATE_ID, ctmCreatedBy: 'importer' },
        USER_ID,
      );

      expect(groupCreateData().accGroupCreatedBy).toBe('importer');
      expect(cityCreateData().ctmCreatedBy).toBe('importer');
    });

    it('creates an inactive city as deleted, on both rows', async () => {
      await service.createCityMaster(
        { ctmName: 'Kochi', ctmStateId: STATE_ID, ctmIsActive: false },
        USER_ID,
      );

      expect(groupCreateData()).toMatchObject({ accGroupIsActive: false, accGroupIsDeleted: true });
      expect(cityCreateData()).toMatchObject({ ctmIsActive: false, ctmIsDeleted: true });
    });

    it('answers a unique-index race (P2002) with a 409', async () => {
      prisma.cityMaster.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(
        service.createCityMaster({ ctmName: 'Kochi', ctmStateId: STATE_ID }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'ctmName', code: CityErrorCode.NAME_EXISTS }] },
      });
    });
  });

  describe('save without ctmId', () => {
    it('creates as the request user and returns the bare city', async () => {
      const payload = await service.save({ ctmName: 'Kochi', ctmStateId: STATE_ID });

      expect(groupCreateData().accGroupCreatedBy).toBe(USER_ID);
      expect(payload).toMatchObject({ ctmId: GROUP_ID, ctmName: 'Kochi' });
    });
  });

  describe('save with ctmId (update)', () => {
    beforeEach(() => {
      prisma.cityMaster.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'ctmName' in where ? null : cityRow(),
      );
    });

    it('refuses an id that names no live city', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.save({ ctmId: CITY_ID, ctmName: 'Kochi', ctmStateId: STATE_ID }),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'ctmId', code: CityErrorCode.NOT_FOUND }] },
      });
      expect(prisma.cityMaster.update).not.toHaveBeenCalled();
    });

    it('refuses a move to a state that is not live', async () => {
      prisma.stateMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.save({ ctmId: CITY_ID, ctmName: 'Kochi', ctmStateId: OTHER_STATE_ID }),
      );

      expect(prisma.stateMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stmId: OTHER_STATE_ID, stmIsDeleted: false } }),
      );
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: CityErrorCode.STATE_NOT_FOUND }] },
      });
    });

    it('checks the name within the state the city is moving to, excluding itself', async () => {
      await service.save({ ctmId: CITY_ID, ctmName: 'Kochi', ctmStateId: OTHER_STATE_ID });

      expect(prisma.cityMaster.findFirst).toHaveBeenLastCalledWith({
        where: {
          ctmIsDeleted: false,
          ctmStateId: OTHER_STATE_ID,
          ctmName: { equals: 'Kochi', mode: 'insensitive' },
          ctmId: { not: CITY_ID },
        },
        select: { ctmId: true },
      });
      expect(prisma.cityMaster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ctmStateId: OTHER_STATE_ID }) as object,
        }),
      );
    });

    it('refuses a name another city of the state holds', async () => {
      prisma.cityMaster.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'ctmName' in where ? { ctmId: 'other' } : cityRow(),
      );

      const refusal = await refusalOf(
        service.save({ ctmId: CITY_ID, ctmName: 'Ernakulam', ctmStateId: STATE_ID }),
      );

      expect(refusal.status).toBe(409);
      expect(prisma.cityMaster.update).not.toHaveBeenCalled();
    });

    it('stamps the request user when the body names no modifier', async () => {
      await service.save({ ctmId: CITY_ID, ctmName: 'Kochi', ctmStateId: STATE_ID });

      expect(prisma.cityMaster.update).toHaveBeenCalledWith({
        where: { ctmId: CITY_ID },
        data: {
          ctmName: 'Kochi',
          ctmStateId: STATE_ID,
          ctmModifiedOn: expect.any(Date),
          ctmModifiedBy: USER_ID,
        },
      });
    });

    it('mirrors the updated row onto the linked account group', async () => {
      prisma.cityMaster.update.mockResolvedValue(
        cityRow({
          ctmName: 'Cochin',
          ctmShort: null,
          ctmOrder: new Prisma.Decimal('2.2'),
          ctmDescription: null,
          ctmModifiedOn: new Date('2026-10-19T06:00:00.000Z'),
          ctmModifiedBy: 'editor',
        }),
      );

      await service.save({ ctmId: CITY_ID, ctmName: 'Cochin', ctmStateId: STATE_ID });

      expect(groupMirror()).toEqual({
        where: { accGroupId: CITY_ID },
        data: {
          accGroupName: 'Cochin',
          accGroupShort: null,
          accGroupDescription: null,
          accGroupSort: 2,
          accGroupIsActive: true,
          accGroupIsDeleted: false,
          accGroupModifiedOn: new Date('2026-10-19T06:00:00.000Z'),
          accGroupModifiedBy: 'editor',
        },
      });
      expect(auditEntry()).toMatchObject({ action: 'update', userId: 'editor' });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live city', async () => {
      const refusal = await refusalOf(service.getById(CITY_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: CityErrorCode.NOT_FOUND }] },
      });
    });

    it('adds the name of the state the city belongs to', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(cityRow());
      prisma.stateMaster.findFirst.mockResolvedValue({ stmName: 'Kerala' });

      await expect(service.getById(CITY_ID)).resolves.toMatchObject({
        ctmId: CITY_ID,
        ctmOrder: 1,
        ctmStateName: 'Kerala',
      });
      expect(prisma.stateMaster.findFirst).toHaveBeenCalledWith({
        where: { stmId: STATE_ID },
        select: { stmName: true },
      });
    });

    it('answers a null state name when the state row is missing', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(cityRow());
      prisma.stateMaster.findFirst.mockResolvedValue(null);

      await expect(service.getById(CITY_ID)).resolves.toMatchObject({ ctmStateName: null });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live city', async () => {
      const refusal = await refusalOf(service.softDelete(CITY_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses while live areas still point at the city', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(cityRow());
      prisma.areaMaster.count.mockResolvedValue(2);

      const refusal = await refusalOf(service.softDelete(CITY_ID));

      expect(prisma.areaMaster.count).toHaveBeenCalledWith({
        where: { armCityId: CITY_ID, armIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'ctmId',
              code: CityErrorCode.HAS_AREAS,
              message: `City ${CITY_ID} is used by 2 area(s).`,
            },
          ],
        },
      });
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses, and leaves the group alone, when the row went between the read and the write', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(cityRow());
      prisma.cityMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(CITY_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
    });

    it('deletes the city and its linked account group together', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(cityRow());

      await expect(service.softDelete(CITY_ID)).resolves.toEqual({
        ctmId: CITY_ID,
        deleted: true,
      });

      const { data: cityData } = prisma.cityMaster.updateMany.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(cityData).toEqual({
        ctmIsDeleted: true,
        ctmIsActive: false,
        ctmModifiedOn: expect.any(Date),
        ctmModifiedBy: USER_ID,
      });
      expect(groupMirror()).toEqual({
        where: { accGroupId: CITY_ID },
        data: {
          accGroupIsActive: false,
          accGroupIsDeleted: true,
          accGroupModifiedOn: cityData.ctmModifiedOn,
          accGroupModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({ action: 'cancel', displayName: 'Kochi' });
    });
  });
});
