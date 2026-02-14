import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
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
    ThrottlerModule.forRoot([
      {
        ttl: parseNumber(process.env.THROTTLE_TTL, 60) * 1000,
        limit: parseNumber(process.env.THROTTLE_LIMIT, 100),
      },
    ]),
    PrismaModule,
    HealthModule,
    UsersModule,
    ItemsGroupMasterModule,
    ItemsBrandMasterModule,
    ItemsSectionMasterModule,
    UnitsMasterModule,
    AuthModule,
  ],
  providers: [
    RequestLoggerMiddleware,
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
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
