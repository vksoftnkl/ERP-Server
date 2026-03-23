import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { RequestContextModule } from './common/request-context/request-context.module';
import { RedisModule } from './common/redis/redis.module';
import { ConfiguredGridSqlModule } from './common/configured-grid-sql/configured-grid-sql.module';
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
import { DropdownDetailsModule } from './modules/dropdown-details/dropdown-details.module';
import { DropdownColumnsModule } from './modules/dropdown-columns/dropdown-columns.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AccessTokenGuard } from './modules/auth/guards/access-token.guard';
import { GodownsMasterModule } from './modules/godowns-master/godowns-master.module';
import { ItemsTaxMasterModule } from './modules/items-tax-master/items-tax-master.module';
import { ItemsEanCodeMasterModule } from './modules/items-ean-code-master/items-ean-code-master.module';
import { ItemsCustRatesMasterModule } from './modules/items-cust-rates-master/items-cust-rates-master.module';
import { ItemsPriceMasterModule } from './modules/items-price-master/items-price-master.module';
import { ItemsQtywiseRatesMasterModule } from './modules/items-qtywise-rates-master/items-qtywise-rates-master.module';
import { ItemsReorderMasterModule } from './modules/items-reorder-master/items-reorder-master.module';
import { ItemsTaxHistoryMasterModule } from './modules/items-tax-history-master/items-tax-history-master.module';
import { ItemsMasterModule } from './modules/items-master/items-master.module';
import { AccountsGroupModule } from './modules/accountsModule/accountsGroup/accounts-group.module';
import { AccountLedgerMastersModule } from './modules/accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { LedgerBankAccountModule } from './modules/accountsModule/ledgerBankAccount/ledger-bank-account.module';
import { BranchMasterModule } from './modules/accountsModule/branchMaster/branch-master.module';
import { CompanyMasterModule } from './modules/accountsModule/companyMaster/company-master.module';
import { CompanyGroupMasterModule } from './modules/accountsModule/companyGroupMaster/company-group-master.module';
import { EmployeeDepartmentMasterModule } from './modules/accountsModule/employeeDepartmentMaster/employee-department-master.module';
import { EmployeeDesignationMasterModule } from './modules/accountsModule/employeeDesignationMaster/employee-designation-master.module';
import { EmployeeMasterModule } from './modules/accountsModule/employeeMaster/employee-master.module';
import { TenderMasterModule } from './modules/accountsModule/tenderMaster/tender-master.module';
import { TenderTypeMasterModule } from './modules/accountsModule/tenderTypeMaster/tender-type-master.module';
import { LedgerShippingAddressModule } from './modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.module';
import { GspProviderMasterModule } from './modules/accountsModule/gspProviderMaster/gsp-provider-master.module';
import { GspCompanyServiceModule } from './modules/accountsModule/gspCompanyService/gsp-company-service.module';
import { SupplierGroupModule } from './modules/purchase/supplier-group/supplier-group.module';
import { SuppliersModule } from './modules/purchase/suppliers/suppliers.module';
import { AreaModule } from './modules/sales/area/area.module';
import { CityModule } from './modules/sales/city/city.module';
import { StateModule } from './modules/sales/state/state.module';
import { CustomerModule } from './modules/sales/customer/customer.module';
import { CustomerGroupModule } from './modules/sales/customer-group/customer-group.module';
import { BankListModule } from './modules/fixed/bank-list/bank-list.module';
import { DeviceListMasterModule } from './modules/fixed/device-list-master/device-list-master.module';
import { MenuMasterModule } from './modules/fixed/menu-master/menu-master.module';
import { PriceLevelMasterModule } from './modules/fixed/price-level-master/price-level-master.module';
import { HsnCodeMasterModule } from './modules/fixed/hsn-code-master/hsn-code-master.module';
import { StateCodeMasterModule } from './modules/fixed/state-code-master/state-code-master.module';
import { UiTableColumnsModule } from './modules/fixed/ui-table-columns/ui-table-columns.module';
import { UiTableMasterModule } from './modules/fixed/ui-table-master/ui-table-master.module';
import { UserLoginSessionsModule } from './modules/fixed/user-login-sessions/user-login-sessions.module';
import { MasterLookupModule } from './modules/master-lookup/master-lookup.module';
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
    RedisModule,
    ConfiguredGridSqlModule,
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
    ItemsTaxHistoryMasterModule,
    ItemsMasterModule,
    AccountsGroupModule,
    AccountLedgerMastersModule,
    LedgerBankAccountModule,
    LedgerShippingAddressModule,
    BranchMasterModule,
    CompanyMasterModule,
    CompanyGroupMasterModule,
    EmployeeDepartmentMasterModule,
    EmployeeDesignationMasterModule,
    EmployeeMasterModule,
    TenderMasterModule,
    TenderTypeMasterModule,
    GspProviderMasterModule,
    GspCompanyServiceModule,
    SupplierGroupModule,
    SuppliersModule,
    StateModule,
    CityModule,
    AreaModule,
    CustomerModule,
    CustomerGroupModule,
    BankListModule,
    DeviceListMasterModule,
    MenuMasterModule,
    PriceLevelMasterModule,
    HsnCodeMasterModule,
    StateCodeMasterModule,
    UiTableColumnsModule,
    UiTableMasterModule,
    UserLoginSessionsModule,
    MasterLookupModule,
    GodownsMasterModule,
    GridDetailsModule,
    GridColumnsModule,
    DropdownDetailsModule,
    DropdownColumnsModule,
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
