import { parseClientInfo } from '../../../common/client-info/client-info';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { LegacyUsageService } from './legacy-usage.service';

describe('LegacyUsageService (Part B Step 2)', () => {
  let prisma: { appLegacyUsage: { upsert: jest.Mock; findMany: jest.Mock } };
  let service: LegacyUsageService;
  const desktop10 = parseClientInfo({ 'x-app-platform': 'desktop', 'x-app-build': '10' });

  beforeEach(() => {
    prisma = {
      appLegacyUsage: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new LegacyUsageService(prisma as unknown as PrismaService);
  });

  it('adds up in memory, then writes one increment per field + platform + build', async () => {
    service.record('auth.login.app_version', desktop10);
    service.record('auth.login.app_version', desktop10);
    service.record('auth.login.app_version', null);
    expect(service.pendingCount()).toBe(2);
    expect(prisma.appLegacyUsage.upsert).not.toHaveBeenCalled();

    await expect(service.flush()).resolves.toBe(2);
    expect(service.pendingCount()).toBe(0);
    const [known, unknown] = prisma.appLegacyUsage.upsert.mock.calls.map((call) => call[0]);
    expect(known.where).toEqual({
      aluName_aluPlatform_aluBuild: {
        aluName: 'auth.login.app_version',
        aluPlatform: 'desktop',
        aluBuild: 10,
      },
    });
    expect(known.create).toMatchObject({
      aluCount: 2,
      aluCreatedOn: expect.any(Date),
      aluCreatedBy: 'app-version',
    });
    expect(known.update).toMatchObject({
      aluCount: { increment: 2 },
      aluModifiedOn: expect.any(Date),
      aluModifiedBy: 'app-version',
    });
    expect(unknown.where.aluName_aluPlatform_aluBuild).toMatchObject({
      aluPlatform: 'unknown',
      aluBuild: -1,
    });
  });

  it('a failed write keeps the counts for the next flush, and flush never rejects', async () => {
    service.record('a', desktop10);
    service.record('b', desktop10);
    prisma.appLegacyUsage.upsert.mockRejectedValueOnce(new Error('connection refused'));
    await expect(service.flush()).resolves.toBe(0);
    expect(service.pendingCount()).toBe(2);
    service.record('a', desktop10);
    await expect(service.flush()).resolves.toBe(2);
    const counts = prisma.appLegacyUsage.upsert.mock.calls
      .slice(1)
      .map((call) => call[0].create.aluCount);
    expect(counts.sort()).toEqual([1, 2]);
  });

  it('retries once on a unique race with another process', async () => {
    prisma.appLegacyUsage.upsert.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    service.record('a', desktop10);
    await expect(service.flush()).resolves.toBe(1);
    expect(prisma.appLegacyUsage.upsert).toHaveBeenCalledTimes(2);
  });

  it('record() ignores a blank name or a bad count and never throws', () => {
    expect(() => service.record('', desktop10)).not.toThrow();
    expect(() => service.record('x', desktop10, 0)).not.toThrow();
    expect(() => service.record(undefined as unknown as string, desktop10)).not.toThrow();
    expect(service.pendingCount()).toBe(0);
  });

  it('list() flushes first and reads live rows only', async () => {
    service.record('auth.login.app_version', desktop10);
    await service.list({ name: 'APP_VERSION' });
    expect(prisma.appLegacyUsage.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.appLegacyUsage.findMany).toHaveBeenCalledWith({
      where: {
        aluIsDeleted: false,
        aluName: { contains: 'APP_VERSION', mode: 'insensitive' },
      },
      orderBy: [{ aluName: 'asc' }, { aluPlatform: 'asc' }, { aluBuild: 'asc' }],
    });
  });
});
