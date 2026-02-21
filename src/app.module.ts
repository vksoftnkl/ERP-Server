import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { RequestContextModule } from './common/request-context/request-context.module';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './database/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ItemsGroupMasterModule } from './modules/items-group-master/items-group-master.module';
import { AuthModule } from './modules/auth/auth.module';
import { ItemsBrandMasterModule } from './modules/items-brand-master/items-brand-master.module';
import { UnitsMasterModule } from './modules/units-master/units-master.module';
import { ItemsSectionMasterModule } from './modules/items-section-master/items-section-master.module';
import { ItemsCategoryMasterModule } from './modules/items-category-master/items-category-master.module';
import { GridDetailsModule } from './modules/grid-details/grid-details.module';
import { GridColumnsModule } from './modules/grid-columns/grid-columns.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AccessTokenGuard } from './modules/auth/guards/access-token.guard';
import { GodownsMasterModule } from './modules/godowns-master/godowns-master.module';
import { ItemsTaxMasterModule } from './modules/items-tax-master/items-tax-master.module';
import { ItemsEanCodeMasterModule } from './modules/items-ean-code-master/items-ean-code-master.module';
import { ItemsCustRatesMasterModule } from './modules/items-cust-rates-master/items-cust-rates-master.module';
import { ItemsPriceMasterModule } from './modules/items-price-master/items-price-master.module';
import { ItemsQtywiseRatesMasterModule } from './modules/items-qtywise-rates-master/items-qtywise-rates-master.module';
import { ItemsReorderMasterModule } from './modules/items-reorder-master/items-reorder-master.module';

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    RequestContextModule,
    ThrottlerModule.forRoot([
      {
        ttl: parseNumber(process.env.THROTTLE_TTL, 60) * 1000,
        limit: parseNumber(process.env.THROTTLE_LIMIT, 100),
      },
    ]),
    PrismaModule,
    AuditLogModule,
    HealthModule,
    UsersModule,
    ItemsGroupMasterModule,
    ItemsBrandMasterModule,
    ItemsSectionMasterModule,
    ItemsCategoryMasterModule,
    UnitsMasterModule,
    ItemsTaxMasterModule,
    ItemsEanCodeMasterModule,
    ItemsCustRatesMasterModule,
    ItemsPriceMasterModule,
    ItemsQtywiseRatesMasterModule,
    ItemsReorderMasterModule,
    GodownsMasterModule,
    GridDetailsModule,
    GridColumnsModule,
    AuthModule,
  ],
  providers: [
    RequestContextMiddleware,
    RequestLoggerMiddleware,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
