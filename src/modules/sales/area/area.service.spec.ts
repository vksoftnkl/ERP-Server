import { HttpException } from '@nestjs/common';
import { AreaMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AreaService } from './area.service';
import { AreaErrorCode } from './types/area-error-codes';

const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46a301';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46a302';
const CITY_ID = '019c6f6c-be87-7a11-8905-36092c46a303';
const OTHER_CITY_ID = '019c6f6c-be87-7a11-8905-36092c46a304';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46a305';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a306';
/** The fixed parent group an area's own group is created under. */
const AREA_PARENT_GROUP_ID = '019f081c-6764-73b0-b397-3f30a6efe73e';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const areaRow = (overrides: Partial<AreaMaster> = {}): AreaMaster => ({
  armId: AREA_ID,
  armName: 'Kakkanad',
  armAlias: null,
  armShort: 'KKD',
  armCityId: CITY_ID,
  armSort: new Prisma.Decimal(1),
  armDistanceKm: 0,
  armCollectionDays: [],
  armDescription: null,
  armIsActive: true,
  armIsDeleted: false,
  armSyncDate: null,
  armCreatedOn: STAMP,
  armCreatedBy: USER_ID,
  armModifiedOn: STAMP,
  armModifiedBy: USER_ID,
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
  areaMaster: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  cityMaster: { findFirst: jest.Mock };
  customer: { count: jest.Mock };
  accGroupMaster: { findFirst: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('AreaService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: AreaService;

  beforeEach(() => {
    prisma = {
      areaMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<AreaMaster> }) => areaRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<AreaMaster> }) => areaRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cityMaster: { findFirst: jest.fn().mockResolvedValue({ ctmId: CITY_ID }) },
      customer: { count: jest.fn().mockResolvedValue(0) },
      accGroupMaster: {
        findFirst: jest.fn().mockResolvedValue(PARENT_GROUP),
        create: jest.fn().mockResolvedValue({ accGroupId: GROUP_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new AreaService(prisma as unknown as PrismaService, audit as never, context as never);
  });

  const groupCreateData = () =>
    (prisma.accGroupMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const areaCreateData = () =>
    (prisma.areaMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const groupMirror = () =>
    prisma.accGroupMaster.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('createAreaMaster', () => {
    it('refuses a blank name before opening a transaction', async () => {
      const refusal = await refusalOf(
        service.createAreaMaster({ armName: '', armCityId: CITY_ID }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'armName', code: AreaErrorCode.NAME_REQUIRED }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a city that is not live', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.createAreaMaster({ armName: 'Kakkanad', armCityId: CITY_ID }, USER_ID),
      );

      expect(prisma.cityMaster.findFirst).toHaveBeenCalledWith({
        where: { ctmId: CITY_ID, ctmIsDeleted: false },
        select: { ctmId: true },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'armCityId', code: AreaErrorCode.CITY_NOT_FOUND }] },
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a name another live area of the same city holds', async () => {
      prisma.areaMaster.findFirst.mockResolvedValue({ armId: 'other' });

      const refusal = await refusalOf(
        service.createAreaMaster({ armName: 'kakkanad', armCityId: CITY_ID }, USER_ID),
      );

      expect(prisma.areaMaster.findFirst).toHaveBeenCalledWith({
        where: {
          armIsDeleted: false,
          armCityId: CITY_ID,
          armName: { equals: 'kakkanad', mode: 'insensitive' },
        },
        select: { armId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'armName', code: AreaErrorCode.NAME_EXISTS }] },
      });
    });

    it('refuses when the parent account group is gone, before creating either row', async () => {
      prisma.accGroupMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.createAreaMaster({ armName: 'Kakkanad', armCityId: CITY_ID }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'parentId', code: AreaErrorCode.PARENT_GROUP_NOT_FOUND }] },
      });
      expect(prisma.accGroupMaster.create).not.toHaveBeenCalled();
      expect(prisma.areaMaster.create).not.toHaveBeenCalled();
    });

    it('mirrors name, short, description and sort onto the new group, but not distance or days', async () => {
      await service.createAreaMaster(
        {
          armName: ' Kakkanad ',
          armCityId: CITY_ID,
          armShort: 'KKD',
          armSort: 5.5,
          armDescription: 'z'.repeat(400),
          armDistanceKm: 12,
          armCollectionDays: [1, 15],
        },
        USER_ID,
      );

      expect(prisma.accGroupMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accGroupId: AREA_PARENT_GROUP_ID, accGroupIsDeleted: false },
        }),
      );
      expect(groupCreateData()).toEqual({
        accGroupName: 'Kakkanad',
        accGroupShort: 'KKD',
        accGroupDescription: 'z'.repeat(250),
        accGroupSort: 5,
        accGroupParentId: AREA_PARENT_GROUP_ID,
        ...PARENT_GROUP,
        accGroupIsActive: true,
        accGroupIsDeleted: false,
        accGroupCreatedOn: expect.any(Date),
        accGroupCreatedBy: USER_ID,
        accGroupModifiedOn: expect.any(Date),
        accGroupModifiedBy: USER_ID,
      });
      expect(areaCreateData()).toMatchObject({
        armId: GROUP_ID,
        armSort: 5.5,
        armDescription: 'z'.repeat(400),
        armDistanceKm: 12,
        armCollectionDays: [1, 15],
      });
    });

    it('stores no collection days as an empty list', async () => {
      await service.createAreaMaster({ armName: 'Kakkanad', armCityId: CITY_ID }, USER_ID);

      expect(areaCreateData().armCollectionDays).toEqual([]);
    });

    it('lets a client clear the distance with null', async () => {
      await service.createAreaMaster(
        { armName: 'Kakkanad', armCityId: CITY_ID, armDistanceKm: null },
        USER_ID,
      );

      expect(areaCreateData().armDistanceKm).toBeNull();
    });

    it('returns the area with the group id and audits the create', async () => {
      const result = await service.createAreaMaster(
        { armName: 'Kakkanad', armCityId: CITY_ID, armCreatedBy: 'importer' },
        USER_ID,
      );

      expect(result).toMatchObject({ accGroupId: GROUP_ID, areaMaster: { armId: GROUP_ID } });
      expect(groupCreateData().accGroupCreatedBy).toBe('importer');
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'area master',
        pk: GROUP_ID,
        userId: 'importer',
        notes: 'Area created with linked account group',
      });
    });

    it('creates an inactive area as deleted, on both rows', async () => {
      await service.createAreaMaster(
        { armName: 'Kakkanad', armCityId: CITY_ID, armIsActive: false },
        USER_ID,
      );

      expect(groupCreateData()).toMatchObject({ accGroupIsActive: false, accGroupIsDeleted: true });
      expect(areaCreateData()).toMatchObject({ armIsActive: false, armIsDeleted: true });
    });

    it('answers a unique-index race (P2002) with a 409', async () => {
      prisma.areaMaster.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(
        service.createAreaMaster({ armName: 'Kakkanad', armCityId: CITY_ID }, USER_ID),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: AreaErrorCode.NAME_EXISTS }] },
      });
    });
  });

  describe('save without armId', () => {
    it('creates as the request user and returns the bare area', async () => {
      const payload = await service.save({ armName: 'Kakkanad', armCityId: CITY_ID });

      expect(groupCreateData().accGroupCreatedBy).toBe(USER_ID);
      expect(payload).toMatchObject({ armId: GROUP_ID, armName: 'Kakkanad' });
    });
  });

  describe('save with armId (update)', () => {
    beforeEach(() => {
      prisma.areaMaster.findFirst.mockImplementation(
        async ({ where }: { where: Record<string, unknown> }) =>
          'armName' in where ? null : areaRow(),
      );
    });

    it('refuses an id that names no live area', async () => {
      prisma.areaMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.save({ armId: AREA_ID, armName: 'Kakkanad', armCityId: CITY_ID }),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'armId', code: AreaErrorCode.NOT_FOUND }] },
      });
    });

    it('refuses a move to a city that is not live', async () => {
      prisma.cityMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(
        service.save({ armId: AREA_ID, armName: 'Kakkanad', armCityId: OTHER_CITY_ID }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: AreaErrorCode.CITY_NOT_FOUND }] },
      });
      expect(prisma.areaMaster.update).not.toHaveBeenCalled();
    });

    it('checks the name within the city the area is moving to, excluding itself', async () => {
      await service.save({ armId: AREA_ID, armName: 'Kakkanad', armCityId: OTHER_CITY_ID });

      expect(prisma.areaMaster.findFirst).toHaveBeenLastCalledWith({
        where: {
          armIsDeleted: false,
          armCityId: OTHER_CITY_ID,
          armName: { equals: 'Kakkanad', mode: 'insensitive' },
          armId: { not: AREA_ID },
        },
        select: { armId: true },
      });
    });

    it('writes the distance and collection days it was sent', async () => {
      await service.save({
        armId: AREA_ID,
        armName: 'Kakkanad',
        armCityId: CITY_ID,
        armDistanceKm: 8,
        armCollectionDays: [5],
      });

      expect(prisma.areaMaster.update).toHaveBeenCalledWith({
        where: { armId: AREA_ID },
        data: {
          armName: 'Kakkanad',
          armCityId: CITY_ID,
          armModifiedOn: expect.any(Date),
          armModifiedBy: USER_ID,
          armDistanceKm: 8,
          armCollectionDays: [5],
        },
      });
    });

    it('mirrors the updated row onto the linked group, leaving distance and days out', async () => {
      prisma.areaMaster.update.mockResolvedValue(
        areaRow({
          armName: 'Kakkanad East',
          armSort: new Prisma.Decimal('9.99'),
          armDistanceKm: 40,
          armCollectionDays: [3],
          armModifiedOn: new Date('2026-10-19T06:00:00.000Z'),
          armModifiedBy: 'editor',
        }),
      );

      await service.save({ armId: AREA_ID, armName: 'Kakkanad East', armCityId: CITY_ID });

      expect(groupMirror()).toEqual({
        where: { accGroupId: AREA_ID },
        data: {
          accGroupName: 'Kakkanad East',
          accGroupShort: 'KKD',
          accGroupDescription: null,
          accGroupSort: 9,
          accGroupIsActive: true,
          accGroupIsDeleted: false,
          accGroupModifiedOn: new Date('2026-10-19T06:00:00.000Z'),
          accGroupModifiedBy: 'editor',
        },
      });
      expect(auditEntry()).toMatchObject({ action: 'update', pk: AREA_ID, userId: 'editor' });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live area', async () => {
      const refusal = await refusalOf(service.getById(AREA_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: AreaErrorCode.NOT_FOUND }] },
      });
    });

    it('adds the name of the city the area belongs to', async () => {
      prisma.areaMaster.findFirst.mockResolvedValue(areaRow({ armCollectionDays: [1, 15] }));
      prisma.cityMaster.findFirst.mockResolvedValue({ ctmName: 'Kochi' });

      await expect(service.getById(AREA_ID)).resolves.toMatchObject({
        armId: AREA_ID,
        armSort: 1,
        armCollectionDays: [1, 15],
        armCityName: 'Kochi',
      });
      expect(prisma.cityMaster.findFirst).toHaveBeenCalledWith({
        where: { ctmId: CITY_ID },
        select: { ctmName: true },
      });
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live area', async () => {
      const refusal = await refusalOf(service.softDelete(AREA_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses while live customers still point at the area', async () => {
      prisma.areaMaster.findFirst.mockResolvedValue(areaRow());
      prisma.customer.count.mockResolvedValue(5);

      const refusal = await refusalOf(service.softDelete(AREA_ID));

      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: { cusAreaId: AREA_ID, cusIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'armId',
              code: AreaErrorCode.HAS_CUSTOMERS,
              message: `Area ${AREA_ID} is used by 5 customer(s).`,
            },
          ],
        },
      });
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses, and leaves the group alone, when the row went between the read and the write', async () => {
      prisma.areaMaster.findFirst.mockResolvedValue(areaRow());
      prisma.areaMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(AREA_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.accGroupMaster.updateMany).not.toHaveBeenCalled();
    });

    it('deletes the area and its linked account group together', async () => {
      prisma.areaMaster.findFirst.mockResolvedValue(areaRow());

      await expect(service.softDelete(AREA_ID)).resolves.toEqual({
        armId: AREA_ID,
        deleted: true,
      });

      const { data: areaData } = prisma.areaMaster.updateMany.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(areaData).toEqual({
        armIsDeleted: true,
        armIsActive: false,
        armModifiedOn: expect.any(Date),
        armModifiedBy: USER_ID,
      });
      expect(groupMirror()).toEqual({
        where: { accGroupId: AREA_ID },
        data: {
          accGroupIsActive: false,
          accGroupIsDeleted: true,
          accGroupModifiedOn: areaData.armModifiedOn,
          accGroupModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({ action: 'cancel', displayName: 'Kakkanad' });
    });
  });
});
