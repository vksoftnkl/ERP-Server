import {
  parseClientInfo,
  type IdentifiedClientInfo,
} from '../../../common/client-info/client-info';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import {
  ClientInstallationService,
  type InstallationSighting,
} from './client-installation.service';

const client = parseClientInfo({
  'x-app-platform': 'desktop',
  'x-app-build': '10',
  'x-app-version': '1.2.0',
  'x-device-id': 'pc-1',
}) as IdentifiedClientInfo;

const sighting = (overrides: Partial<InstallationSighting> = {}): InstallationSighting => ({
  client,
  companyId: 'c-1',
  branchId: 'b-1',
  userId: 'u-1',
  actor: 'tester1',
  ip: '127.0.0.1',
  ...overrides,
});

describe('ClientInstallationService (Part B Step 2)', () => {
  let prisma: {
    clientInstallation: { upsert: jest.Mock; groupBy: jest.Mock };
    appRelease: { findFirst: jest.Mock };
  };
  let service: ClientInstallationService;

  beforeEach(() => {
    prisma = {
      clientInstallation: { upsert: jest.fn().mockResolvedValue({}), groupBy: jest.fn() },
      appRelease: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new ClientInstallationService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('login upserts on (company, user, device, platform) with the audit columns', async () => {
    await expect(service.recordLogin(sighting())).resolves.toBe(true);
    const call = prisma.clientInstallation.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      cinCompanyId_cinUserId_cinDeviceId_cinPlatform: {
        cinCompanyId: 'c-1',
        cinUserId: 'u-1',
        cinDeviceId: 'pc-1',
        cinPlatform: 'desktop',
      },
    });
    expect(call.create).toMatchObject({
      cinBuild: 10,
      cinVersion: '1.2.0',
      cinBranchId: 'b-1',
      cinIp: '127.0.0.1',
      cinLastLogin: expect.any(Date),
      cinCreatedOn: expect.any(Date),
      cinCreatedBy: 'tester1',
    });
    expect(call.create).not.toHaveProperty('cinSyncDate');
    expect(call.update).toMatchObject({
      cinBuild: 10,
      cinLastSeen: expect.any(Date),
      cinLastLogin: expect.any(Date),
      cinIsDeleted: false,
      cinModifiedOn: expect.any(Date),
      cinModifiedBy: 'tester1',
    });
    expect(call.update).not.toHaveProperty('cinCreatedOn');
    expect(call.update).not.toHaveProperty('cinSyncDate');
  });

  it("a device that sends no X-Device-Id is 'unknown'; unsent details keep their old value", async () => {
    const bare = parseClientInfo({
      'x-app-platform': 'web',
      'x-app-build': '3',
    }) as IdentifiedClientInfo;
    await service.recordLogin(sighting({ client: bare, branchId: null, ip: null }));
    const call = prisma.clientInstallation.upsert.mock.calls[0][0];
    expect(call.where.cinCompanyId_cinUserId_cinDeviceId_cinPlatform.cinDeviceId).toBe('unknown');
    for (const kept of ['cinVersion', 'cinCommit', 'cinOs', 'cinIp', 'cinBranchId']) {
      expect(call.update).not.toHaveProperty(kept);
    }
  });

  it('a user with no company is not recorded (cin_company_id is NOT NULL)', async () => {
    await expect(service.recordLogin(sighting({ companyId: null }))).resolves.toBe(false);
    expect(prisma.clientInstallation.upsert).not.toHaveBeenCalled();
  });

  it('refresh writes at most once per 10 minutes per device; login is never throttled', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await expect(service.recordRefresh(sighting())).resolves.toBe(true);
    now.mockReturnValue(1_000_000 + 9 * 60 * 1000);
    await expect(service.recordRefresh(sighting())).resolves.toBe(false);
    // another device of the same user is its own key
    await expect(
      service.recordRefresh(sighting({ client: { ...client, deviceId: 'pc-2' } })),
    ).resolves.toBe(true);
    await expect(service.recordLogin(sighting())).resolves.toBe(true);
    now.mockReturnValue(1_000_000 + 10 * 60 * 1000);
    await expect(service.recordRefresh(sighting())).resolves.toBe(true);
    expect(prisma.clientInstallation.upsert).toHaveBeenCalledTimes(4);
    const refreshCall = prisma.clientInstallation.upsert.mock.calls[0][0];
    expect(refreshCall.update).not.toHaveProperty('cinLastLogin');
  });

  it('summary: oldest / newest active build, up to date vs behind the latest release', async () => {
    prisma.clientInstallation.groupBy.mockResolvedValue([
      {
        cinPlatform: 'desktop',
        cinBuild: 12,
        _count: { _all: 3 },
        _max: { cinLastSeen: new Date('2026-11-10T10:00:00Z') },
      },
      {
        cinPlatform: 'desktop',
        cinBuild: 9,
        _count: { _all: 2 },
        _max: { cinLastSeen: new Date('2026-11-09T10:00:00Z') },
      },
      { cinPlatform: 'web', cinBuild: 4, _count: { _all: 1 }, _max: { cinLastSeen: null } },
    ]);
    prisma.appRelease.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where.arlPlatform === 'desktop'
          ? { arlBuild: 12, arlVersion: '1.2.0', arlSeverity: 'normal' }
          : null,
      ),
    );
    const summary = await service.summary({});
    expect(summary.map((row) => row.platform)).toEqual(['web', 'desktop']);
    const desktop = summary.find((row) => row.platform === 'desktop');
    const web = summary.find((row) => row.platform === 'web');
    expect(desktop).toEqual({
      platform: 'desktop',
      activeDays: 30,
      activeInstallations: 5,
      oldestActiveBuild: 9,
      newestActiveBuild: 12,
      latestRelease: { build: 12, version: '1.2.0', severity: 'normal' },
      upToDate: 3,
      behind: 2,
      builds: [
        { build: 9, installations: 2, lastSeen: '2026-11-09T10:00:00.000Z' },
        { build: 12, installations: 3, lastSeen: '2026-11-10T10:00:00.000Z' },
      ],
    });
    expect(web).toMatchObject({
      platform: 'web',
      oldestActiveBuild: 4,
      latestRelease: null,
      behind: 0,
    });
    expect(prisma.clientInstallation.groupBy.mock.calls[0][0].where).toMatchObject({
      cinIsDeleted: false,
      cinIsActive: true,
      cinLastSeen: { gte: expect.any(Date) },
    });
  });
});
