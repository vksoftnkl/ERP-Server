import { PrismaService } from '../../database/prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: { $queryRawUnsafe: jest.Mock };

  beforeEach(() => {
    prismaService = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ now: new Date().toISOString() }]),
    };
    service = new HealthService(prismaService as unknown as PrismaService);
  });

  it('returns ok when database is reachable', async () => {
    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      database: { status: 'up' },
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
