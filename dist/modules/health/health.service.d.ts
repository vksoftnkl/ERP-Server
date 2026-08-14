import { PrismaService } from '../../database/prisma/prisma.service';
export declare class HealthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    check(): Promise<{
        status: 'ok' | 'degraded';
        timestamp: string;
        database: {
            status: 'up' | 'down';
        };
    }>;
}
