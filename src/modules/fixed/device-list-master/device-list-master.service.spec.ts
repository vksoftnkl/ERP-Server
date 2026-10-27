import { HttpException } from '@nestjs/common';
import { DeviceMaster } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DeviceListMasterService } from './device-list-master.service';
import {
  DeviceListMasterErrorCode,
  DevicePlatform,
  DeviceType,
} from './types/device-list-master-enum';

const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46fc01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fc02';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fc03';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fc04';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fc05';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const deviceRow = (overrides: Partial<DeviceMaster> = {}): DeviceMaster => ({
  devId: DEVICE_ID,
  devCompanyId: COMPANY_ID,
  devBranchId: null,
  devUserId: null,
  devDeviceUid: 'DESK-0001',
  devDeviceName: 'Counter 1',
  devDeviceType: DeviceType.DESKTOP,
  devPlatform: DevicePlatform.WINDOWS,
  devMacAddress: null,
  devIsBlocked: false,
  devBlockReason: null,
  devLastIp: null,
  devLastLogin: null,
  devIsActive: true,
  devIsDeleted: false,
  devSyncDate: null,
  devCreatedOn: CREATED_ON,
  devCreatedBy: USER_ID,
  devModifiedOn: null,
  devModifiedBy: null,
  devCode: 'D1',
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

type PrismaMock = {
  deviceMaster: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  userLoginSession: { count: jest.Mock };
  company: { findFirst: jest.Mock };
  branchMaster: { findFirst: jest.Mock };
  userMaster: { findFirst: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

describe('DeviceListMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let grid: {
    loadCandidates: jest.Mock;
    filterPrimaryFromTable: jest.Mock;
    validateBaseSql: jest.Mock;
    runPagedQuery: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let service: DeviceListMasterService;

  beforeEach(() => {
    prisma = {
      deviceMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<DeviceMaster> }) => deviceRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<DeviceMaster> }) => deviceRow(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userLoginSession: { count: jest.fn().mockResolvedValue(0) },
      company: { findFirst: jest.fn().mockResolvedValue({ compName: 'Zeta Traders' }) },
      branchMaster: { findFirst: jest.fn().mockResolvedValue({ brName: 'Main Branch' }) },
      userMaster: { findFirst: jest.fn().mockResolvedValue({ usrDisplayName: 'Cashier One' }) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
      // Notes 160 C — the code lock, the next D<n> (D7 here) and the "taken?" read.
      $queryRaw: jest.fn((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('AS taken')) return Promise.resolve([{ taken: false }]);
        if (sql.includes('AS n')) return Promise.resolve([{ n: 7 }]);
        return Promise.resolve([{ locked: 1 }]);
      }),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    grid = {
      loadCandidates: jest.fn().mockResolvedValue([]),
      filterPrimaryFromTable: jest.fn((grids: unknown[]) => grids),
      validateBaseSql: jest.fn(() => ({ isValid: true, normalizedSql: 'SELECT 1' })),
      runPagedQuery: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new DeviceListMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      grid as never,
      context as never,
    );
  });

  const createdData = () =>
    (prisma.deviceMaster.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.deviceMaster.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const uniquenessWhere = () =>
    (
      prisma.deviceMaster.findFirst.mock.calls.at(-1)![0] as {
        where: Record<string, unknown>;
      }
    ).where;

  describe('save — create (no devId)', () => {
    it('treats a device with no type as Desktop and requires its uid', async () => {
      const refusal = await refusalOf(service.save({ devDeviceUid: '   ' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'devDeviceUid', code: DeviceListMasterErrorCode.UID_REQUIRED }],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('generates a uid for a Mobile device that sent none', async () => {
      await service.save({ devDeviceType: DeviceType.MOBILE });

      expect(createdData().devDeviceUid).toMatch(
        /^MOBILE-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(createdData().devDeviceType).toBe(DeviceType.MOBILE);
    });

    it('keeps a uid a Web device did send, trimmed', async () => {
      await service.save({ devDeviceType: DeviceType.WEB, devDeviceUid: '  browser-7  ' });

      expect(createdData().devDeviceUid).toBe('browser-7');
    });

    it('refuses a device type outside the enum', async () => {
      const refusal = await refusalOf(
        service.save({ devDeviceType: 'Tablet' as DeviceType, devDeviceUid: 'T-1' }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'devDeviceType', code: DeviceListMasterErrorCode.TYPE_INVALID }],
        },
      });
    });

    it('refuses a platform outside the enum', async () => {
      const refusal = await refusalOf(
        service.save({ devDeviceUid: 'DESK-1', devPlatform: 'BeOS' as DevicePlatform }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'devPlatform', code: DeviceListMasterErrorCode.PLATFORM_INVALID }],
        },
      });
      expect(prisma.deviceMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a device type that is not a string', async () => {
      const refusal = await refusalOf(
        service.save({ devDeviceType: 5 as unknown as DeviceType, devDeviceUid: 'D-1' }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'devDeviceType',
              message: 'devDeviceType must be a string',
              code: DeviceListMasterErrorCode.TYPE_INVALID,
            },
          ],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('treats a blank device type as Desktop, so the uid is still required', async () => {
      const refusal = await refusalOf(service.save({ devDeviceType: '  ' as DeviceType }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: DeviceListMasterErrorCode.UID_REQUIRED }] },
      });
    });

    it('stores a known platform trimmed', async () => {
      await service.save({ devDeviceUid: 'DESK-1', devPlatform: ' Linux ' as DevicePlatform });

      expect(createdData().devPlatform).toBe(DevicePlatform.LINUX);
    });

    it('stores a blank platform as null', async () => {
      await service.save({ devDeviceUid: 'DESK-1', devPlatform: '  ' as DevicePlatform });

      expect(createdData().devPlatform).toBeNull();
    });

    it('passes a null platform through and leaves an undefined one unset', async () => {
      await service.save({ devDeviceUid: 'DESK-1', devPlatform: null });
      await service.save({ devDeviceUid: 'DESK-2', devPlatform: undefined });

      const [nullData, undefinedData] = prisma.deviceMaster.create.mock.calls.map(
        ([args]: [{ data: Record<string, unknown> }]) => args.data,
      );
      expect(nullData.devPlatform).toBeNull();
      expect(undefinedData.devPlatform).toBeUndefined();
    });

    it('refuses a platform that is not a string', async () => {
      const refusal = await refusalOf(
        service.save({ devDeviceUid: 'DESK-1', devPlatform: 7 as unknown as DevicePlatform }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'devPlatform',
              message: 'devPlatform must be a string',
              code: DeviceListMasterErrorCode.PLATFORM_INVALID,
            },
          ],
        },
      });
      expect(prisma.deviceMaster.create).not.toHaveBeenCalled();
    });

    it('stamps devEntryBy as the creator and leaves the modified pair empty', async () => {
      await service.save({ devDeviceUid: 'DESK-1', devEntryBy: 'installer' });

      expect(createdData()).toMatchObject({
        devCreatedBy: 'installer',
        devModifiedOn: null,
        devModifiedBy: null,
      });
    });

    it('checks the uid only within the company it is saved for', async () => {
      await service.save({ devDeviceUid: 'DESK-1', devCompanyId: COMPANY_ID });

      expect(uniquenessWhere()).toEqual({
        devIsDeleted: false,
        devCompanyId: COMPANY_ID,
        devDeviceUid: { equals: 'DESK-1', mode: 'insensitive' },
      });
    });

    it('checks a company-less device against the other company-less devices', async () => {
      await service.save({ devDeviceUid: 'DESK-1' });

      expect(uniquenessWhere()).toMatchObject({ devCompanyId: null });
    });

    it('refuses a uid another live device of the company holds', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValue({ devId: 'other' });

      const refusal = await refusalOf(service.save({ devDeviceUid: 'DESK-1' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'devDeviceUid', code: DeviceListMasterErrorCode.UID_DUPLICATE }],
        },
      });
      expect(prisma.deviceMaster.create).not.toHaveBeenCalled();
    });

    it('answers a unique-index race (P2002) with the same 409', async () => {
      prisma.deviceMaster.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save({ devDeviceUid: 'DESK-1' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: DeviceListMasterErrorCode.UID_DUPLICATE }] },
      });
    });

    it('audits the new device under its uid', async () => {
      const payload = await service.save({ devDeviceUid: 'DESK-1' });

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'New',
          tableName: 'erp device master',
          displayName: 'DESK-1',
          originalRecord: null,
          modifiedRecord: payload,
        }),
        prisma,
      );
      expect(payload.devModifiedOn).toBeNull();
    });
  });

  // ── notes 160 C — the device code ───────────────────────────────────────
  describe('save — devCode', () => {
    const sqls = () => prisma.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));

    it('gives a new device left blank the next D<n>, under the code lock', async () => {
      await service.save({ devDeviceUid: 'DESK-0002', devCode: '  ' });

      expect(createdData()).toMatchObject({ devCode: 'D7' });
      expect(sqls()[0]).toContain('pg_advisory_xact_lock');
    });

    it('keeps a keyed code, trimmed and upper-cased', async () => {
      await service.save({ devDeviceUid: 'DESK-0002', devCode: ' pos1 ' });

      expect(createdData()).toMatchObject({ devCode: 'POS1' });
    });

    it('refuses a code another device holds — live or deleted — with 409 DEVICE_CODE_DUPLICATE', async () => {
      prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
        Promise.resolve(strings.join('?').includes('AS taken') ? [{ taken: true }] : [{ locked: 1 }]),
      );

      const refusal = await refusalOf(service.save({ devDeviceUid: 'DESK-0002', devCode: 'D1' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'devCode', code: DeviceListMasterErrorCode.CODE_DUPLICATE }] },
      });
      expect(prisma.deviceMaster.create).not.toHaveBeenCalled();
    });

    it('keeps the stored code on an update that sends none or a blank one', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValueOnce(deviceRow()).mockResolvedValueOnce(null);

      await service.save({ devId: DEVICE_ID, devDeviceUid: 'DESK-0001', devCode: null });

      expect(updatedData()).not.toHaveProperty('devCode');
    });

    it('changes the code on an update that keys a free one, checked against the others only', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValueOnce(deviceRow()).mockResolvedValueOnce(null);

      await service.save({ devId: DEVICE_ID, devDeviceUid: 'DESK-0001', devCode: 'pos2' });

      expect(updatedData()).toMatchObject({ devCode: 'POS2' });
      const taken = prisma.$queryRaw.mock.calls.find((c) => (c[0] as string[]).join('?').includes('AS taken'));
      expect(taken?.slice(1)).toEqual(['POS2', DEVICE_ID, DEVICE_ID]);
    });

    it('gives a stored device with no code one on its next update', async () => {
      prisma.deviceMaster.findFirst
        .mockResolvedValueOnce(deviceRow({ devCode: null }))
        .mockResolvedValueOnce(null);

      await service.save({ devId: DEVICE_ID, devDeviceUid: 'DESK-0001' });

      expect(updatedData()).toMatchObject({ devCode: 'D7' });
    });
  });

  describe('save — update (devId present)', () => {
    it('refuses an id that names no live device', async () => {
      const refusal = await refusalOf(service.save({ devId: DEVICE_ID, devDeviceUid: 'X' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'devId', code: DeviceListMasterErrorCode.NOT_FOUND }] },
      });
    });

    it('keeps the stored uid of a Mobile device when none is sent', async () => {
      prisma.deviceMaster.findFirst
        .mockResolvedValueOnce(
          deviceRow({ devDeviceType: DeviceType.MOBILE, devDeviceUid: 'MOBILE-1' }),
        )
        .mockResolvedValueOnce(null);

      await service.save({ devId: DEVICE_ID, devDeviceName: 'Phone' });

      expect(uniquenessWhere()).toEqual({
        devIsDeleted: false,
        devCompanyId: COMPANY_ID,
        devDeviceUid: { equals: 'MOBILE-1', mode: 'insensitive' },
        devId: { not: DEVICE_ID },
      });
      expect(updatedData()).not.toHaveProperty('devDeviceUid');
      expect(updatedData()).toMatchObject({ devDeviceName: 'Phone', devModifiedBy: USER_ID });
    });

    it('still wants the uid of a stored Desktop device', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValueOnce(deviceRow());

      const refusal = await refusalOf(service.save({ devId: DEVICE_ID, devDeviceName: 'X' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: DeviceListMasterErrorCode.UID_REQUIRED }] },
      });
      expect(prisma.deviceMaster.update).not.toHaveBeenCalled();
    });

    it('checks the uid in the company the device is moving to', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValueOnce(deviceRow()).mockResolvedValueOnce(null);

      await service.save({
        devId: DEVICE_ID,
        devDeviceUid: 'DESK-0001',
        devCompanyId: OTHER_COMPANY_ID,
      });

      expect(uniquenessWhere()).toMatchObject({ devCompanyId: OTHER_COMPANY_ID });
      expect(updatedData()).toMatchObject({
        devDeviceUid: 'DESK-0001',
        devCompanyId: OTHER_COMPANY_ID,
      });
    });

    it('audits the before and after of the update', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValueOnce(deviceRow()).mockResolvedValueOnce(null);

      const payload = await service.save({
        devId: DEVICE_ID,
        devDeviceUid: 'DESK-0002',
        devIsBlocked: true,
      });

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          pk: DEVICE_ID,
          originalRecord: expect.objectContaining({ devDeviceUid: 'DESK-0001' }),
          modifiedRecord: payload,
        }),
        prisma,
      );
      expect(payload).toMatchObject({ devDeviceUid: 'DESK-0002', devIsBlocked: true });
    });
  });

  describe('list', () => {
    it('refuses when no grid is configured for the device master', async () => {
      const refusal = await refusalOf(service.list({}));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: DeviceListMasterErrorCode.GRID_NOT_CONFIGURED }] },
      });
    });

    it('returns the configured grid page', async () => {
      grid.loadCandidates.mockResolvedValue([{ gridId: 3n, gridSql: 'SELECT * FROM dev' }]);
      grid.runPagedQuery.mockResolvedValue({ items: [{ devDeviceUid: 'DESK-1' }], total: 1 });

      await expect(service.list({})).resolves.toEqual({
        items: [{ devDeviceUid: 'DESK-1' }],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      });
      expect(grid.runPagedQuery).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'device_list_master_grid', skip: 0 }),
      );
    });
  });

  describe('getById', () => {
    it('refuses an id with no live device', async () => {
      const refusal = await refusalOf(service.getById(DEVICE_ID));

      expect(refusal.status).toBe(404);
    });

    it('adds the company, branch and user names the device points at', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValue(
        deviceRow({ devBranchId: BRANCH_ID, devUserId: USER_ID }),
      );

      await expect(service.getById(DEVICE_ID)).resolves.toMatchObject({
        devId: DEVICE_ID,
        devCompanyName: 'Zeta Traders',
        devBranchName: 'Main Branch',
        devUserName: 'Cashier One',
      });
    });

    it('looks up nothing for links the device does not have', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValue(deviceRow({ devCompanyId: null }));

      await expect(service.getById(DEVICE_ID)).resolves.toMatchObject({
        devCompanyName: null,
        devBranchName: null,
        devUserName: null,
      });
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(prisma.branchMaster.findFirst).not.toHaveBeenCalled();
      expect(prisma.userMaster.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live device', async () => {
      const refusal = await refusalOf(service.softDelete(DEVICE_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'devId', code: DeviceListMasterErrorCode.NOT_FOUND }] },
      });
      expect(prisma.userLoginSession.count).not.toHaveBeenCalled();
      expect(prisma.deviceMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses while login sessions still name the device', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValue(deviceRow());
      prisma.userLoginSession.count.mockResolvedValue(4);

      const refusal = await refusalOf(service.softDelete(DEVICE_ID));

      expect(prisma.userLoginSession.count).toHaveBeenCalledWith({
        where: { ulsDeviceId: DEVICE_ID, ulsIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              code: DeviceListMasterErrorCode.IN_USE,
              message: `Device ${DEVICE_ID} is used in 4 login session(s).`,
            },
          ],
        },
      });
      expect(prisma.deviceMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValue(deviceRow());
      prisma.deviceMaster.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(DEVICE_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the device deleted and inactive, and audits it as a cancel', async () => {
      prisma.deviceMaster.findFirst.mockResolvedValue(deviceRow());

      await expect(service.softDelete(DEVICE_ID)).resolves.toEqual({
        devId: DEVICE_ID,
        deleted: true,
      });
      expect(prisma.deviceMaster.updateMany).toHaveBeenCalledWith({
        where: { devId: DEVICE_ID, devIsDeleted: false },
        data: {
          devIsDeleted: true,
          devIsActive: false,
          devModifiedOn: expect.any(Date),
          devModifiedBy: USER_ID,
        },
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          displayName: 'DESK-0001',
          modifiedRecord: expect.objectContaining({ devIsDeleted: true, devIsActive: false }),
        }),
        prisma,
      );
    });
  });
});
