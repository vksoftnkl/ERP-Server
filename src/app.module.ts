import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpCacheInterceptor } from './common/interceptors/http-cache.interceptor';
import { HttpCacheInvalidationInterceptor } from './common/interceptors/http-cache-invalidation.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { RequestContextModule } from './common/request-context/request-context.module';
import { RedisModule } from './common/redis/redis.module';
import { QueueModule } from './common/queue/queue.module';
import { ConfiguredGridSqlModule } from './common/configured-grid-sql/configured-grid-sql.module';
import { SequenceModule } from './common/Sequence/sequence.module';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './database/prisma/prisma.module';
import { PgModule } from './database/pg/pg.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { GridDetailsModule } from './modules/grid-details/grid-details.module';
import { DropdownDetailsModule } from './modules/dropdown-details/dropdown-details.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AccessTokenGuard } from './modules/auth/guards/access-token.guard';
import { ItemsCustRatesMasterModule } from './modules/items-cust-rates-master/items-cust-rates-master.module';
import { ItemPriceDetailsModule } from './modules/Inventory/item-price-details/item-price-details.module';
import { AccountsGroupModule } from './modules/accountsModule/accountsGroup/accounts-group.module';
import { AccountLedgerMastersModule } from './modules/accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { LedgerBankAccountModule } from './modules/accountsModule/ledgerBankAccount/ledger-bank-account.module';
import { BranchMasterModule } from './modules/settings/branchMaster/branch-master.module';
import { CompanyMasterModule } from './modules/settings/companyMaster/company-master.module';
import { CompanyGroupMasterModule } from './modules/accountsModule/companyGroupMaster/company-group-master.module';
import { EmployeeDepartmentMasterModule } from './modules/settings/employeeDepartmentMaster/employee-department-master.module';
import { EmployeeDesignationMasterModule } from './modules/settings/employeeDesignationMaster/employee-designation-master.module';
import { EmployeeMasterModule } from './modules/settings/employeeMaster/employee-master.module';
import { UserAdministrationModule } from './modules/settings/userAdministration/user-administration.module';
import { ConfigsModule } from './modules/settings/configs/configs.module';
import { TenderMasterModule } from './modules/accountsModule/tenderMaster/tender-master.module';
import { TenderTypeMasterModule } from './modules/accountsModule/tenderTypeMaster/tender-type-master.module';
import { LedgerShippingAddressModule } from './modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.module';
import { GspProviderMasterModule } from './modules/accountsModule/gspProviderMaster/gsp-provider-master.module';
import { GspCompanyServiceModule } from './modules/settings/gspCompanyService/gsp-company-service.module';
import { SupplierGroupModule } from './modules/purchase/supplier-group/supplier-group.module';
import { SuppliersModule } from './modules/purchase/suppliers/suppliers.module';
import { AreaModule } from './modules/sales/area/area.module';
import { SaleFreightChargeModule } from './modules/sales/sale-freight-charges/sale-freight-charges.module';
import { SaleLoadingChargeModule } from './modules/sales/sale-loading-charges/sale-loading-charges.module';
import { CityModule } from './modules/sales/city/city.module';
import { StateModule } from './modules/sales/state/state.module';
import { CustomerModule } from './modules/sales/customer/customer.module';
import { CustomerGroupModule } from './modules/sales/customer-group/customer-group.module';
import { QuotationModule } from './modules/sales/quotation/quotation.module';
import { BankListModule } from './modules/fixed/bank-list/bank-list.module';
import { DeviceListMasterModule } from './modules/fixed/device-list-master/device-list-master.module';
import { MenuMasterModule } from './modules/fixed/menu-master/menu-master.module';
import { PriceLevelMasterModule } from './modules/fixed/price-level-master/price-level-master.module';
import { HsnCodeMasterModule } from './modules/fixed/hsn-code-master/hsn-code-master.module';
import { StateCodeMasterModule } from './modules/fixed/state-code-master/state-code-master.module';
import { UiTableMasterModule } from './modules/fixed/ui-table-master/ui-table-master.module';
import { UserLoginSessionsModule } from './modules/fixed/user-login-sessions/user-login-sessions.module';
import { StockAdjReasonsModule } from './modules/fixed/stock-adj-reasons/stock-adj-reasons.module';
import { MasterLookupModule } from './modules/master-lookup/master-lookup.module';
import { BatchPrefixModule } from './modules/master/batch-prefix/batch-prefix.module';
import { WidgetMasterModule } from './modules/master/widget-master/widget-master.module';
import { PromotionLoyaltyPointsModule } from './modules/sales/loyalty/promotion-loyalty-points.module';
import { OpeningStockModule } from './modules/stocks/opening-stock/opening-stock.module';
import { PhysicalStockModule } from './modules/stocks/physical-stock/physical-stock.module';
import { ItemStockBalanceModule } from './modules/stocks/itemstockbalance/itemStockBalanceModule';
import { ItemBatchStockModule } from './modules/stocks/itembatchstock/itemBatchStockModule';
import { GodownsMasterModule } from './modules/Inventory/godowns-master/godowns-master.module';
import { ItemsGroupMasterModule } from './modules/Inventory/items-group-master/items-group-master.module';
import { ItemsBrandMasterModule } from './modules/Inventory/items-brand-master/items-brand-master.module';
import { ItemsSectionMasterModule } from './modules/Inventory/items-section-master/items-section-master.module';
import { ItemsCategoryMasterModule } from './modules/Inventory/items-category-master/items-category-master.module';
import { UnitsMasterModule } from './modules/Inventory/units-master/units-master.module';
import { ItemsTaxMasterModule } from './modules/Inventory/items-tax-master/items-tax-master.module';
import { ItemsEanCodeMasterModule } from './modules/Inventory/items-ean-code-master/items-ean-code-master.module';
import { ItemsGstUnitsMasterModule } from './modules/Inventory/items-gst-units-master/items-gst-units-master.module';
import { ItemsPriceMasterModule } from './modules/Inventory/items-price-master/items-price-master.module';
import { ItemUnitConversionModule } from './modules/Inventory/item-unit-conversion/item-unit-conversion.module';
import { ItemsReorderMasterModule } from './modules/Inventory/items-reorder-master/items-reorder-master.module';
import { ItemsQtyPriceMasterModule } from './modules/Inventory/items-qty-price-master/items-qty-price-master.module';
import { ItemsTaxHistoryMasterModule } from './modules/Inventory/items-tax-history-master/items-tax-history-master.module';
import { ItemsMasterModule } from './modules/Inventory/items-master/items-master.module';
const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};
const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};
const isThrottlerEnabled = parseBoolean(process.env.THROTTLE_ENABLED, true);
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
    QueueModule,
    ConfiguredGridSqlModule,
    SequenceModule,
    ThrottlerModule.forRoot([
      {
        ttl: parseNumber(process.env.THROTTLE_TTL, 60) * 1000,
        limit: parseNumber(process.env.THROTTLE_LIMIT, 100),
      },
    ]),
    PrismaModule,
    PgModule,
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
    ItemsGstUnitsMasterModule,
    ItemsCustRatesMasterModule,
    ItemsPriceMasterModule,
    ItemUnitConversionModule,
    ItemPriceDetailsModule,
    ItemsReorderMasterModule,
    ItemsQtyPriceMasterModule,
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
    UserAdministrationModule,
    ConfigsModule,
    TenderMasterModule,
    TenderTypeMasterModule,
    GspProviderMasterModule,
    GspCompanyServiceModule,
    SupplierGroupModule,
    SuppliersModule,
    StateModule,
    CityModule,
    AreaModule,
    SaleFreightChargeModule,
    SaleLoadingChargeModule,
    CustomerModule,
    CustomerGroupModule,
    QuotationModule,
    BankListModule,
    DeviceListMasterModule,
    MenuMasterModule,
    PriceLevelMasterModule,
    HsnCodeMasterModule,
    StateCodeMasterModule,
    UiTableMasterModule,
    UserLoginSessionsModule,
    StockAdjReasonsModule,
    MasterLookupModule,
    BatchPrefixModule,
    WidgetMasterModule,
    OpeningStockModule,
    PhysicalStockModule,
    ItemStockBalanceModule,
    ItemBatchStockModule,
    PromotionLoyaltyPointsModule,
    GodownsMasterModule,
    GridDetailsModule,
    DropdownDetailsModule,
    AuthModule,
  ],
  providers: [
    RequestContextMiddleware,
    RequestLoggerMiddleware,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    ...(isThrottlerEnabled
      ? [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]
      : []),
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInvalidationInterceptor,
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