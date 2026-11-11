import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { ClientPlatform } from '../../common/client-info/client-info';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { AuthEpochService } from '../app-version/services/auth-epoch.service';
import { BuildPolicyService } from '../app-version/services/build-policy.service';
import { backendBuild } from './backend-build';

/** Part B Step 2 Rev 2: what a platform's frontend must run to log in. */
export interface ExpectedClientBuild {
  enforce: boolean;
  expectedBuild: number | null;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  /** Part B Step 2: this backend's own build (APP_VERSION / APP_BUILD / APP_COMMIT). */
  version: string;
  build: number | null;
  commit: string | null;
  /** Part B Step 2: true when `SELECT 1` answered (= database.status 'up'). */
  dbOk: boolean;
  /** Part B Step 2 Rev 2: tokens minted under a lower epoch are refused. */
  tokenEpoch: number;
  /** Part B Step 2 Rev 2: the build policy of each platform (in-memory copy). */
  expectedClientBuilds: Record<ClientPlatform, ExpectedClientBuild>;
  database: { status: 'up' | 'down' };
  cache: { status: 'up' | 'down' | 'disabled' };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService,
    private readonly authEpoch: AuthEpochService,
    private readonly buildPolicy: BuildPolicyService,
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
      tokenEpoch: this.authEpoch.current(),
      expectedClientBuilds: this.expectedClientBuilds(),
      database: {
        status: databaseStatus,
      },
      cache: {
        status: cacheStatus,
      },
    };
  }

  private expectedClientBuilds(): Record<ClientPlatform, ExpectedClientBuild> {
    const result = {} as Record<ClientPlatform, ExpectedClientBuild>;
    for (const policy of this.buildPolicy.list()) {
      result[policy.platform] = { enforce: policy.enforce, expectedBuild: policy.expectedBuild };
    }
    return result;
  }
}
