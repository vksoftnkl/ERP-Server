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
const http_cache_interceptor_1 = require("./common/interceptors/http-cache.interceptor");
const http_cache_invalidation_interceptor_1 = require("./common/interceptors/http-cache-invalidation.interceptor");
const timeout_interceptor_1 = require("./common/interceptors/timeout.interceptor");
const request_context_middleware_1 = require("./common/middleware/request-context.middleware");
const request_logger_middleware_1 = require("./common/middleware/request-logger.middleware");
const request_context_module_1 = require("./common/request-context/request-context.module");
const redis_module_1 = require("./common/redis/redis.module");
const queue_module_1 = require("./common/queue/queue.module");
const configured_grid_sql_module_1 = require("./common/configured-grid-sql/configured-grid-sql.module");
const sequence_module_1 = require("./common/Sequence/sequence.module");
const configuration_1 = require("./config/configuration");
const env_validation_1 = require("./config/env.validation");
const prisma_module_1 = require("./database/prisma/prisma.module");
const pg_module_1 = require("./database/pg/pg.module");
const health_module_1 = require("./modules/health/health.module");
const users_module_1 = require("./modules/users/users.module");
const auth_module_1 = require("./modules/auth/auth.module");
const grid_details_module_1 = require("./modules/grid-details/grid-details.module");
const dropdown_details_module_1 = require("./modules/dropdown-details/dropdown-details.module");
const audit_log_module_1 = require("./modules/audit-log/audit-log.module");
const access_token_guard_1 = require("./modules/auth/guards/access-token.guard");
const items_cust_rates_master_module_1 = require("./modules/items-cust-rates-master/items-cust-rates-master.module");
const item_price_details_module_1 = require("./modules/Inventory/item-price-details/item-price-details.module");
const acc_group_master_module_1 = require("./modules/accountsModule/accGroupMaster/acc-group-master.module");
const account_ledger_masters_module_1 = require("./modules/accountsModule/accountLedgerMasters/account-ledger-masters.module");
const ledger_bank_account_module_1 = require("./modules/accountsModule/ledgerBankAccount/ledger-bank-account.module");
const branch_master_module_1 = require("./modules/settings/branchMaster/branch-master.module");
const company_master_module_1 = require("./modules/settings/companyMaster/company-master.module");
const company_group_master_module_1 = require("./modules/accountsModule/companyGroupMaster/company-group-master.module");
const employee_department_master_module_1 = require("./modules/settings/employeeDepartmentMaster/employee-department-master.module");
const employee_designation_master_module_1 = require("./modules/settings/employeeDesignationMaster/employee-designation-master.module");
const employee_master_module_1 = require("./modules/settings/employeeMaster/employee-master.module");
const user_administration_module_1 = require("./modules/settings/userAdministration/user-administration.module");
const configs_module_1 = require("./modules/settings/configs/configs.module");
const app_settings_module_1 = require("./modules/settings/appSettings/app-settings.module");
const print_template_module_1 = require("./modules/settings/print-template/print-template.module");
const tender_master_module_1 = require("./modules/accountsModule/tenderMaster/tender-master.module");
const tender_type_master_module_1 = require("./modules/accountsModule/tenderTypeMaster/tender-type-master.module");
const tender_detail_module_1 = require("./modules/accountsModule/tenderDetail/tender-detail.module");
const transaction_module_1 = require("./modules/accountsModule/transaction/transaction.module");
const ledger_shipping_address_module_1 = require("./modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.module");
const gsp_provider_master_module_1 = require("./modules/accountsModule/gspProviderMaster/gsp-provider-master.module");
const gsp_company_service_module_1 = require("./modules/settings/gspCompanyService/gsp-company-service.module");
const supplier_group_module_1 = require("./modules/purchase/supplier-group/supplier-group.module");
const suppliers_module_1 = require("./modules/purchase/suppliers/suppliers.module");
const area_module_1 = require("./modules/sales/area/area.module");
const sale_freight_charges_module_1 = require("./modules/sales/sale-freight-charges/sale-freight-charges.module");
const sale_loading_charges_module_1 = require("./modules/sales/sale-loading-charges/sale-loading-charges.module");
const city_module_1 = require("./modules/sales/city/city.module");
const state_module_1 = require("./modules/sales/state/state.module");
const customer_module_1 = require("./modules/sales/customer/customer.module");
const customer_group_module_1 = require("./modules/sales/customer-group/customer-group.module");
const sale_agent_module_1 = require("./modules/sales/sale-agent/sale-agent.module");
const quotation_module_1 = require("./modules/sales/quotation/quotation.module");
const bill_module_1 = require("./modules/sales/bill/bill.module");
const sale_order_module_1 = require("./modules/sales/sale-order/sale-order.module");
const txn_hold_module_1 = require("./modules/sales/txn-hold/txn-hold.module");
const bank_list_module_1 = require("./modules/fixed/bank-list/bank-list.module");
const device_list_master_module_1 = require("./modules/fixed/device-list-master/device-list-master.module");
const menu_master_module_1 = require("./modules/fixed/menu-master/menu-master.module");
const price_level_master_module_1 = require("./modules/fixed/price-level-master/price-level-master.module");
const hsn_code_master_module_1 = require("./modules/fixed/hsn-code-master/hsn-code-master.module");
const state_code_master_module_1 = require("./modules/fixed/state-code-master/state-code-master.module");
const ui_table_master_module_1 = require("./modules/fixed/ui-table-master/ui-table-master.module");
const user_login_sessions_module_1 = require("./modules/fixed/user-login-sessions/user-login-sessions.module");
const stock_adj_reasons_module_1 = require("./modules/fixed/stock-adj-reasons/stock-adj-reasons.module");
const master_lookup_module_1 = require("./modules/master-lookup/master-lookup.module");
const batch_prefix_module_1 = require("./modules/master/batch-prefix/batch-prefix.module");
const widget_master_module_1 = require("./modules/master/widget-master/widget-master.module");
const charge_master_module_1 = require("./modules/master/charge-master/charge-master.module");
const charge_detail_module_1 = require("./modules/master/charge-detail/charge-detail.module");
const promotion_loyalty_points_module_1 = require("./modules/sales/loyalty/promotion-loyalty-points.module");
const promotion_scheme_module_1 = require("./modules/sales/promotion-scheme/promotion-scheme.module");
const print_template_assignment_module_1 = require("./modules/settings/print-template-assignment/print-template-assignment.module");
const print_render_module_1 = require("./modules/settings/print-render/print-render.module");
const physical_stock_module_1 = require("./modules/stocks/physical-stock/physical-stock.module");
const itemStockBalanceModule_1 = require("./modules/stocks/itemstockbalance/itemStockBalanceModule");
const itemBatchStockModule_1 = require("./modules/stocks/itembatchstock/itemBatchStockModule");
const godowns_master_module_1 = require("./modules/Inventory/godowns-master/godowns-master.module");
const items_group_master_module_1 = require("./modules/Inventory/items-group-master/items-group-master.module");
const items_brand_master_module_1 = require("./modules/Inventory/items-brand-master/items-brand-master.module");
const items_section_master_module_1 = require("./modules/Inventory/items-section-master/items-section-master.module");
const items_category_master_module_1 = require("./modules/Inventory/items-category-master/items-category-master.module");
const units_master_module_1 = require("./modules/Inventory/units-master/units-master.module");
const items_tax_master_module_1 = require("./modules/Inventory/items-tax-master/items-tax-master.module");
const items_ean_code_master_module_1 = require("./modules/Inventory/items-ean-code-master/items-ean-code-master.module");
const items_gst_units_master_module_1 = require("./modules/Inventory/items-gst-units-master/items-gst-units-master.module");
const items_price_master_module_1 = require("./modules/Inventory/items-price-master/items-price-master.module");
const item_unit_conversion_module_1 = require("./modules/Inventory/item-unit-conversion/item-unit-conversion.module");
const items_reorder_master_module_1 = require("./modules/Inventory/items-reorder-master/items-reorder-master.module");
const items_qty_price_master_module_1 = require("./modules/Inventory/items-qty-price-master/items-qty-price-master.module");
const items_tax_history_master_module_1 = require("./modules/Inventory/items-tax-history-master/items-tax-history-master.module");
const items_master_module_1 = require("./modules/Inventory/items-master/items-master.module");
const parseNumber = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};
const parseBoolean = (value, fallback = false) => {
    if (value === undefined) {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};
const isThrottlerEnabled = parseBoolean(process.env.THROTTLE_ENABLED, true);
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(request_context_middleware_1.RequestContextMiddleware, request_logger_middleware_1.RequestLoggerMiddleware).forRoutes('{*path}');
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
            request_context_module_1.RequestContextModule,
            redis_module_1.RedisModule,
            queue_module_1.QueueModule,
            configured_grid_sql_module_1.ConfiguredGridSqlModule,
            sequence_module_1.SequenceModule,
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: parseNumber(process.env.THROTTLE_TTL, 60) * 1000,
                    limit: parseNumber(process.env.THROTTLE_LIMIT, 100),
                },
            ]),
            prisma_module_1.PrismaModule,
            pg_module_1.PgModule,
            audit_log_module_1.AuditLogModule,
            health_module_1.HealthModule,
            users_module_1.UsersModule,
            items_group_master_module_1.ItemsGroupMasterModule,
            items_brand_master_module_1.ItemsBrandMasterModule,
            items_section_master_module_1.ItemsSectionMasterModule,
            items_category_master_module_1.ItemsCategoryMasterModule,
            units_master_module_1.UnitsMasterModule,
            items_tax_master_module_1.ItemsTaxMasterModule,
            items_ean_code_master_module_1.ItemsEanCodeMasterModule,
            items_gst_units_master_module_1.ItemsGstUnitsMasterModule,
            items_cust_rates_master_module_1.ItemsCustRatesMasterModule,
            items_price_master_module_1.ItemsPriceMasterModule,
            item_unit_conversion_module_1.ItemUnitConversionModule,
            item_price_details_module_1.ItemPriceDetailsModule,
            items_reorder_master_module_1.ItemsReorderMasterModule,
            items_qty_price_master_module_1.ItemsQtyPriceMasterModule,
            items_tax_history_master_module_1.ItemsTaxHistoryMasterModule,
            items_master_module_1.ItemsMasterModule,
            acc_group_master_module_1.AccGroupMasterModule,
            account_ledger_masters_module_1.AccountLedgerMastersModule,
            ledger_bank_account_module_1.LedgerBankAccountModule,
            ledger_shipping_address_module_1.LedgerShippingAddressModule,
            branch_master_module_1.BranchMasterModule,
            company_master_module_1.CompanyMasterModule,
            company_group_master_module_1.CompanyGroupMasterModule,
            employee_department_master_module_1.EmployeeDepartmentMasterModule,
            employee_designation_master_module_1.EmployeeDesignationMasterModule,
            employee_master_module_1.EmployeeMasterModule,
            user_administration_module_1.UserAdministrationModule,
            configs_module_1.ConfigsModule,
            app_settings_module_1.AppSettingsModule,
            print_template_module_1.PrintTemplateModule,
            tender_master_module_1.TenderMasterModule,
            tender_type_master_module_1.TenderTypeMasterModule,
            tender_detail_module_1.TenderDetailModule,
            transaction_module_1.TransactionModule,
            gsp_provider_master_module_1.GspProviderMasterModule,
            gsp_company_service_module_1.GspCompanyServiceModule,
            supplier_group_module_1.SupplierGroupModule,
            suppliers_module_1.SuppliersModule,
            state_module_1.StateModule,
            city_module_1.CityModule,
            area_module_1.AreaModule,
            sale_freight_charges_module_1.SaleFreightChargeModule,
            sale_loading_charges_module_1.SaleLoadingChargeModule,
            customer_module_1.CustomerModule,
            customer_group_module_1.CustomerGroupModule,
            sale_agent_module_1.SaleAgentModule,
            quotation_module_1.QuotationModule,
            bill_module_1.BillModule,
            sale_order_module_1.SaleOrderModule,
            txn_hold_module_1.TxnHoldModule,
            bank_list_module_1.BankListModule,
            device_list_master_module_1.DeviceListMasterModule,
            menu_master_module_1.MenuMasterModule,
            price_level_master_module_1.PriceLevelMasterModule,
            hsn_code_master_module_1.HsnCodeMasterModule,
            state_code_master_module_1.StateCodeMasterModule,
            ui_table_master_module_1.UiTableMasterModule,
            user_login_sessions_module_1.UserLoginSessionsModule,
            stock_adj_reasons_module_1.StockAdjReasonsModule,
            master_lookup_module_1.MasterLookupModule,
            batch_prefix_module_1.BatchPrefixModule,
            widget_master_module_1.WidgetMasterModule,
            charge_master_module_1.ChargeMasterModule,
            charge_detail_module_1.ChargeDetailModule,
            physical_stock_module_1.PhysicalStockModule,
            itemStockBalanceModule_1.ItemStockBalanceModule,
            itemBatchStockModule_1.ItemBatchStockModule,
            promotion_loyalty_points_module_1.PromotionLoyaltyPointsModule,
            promotion_scheme_module_1.PromotionSchemeModule,
            print_template_assignment_module_1.PrintTemplateAssignmentModule,
            print_render_module_1.PrintRenderModule,
            godowns_master_module_1.GodownsMasterModule,
            grid_details_module_1.GridDetailsModule,
            dropdown_details_module_1.DropdownDetailsModule,
            auth_module_1.AuthModule,
        ],
        providers: [
            request_context_middleware_1.RequestContextMiddleware,
            request_logger_middleware_1.RequestLoggerMiddleware,
            {
                provide: core_1.APP_GUARD,
                useClass: access_token_guard_1.AccessTokenGuard,
            },
            ...(isThrottlerEnabled
                ? [
                    {
                        provide: core_1.APP_GUARD,
                        useClass: throttler_1.ThrottlerGuard,
                    },
                ]
                : []),
            {
                provide: core_1.APP_FILTER,
                useClass: all_exceptions_filter_1.AllExceptionsFilter,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: http_cache_interceptor_1.HttpCacheInterceptor,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: http_cache_invalidation_interceptor_1.HttpCacheInvalidationInterceptor,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: timeout_interceptor_1.TimeoutInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map