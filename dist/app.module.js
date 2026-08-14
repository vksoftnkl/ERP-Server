"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const timeout_interceptor_1 = require("./common/interceptors/timeout.interceptor");
const request_logger_middleware_1 = require("./common/middleware/request-logger.middleware");
const configuration_1 = require("./config/configuration");
const env_validation_1 = require("./config/env.validation");
const prisma_module_1 = require("./database/prisma/prisma.module");
const health_module_1 = require("./modules/health/health.module");
const users_module_1 = require("./modules/users/users.module");
const items_group_master_module_1 = require("./modules/items-group-master/items-group-master.module");
const auth_module_1 = require("./modules/auth/auth.module");
const items_brand_master_module_1 = require("./modules/items-brand-master/items-brand-master.module");
const units_master_module_1 = require("./modules/units-master/units-master.module");
const items_section_master_module_1 = require("./modules/items-section-master/items-section-master.module");
const parseNumber = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(request_logger_middleware_1.RequestLoggerMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                expandVariables: true,
                load: [configuration_1.default],
                validationSchema: env_validation_1.envValidationSchema,
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: parseNumber(process.env.THROTTLE_TTL, 60) * 1000,
                    limit: parseNumber(process.env.THROTTLE_LIMIT, 100),
                },
            ]),
            prisma_module_1.PrismaModule,
            health_module_1.HealthModule,
            users_module_1.UsersModule,
            items_group_master_module_1.ItemsGroupMasterModule,
            items_brand_master_module_1.ItemsBrandMasterModule,
            items_section_master_module_1.ItemsSectionMasterModule,
            units_master_module_1.UnitsMasterModule,
            auth_module_1.AuthModule,
        ],
        providers: [
            request_logger_middleware_1.RequestLoggerMiddleware,
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_FILTER,
                useClass: all_exceptions_filter_1.AllExceptionsFilter,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: timeout_interceptor_1.TimeoutInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map