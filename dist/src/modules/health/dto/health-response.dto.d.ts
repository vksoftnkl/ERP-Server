export declare class HealthDatabaseStatusDto {
    status: 'up' | 'down';
}
export declare class HealthCacheStatusDto {
    status: 'up' | 'down' | 'disabled';
}
export declare class HealthExpectedClientBuildDto {
    enforce: boolean;
    expectedBuild: number | null;
}
export declare class HealthExpectedClientBuildsDto {
    web: HealthExpectedClientBuildDto;
    desktop: HealthExpectedClientBuildDto;
    mobile: HealthExpectedClientBuildDto;
}
export declare class HealthResponseDto {
    status: 'ok' | 'degraded';
    timestamp: string;
    version: string;
    build: number | null;
    commit: string | null;
    builtAt: string | null;
    dbOk: boolean;
    tokenEpoch: number;
    expectedClientBuilds: HealthExpectedClientBuildsDto;
    database: HealthDatabaseStatusDto;
    cache: HealthCacheStatusDto;
}
