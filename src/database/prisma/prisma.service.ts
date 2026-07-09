import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { createTenantScopeExtension, TENANT_SCOPED_DELEGATES } from './tenant-scope.extension';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService, requestContextService: RequestContextService) {
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
    // Route tenant-model delegates (this.customer, this.supplier, …) through the
    // company-scoped extended client; everything else ($transaction, $queryRaw,
    // non-tenant models) stays on the base client. See tenant-scope.extension.ts.
    const tenantScopedClient = this.$extends(createTenantScopeExtension(requestContextService));
    return new Proxy(this, {
      get: (target, property) => {
        if (typeof property === 'string' && TENANT_SCOPED_DELEGATES.has(property)) {
          return (tenantScopedClient as unknown as Record<string, unknown>)[property];
        }
        const value = (target as unknown as Record<PropertyKey, unknown>)[property];
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
