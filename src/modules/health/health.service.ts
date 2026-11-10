import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { backendBuild } from './backend-build';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  /** Part B Step 2: this backend's own build (APP_VERSION / APP_BUILD / APP_COMMIT). */
  version: string;
  build: number | null;
  commit: string | null;
  /** Part B Step 2: true when `SELECT 1` answered (= database.status 'up'). */
  dbOk: boolean;
  database: { status: 'up' | 'down' };
  cache: { status: 'up' | 'down' | 'disabled' };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async check(): Promise<HealthStatus> {
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

    const build = backendBuild();
    return {
      status: databaseStatus === 'up' && cacheStatus !== 'down' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: build.version,
      build: build.build,
      commit: build.commit,
      dbOk: databaseStatus === 'up',
      database: {
        status: databaseStatus,
      },
      cache: {
        status: cacheStatus,
      },
    };
  }
}
