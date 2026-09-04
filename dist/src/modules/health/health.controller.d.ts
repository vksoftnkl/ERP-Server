import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    getHealth(): Promise<{
        status: 'ok' | 'degraded';
        timestamp: string;
        database: {
            status: 'up' | 'down';
        };
        cache: {
            status: 'up' | 'down' | 'disabled';
        };
    }>;
}
