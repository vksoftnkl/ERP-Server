import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    database: { status: 'up' | 'down' };
  }> {
    let databaseStatus: 'up' | 'down' = 'up';

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      databaseStatus = 'down';
    }

    return {
      status: databaseStatus === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: databaseStatus,
      },
    };
  }
}
