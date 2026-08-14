export declare class HealthDatabaseStatusDto {
    status: 'up' | 'down';
}
export declare class HealthResponseDto {
    status: 'ok' | 'degraded';
    timestamp: string;
    database: HealthDatabaseStatusDto;
}
