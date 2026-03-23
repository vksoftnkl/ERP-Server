import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisCacheService } from '../../common/redis/redis-cache.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async check(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    database: { status: 'up' | 'down' };
    cache: { status: 'up' | 'down' | 'disabled' };
  }> {
    let databaseStatus: 'up' | 'down' = 'up';
    let cacheStatus: 'up' | 'down' | 'disabled' = 'disabled';

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      databaseStatus = 'down';
    }

    if (this.redisCacheService.isEnabled()) {
      try {
        await this.redisCacheService.ping();
        cacheStatus = 'up';
      } catch {
        cacheStatus = 'down';
      }
    }

    return {
      status: databaseStatus === 'up' && cacheStatus !== 'down' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: databaseStatus,
      },
      cache: {
        status: cacheStatus,
      },
    };
  }
}
