import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('database.url');
    const loggingEnabled = configService.get<boolean>('database.logging', false);
    const options: Prisma.PrismaClientOptions = {
      log: loggingEnabled ? ['query', 'info', 'warn', 'error'] : ['error'],
    };
    if (databaseUrl) {
      options.datasources = {
        db: {
          url: databaseUrl,
        },
      };
    }
    super(options);
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
