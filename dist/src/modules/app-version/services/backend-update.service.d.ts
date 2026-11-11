import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { RedisCacheService } from '../../../common/redis/redis-cache.service';
import { type BackendBuild } from '../../health/backend-build';
import { type CompatManifest } from '../compat/compat-manifest';
import { AppVersionStateStore, type BackendUpdateOutcome } from './app-version-state.store';
import { AuthEpochService } from './auth-epoch.service';
import { BuildPolicyService } from './build-policy.service';
export declare class BackendUpdateService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly store;
    private readonly epoch;
    private readonly policies;
    private readonly redis;
    private readonly logger;
    private timer;
    private manifest;
    private retry;
    private ticking;
    constructor(store: AppVersionStateStore, epoch: AuthEpochService, policies: BuildPolicyService, redis: RedisCacheService);
    onApplicationBootstrap(): Promise<void>;
    onModuleDestroy(): void;
    bundledManifest(): CompatManifest | null;
    runStartupCheck(build?: BackendBuild, env?: NodeJS.ProcessEnv): Promise<BackendUpdateOutcome | null>;
    private releasesToImport;
    private tick;
    private refresh;
    private tidySessions;
}
