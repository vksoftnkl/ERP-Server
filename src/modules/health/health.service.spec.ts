import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthEpochService } from '../app-version/services/auth-epoch.service';
import type { BuildPolicyService } from '../app-version/services/build-policy.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: { $queryRawUnsafe: jest.Mock };
  let redisCacheService: { isEnabled: jest.Mock; ping: jest.Mock };

  beforeEach(() => {
    prismaService = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ now: new Date().toISOString() }]),
    };
    redisCacheService = {
      isEnabled: jest.fn().mockReturnValue(false),
      ping: jest.fn(),
    };
    service = new HealthService(
      prismaService as unknown as PrismaService,
      redisCacheService as any,
      { current: () => 3 } as unknown as AuthEpochService,
      {
        list: () => [
          { platform: 'web', enforce: false, expectedBuild: null },
          { platform: 'desktop', enforce: true, expectedBuild: 12 },
          { platform: 'mobile', enforce: false, expectedBuild: 20 },
        ],
      } as unknown as BuildPolicyService,
    );
  });

  it('returns ok when database is reachable', async () => {
    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      database: { status: 'up' },
    });
  });

  it('reports the backend build and dbOk (Part B Step 2)', async () => {
    const status = await service.check();
    expect(status).toMatchObject({ dbOk: true, version: expect.any(String) });
    expect(status).toHaveProperty('build');
    expect(status).toHaveProperty('commit');
    prismaService.$queryRawUnsafe.mockRejectedValue(new Error('down'));
    await expect(service.check()).resolves.toMatchObject({ dbOk: false });
  });

  it('reports the token epoch and the expected client builds (Part B Step 2 Rev 2)', async () => {
    await expect(service.check()).resolves.toMatchObject({
      tokenEpoch: 3,
      expectedClientBuilds: {
        web: { enforce: false, expectedBuild: null },
        desktop: { enforce: true, expectedBuild: 12 },
        mobile: { enforce: false, expectedBuild: 20 },
      },
    });
  });

  it('returns degraded when database is unreachable', async () => {
    prismaService.$queryRawUnsafe.mockRejectedValue(new Error('database unavailable'));

    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      database: { status: 'down' },
    });
  });
});
