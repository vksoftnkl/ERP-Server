import { Logger } from '@nestjs/common';
import type { DeviceMaster, UserMaster } from '@prisma/client';
import { AuthService } from './auth.service';

/**
 * Review list 11-19 (239.9): a desktop login re-points the device at the user's company
 * and branch. That move is audited on the device; the per-login touch (a new last user,
 * IP, time) is not, and a failed audit write never fails the login.
 */
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46f301';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f302';
const OTHER_USER = '019c6f6c-be87-7a11-8905-36092c46f303';
const COMPANY_A = '019c6f6c-be87-7a11-8905-36092c46f304';
const COMPANY_B = '019c6f6c-be87-7a11-8905-36092c46f305';
const BRANCH_A = '019c6f6c-be87-7a11-8905-36092c46f306';
const BRANCH_B = '019c6f6c-be87-7a11-8905-36092c46f307';

const deviceRow = (overrides: Partial<DeviceMaster> = {}): DeviceMaster => ({
  devId: DEVICE_ID,
  devCompanyId: COMPANY_A,
  devBranchId: BRANCH_A,
  devUserId: OTHER_USER,
  devDeviceUid: 'PC-UID-1',
  devDeviceName: 'Counter 1',
  devCode: 'D1',
  devDeviceType: 'PC',
  devPlatform: 'Linux',
  devMacAddress: null,
  devIsBlocked: false,
  devBlockReason: null,
  devLastIp: null,
  devLastLogin: null,
  devIsActive: true,
  devIsDeleted: false,
  devSyncDate: null,
  devCreatedOn: new Date('2026-10-01T04:30:00.000Z'),
  devCreatedBy: OTHER_USER,
  devModifiedOn: null,
  devModifiedBy: null,
  ...overrides,
});

const user = (overrides: Partial<UserMaster> = {}): UserMaster =>
  ({
    usrId: USER_ID,
    usrLoginName: 'cashier2',
    usrCompanyId: COMPANY_A,
    usrBranchId: BRANCH_A,
    ...overrides,
  }) as UserMaster;

describe('AuthService — the device a login moves', () => {
  let prisma: { deviceMaster: { findUnique: jest.Mock; update: jest.Mock } };
  let audit: { logEntityChange: jest.Mock };
  let service: AuthService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = {
      deviceMaster: {
        findUnique: jest.fn().mockResolvedValue(deviceRow()),
        update: jest.fn(async ({ data }: { data: Partial<DeviceMaster> }) => deviceRow(data)),
      },
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      {} as never,
      {} as never,
      prisma as never,
      { getIpAddress: jest.fn().mockReturnValue('10.0.0.5') } as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
    );
  });

  afterEach(() => warn.mockRestore());

  const login = (who: UserMaster) =>
    (
      service as unknown as {
        findAndUpdateDeviceOnLogin(uid: string, user: UserMaster): Promise<DeviceMaster>;
      }
    ).findAndUpdateDeviceOnLogin('PC-UID-1', who);

  it('audits a login that moves the device to another company and branch', async () => {
    await login(user({ usrCompanyId: COMPANY_B, usrBranchId: BRANCH_B }));

    expect(audit.logEntityChange).toHaveBeenCalledTimes(1);
    const [entry] = audit.logEntityChange.mock.calls[0] as [Record<string, unknown>];
    expect(entry).toMatchObject({
      action: 'update',
      screenName: 'Device List Master',
      tableName: 'erp device master',
      pk: DEVICE_ID,
      displayName: 'Counter 1',
      userId: USER_ID,
      branchId: BRANCH_B,
      notes: 'Device moved by the login of cashier2',
      originalRecord: expect.objectContaining({ devCompanyId: COMPANY_A, devBranchId: BRANCH_A }),
      modifiedRecord: expect.objectContaining({ devCompanyId: COMPANY_B, devBranchId: BRANCH_B }),
    });
    expect(entry.modifiedRecord).not.toHaveProperty('devLastIp');
  });

  it('writes nothing for an ordinary login: same company and branch, another user', async () => {
    const device = await login(user());

    expect(device.devUserId).toBe(USER_ID);
    expect(audit.logEntityChange).not.toHaveBeenCalled();
  });

  it('lets the login through when the audit write fails, and logs it', async () => {
    audit.logEntityChange.mockRejectedValue(new Error('audit down'));

    await expect(login(user({ usrBranchId: BRANCH_B }))).resolves.toMatchObject({
      devBranchId: BRANCH_B,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('the audit row was not written'));
  });
});
