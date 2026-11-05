export declare class HealthDatabaseStatusDto {
    status: 'up' | 'down';
}
export declare class HealthCacheStatusDto {
    status: 'up' | 'down' | 'disabled';
}
export declare class HealthResponseDto {
    status: 'ok' | 'degraded';
    timestamp: string;
    database: HealthDatabaseStatusDto;
    cache: HealthCacheStatusDto;
}
