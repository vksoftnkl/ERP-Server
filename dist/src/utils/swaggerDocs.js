"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerModuleDocuments = void 0;
const audit_log_module_1 = require("../modules/audit-log/audit-log.module");
const sequence_module_1 = require("../common/Sequence/sequence.module");
const account_ledger_masters_module_1 = require("../modules/accountsModule/accountLedgerMasters/account-ledger-masters.module");
const acc_group_master_module_1 = require("../modules/accountsModule/accGroupMaster/acc-group-master.module");
const ledger_bank_account_module_1 = require("../modules/accountsModule/ledgerBankAccount/ledger-bank-account.module");
const branch_master_module_1 = require("../modules/settings/branchMaster/branch-master.module");
const company_group_master_module_1 = require("../modules/accountsModule/companyGroupMaster/company-group-master.module");
const company_master_module_1 = require("../modules/settings/companyMaster/company-master.module");
const employee_department_master_module_1 = require("../modules/settings/employeeDepartmentMaster/employee-department-master.module");
const employee_designation_master_module_1 = require("../modules/settings/employeeDesignationMaster/employee-designation-master.module");
const employee_master_module_1 = require("../modules/settings/employeeMaster/employee-master.module");
const user_administration_module_1 = require("../modules/settings/userAdministration/user-administration.module");
const configs_module_1 = require("../modules/settings/configs/configs.module");
const app_settings_module_1 = require("../modules/settings/appSettings/app-settings.module");
const print_template_assignment_module_1 = require("../modules/settings/print-template-assignment/print-template-assignment.module");
const print_template_module_1 = require("../modules/settings/print-template/print-template.module");
const gsp_company_service_module_1 = require("../modules/settings/gspCompanyService/gsp-company-service.module");
const gsp_provider_master_module_1 = require("../modules/accountsModule/gspProviderMaster/gsp-provider-master.module");
const ledger_shipping_address_module_1 = require("../modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.module");
const tender_master_module_1 = require("../modules/accountsModule/tenderMaster/tender-master.module");
const tender_type_master_module_1 = require("../modules/accountsModule/tenderTypeMaster/tender-type-master.module");
const tender_detail_module_1 = require("../modules/accountsModule/tenderDetail/tender-detail.module");
const transaction_module_1 = require("../modules/accountsModule/transaction/transaction.module");
const auth_module_1 = require("../modules/auth/auth.module");
const area_module_1 = require("../modules/sales/area/area.module");
const sale_freight_charges_module_1 = require("../modules/sales/sale-freight-charges/sale-freight-charges.module");
const sale_loading_charges_module_1 = require("../modules/sales/sale-loading-charges/sale-loading-charges.module");
const city_module_1 = require("../modules/sales/city/city.module");
const sale_agent_module_1 = require("../modules/sales/sale-agent/sale-agent.module");
const customer_group_module_1 = require("../modules/sales/customer-group/customer-group.module");
const customer_module_1 = require("../modules/sales/customer/customer.module");
const quotation_module_1 = require("../modules/sales/quotation/quotation.module");
const bill_module_1 = require("../modules/sales/bill/bill.module");
const sale_order_module_1 = require("../modules/sales/sale-order/sale-order.module");
const txn_hold_module_1 = require("../modules/sales/txn-hold/txn-hold.module");
const grid_details_module_1 = require("../modules/grid-details/grid-details.module");
const dropdown_details_module_1 = require("../modules/dropdown-details/dropdown-details.module");
const health_module_1 = require("../modules/health/health.module");
const items_cust_rates_master_module_1 = require("../modules/items-cust-rates-master/items-cust-rates-master.module");
const item_price_details_module_1 = require("../modules/Inventory/item-price-details/item-price-details.module");
const users_module_1 = require("../modules/users/users.module");
const master_lookup_module_1 = require("../modules/master-lookup/master-lookup.module");
const batch_prefix_module_1 = require("../modules/master/batch-prefix/batch-prefix.module");
const charge_master_module_1 = require("../modules/master/charge-master/charge-master.module");
const charge_detail_module_1 = require("../modules/master/charge-detail/charge-detail.module");
const supplier_group_module_1 = require("../modules/purchase/supplier-group/supplier-group.module");
const suppliers_module_1 = require("../modules/purchase/suppliers/suppliers.module");
const state_module_1 = require("../modules/sales/state/state.module");
const bank_list_module_1 = require("../modules/fixed/bank-list/bank-list.module");
const device_list_master_module_1 = require("../modules/fixed/device-list-master/device-list-master.module");
const menu_master_module_1 = require("../modules/fixed/menu-master/menu-master.module");
const price_level_master_module_1 = require("../modules/fixed/price-level-master/price-level-master.module");
const hsn_code_master_module_1 = require("../modules/fixed/hsn-code-master/hsn-code-master.module");
const state_code_master_module_1 = require("../modules/fixed/state-code-master/state-code-master.module");
const ui_table_master_module_1 = require("../modules/fixed/ui-table-master/ui-table-master.module");
const user_login_sessions_module_1 = require("../modules/fixed/user-login-sessions/user-login-sessions.module");
const stock_adj_reasons_module_1 = require("../modules/fixed/stock-adj-reasons/stock-adj-reasons.module");
const promotion_loyalty_points_module_1 = require("../modules/sales/loyalty/promotion-loyalty-points.module");
const promotion_scheme_module_1 = require("../modules/sales/promotion-scheme/promotion-scheme.module");
const items_group_master_module_1 = require("../modules/Inventory/items-group-master/items-group-master.module");
const items_brand_master_module_1 = require("../modules/Inventory/items-brand-master/items-brand-master.module");
const items_section_master_module_1 = require("../modules/Inventory/items-section-master/items-section-master.module");
const items_category_master_module_1 = require("../modules/Inventory/items-category-master/items-category-master.module");
const units_master_module_1 = require("../modules/Inventory/units-master/units-master.module");
const items_tax_master_module_1 = require("../modules/Inventory/items-tax-master/items-tax-master.module");
const items_price_master_module_1 = require("../modules/Inventory/items-price-master/items-price-master.module");
const item_unit_conversion_module_1 = require("../modules/Inventory/item-unit-conversion/item-unit-conversion.module");
const items_reorder_master_module_1 = require("../modules/Inventory/items-reorder-master/items-reorder-master.module");
const items_qty_price_master_module_1 = require("../modules/Inventory/items-qty-price-master/items-qty-price-master.module");
const items_tax_history_master_module_1 = require("../modules/Inventory/items-tax-history-master/items-tax-history-master.module");
const items_master_module_1 = require("../modules/Inventory/items-master/items-master.module");
const items_ean_code_master_module_1 = require("../modules/Inventory/items-ean-code-master/items-ean-code-master.module");
const items_gst_units_master_module_1 = require("../modules/Inventory/items-gst-units-master/items-gst-units-master.module");
const godowns_master_module_1 = require("../modules/Inventory/godowns-master/godowns-master.module");
const itemStockBalanceModule_1 = require("../modules/stocks/itemstockbalance/itemStockBalanceModule");
const itemBatchStockModule_1 = require("../modules/stocks/itembatchstock/itemBatchStockModule");
const physical_stock_module_1 = require("../modules/stocks/physical-stock/physical-stock.module");
const print_render_module_1 = require("../modules/settings/print-render/print-render.module");
const widget_master_module_1 = require("../modules/master/widget-master/widget-master.module");
const configured_grid_sql_module_1 = require("../common/configured-grid-sql/configured-grid-sql.module");
exports.swaggerModuleDocuments = [
    {
        path: 'auth',
        title: 'Auth API',
        description: 'Auth module endpoints',
        include: [auth_module_1.AuthModule],
    },
    {
        path: 'health',
        title: 'Health API',
        description: 'Health module endpoints',
        include: [health_module_1.HealthModule],
    },
    {
        path: 'users',
        title: 'Users API',
        description: 'Users module endpoints',
        include: [users_module_1.UsersModule],
    },
    {
        path: 'batch-prefixes',
        title: 'Batch Prefix API',
        description: 'Batch prefix module endpoints',
        include: [batch_prefix_module_1.BatchPrefixModule],
    },
    {
        path: 'charges',
        title: 'Charge Master API',
        description: 'Charge master (shared sales/purchase additional charges) endpoints',
        include: [charge_master_module_1.ChargeMasterModule],
    },
    {
        path: 'charge-details',
        title: 'Charge Detail API',
        description: 'Per-document applied charge lines (txn_charge_detail) endpoints',
        include: [charge_detail_module_1.ChargeDetailModule],
    },
    {
        path: 'items-group-master',
        title: 'Item Group API',
        description: 'Item group module endpoints',
        include: [items_group_master_module_1.ItemsGroupMasterModule],
    },
    {
        path: 'items-brand-master',
        title: 'Item Brand API',
        description: 'Item brand module endpoints',
        include: [items_brand_master_module_1.ItemsBrandMasterModule],
    },
    {
        path: 'items-section-master',
        title: 'Item Section API',
        description: 'Item section module endpoints',
        include: [items_section_master_module_1.ItemsSectionMasterModule],
    },
    {
        path: 'items-category-master',
        title: 'Item Category API',
        description: 'Item category module endpoints',
        include: [items_category_master_module_1.ItemsCategoryMasterModule],
    },
    {
        path: 'units-master',
        title: 'Units API',
        description: 'Units module endpoints',
        include: [units_master_module_1.UnitsMasterModule],
    },
    {
        path: 'items-tax-master',
        title: 'Item Tax API',
        description: 'Item tax module endpoints',
        include: [items_tax_master_module_1.ItemsTaxMasterModule],
    },
    {
        path: 'item-cust-rates',
        title: 'Item Customer Rates API',
        description: 'Item customer rates module endpoints',
        include: [items_cust_rates_master_module_1.ItemsCustRatesMasterModule],
    },
    {
        path: 'item-prices',
        title: 'Item Prices API',
        description: 'Item prices module endpoints',
        include: [items_price_master_module_1.ItemsPriceMasterModule],
    },
    {
        path: 'item-unit-conversions',
        title: 'Item Unit Conversions API',
        description: 'Item unit conversion module endpoints',
        include: [item_unit_conversion_module_1.ItemUnitConversionModule],
    },
    {
        path: 'item-price-details',
        title: 'Item Price Details API',
        description: 'Item price details module endpoints',
        include: [item_price_details_module_1.ItemPriceDetailsModule],
    },
    {
        path: 'item-reorders',
        title: 'Item Reorders API',
        description: 'Item reorders module endpoints',
        include: [items_reorder_master_module_1.ItemsReorderMasterModule],
    },
    {
        path: 'item-qty-prices',
        title: 'Item Qty Prices API',
        description: 'Item qty prices module endpoints',
        include: [items_qty_price_master_module_1.ItemsQtyPriceMasterModule],
    },
    {
        path: 'item-tax-histories',
        title: 'Item Tax History API',
        description: 'Item tax history module endpoints',
        include: [items_tax_history_master_module_1.ItemsTaxHistoryMasterModule],
    },
    {
        path: 'items',
        title: 'Items API',
        description: 'Items module endpoints',
        include: [items_master_module_1.ItemsMasterModule],
    },
    {
        path: 'accounts-group',
        title: 'Account Group API',
        description: 'Account group module endpoints',
        include: [acc_group_master_module_1.AccGroupMasterModule],
    },
    {
        path: 'account-ledger-masters',
        title: 'Account Ledger Masters API',
        description: 'Account ledger masters module endpoints',
        include: [account_ledger_masters_module_1.AccountLedgerMastersModule],
    },
    {
        path: 'ledger-bank-accounts',
        title: 'Ledger Bank Accounts API',
        description: 'Ledger bank accounts module endpoints',
        include: [ledger_bank_account_module_1.LedgerBankAccountModule],
    },
    {
        path: 'ledger-shipping-addresses',
        title: 'Ledger Shipping Addresses API',
        description: 'Ledger shipping address module endpoints',
        include: [ledger_shipping_address_module_1.LedgerShippingAddressModule],
    },
    {
        path: 'branch-master',
        title: 'Branch Master API',
        description: 'Branch master module endpoints',
        include: [branch_master_module_1.BranchMasterModule],
    },
    {
        path: 'company-master',
        title: 'Company Master API',
        description: 'Company master module endpoints',
        include: [company_master_module_1.CompanyMasterModule],
    },
    {
        path: 'company-group-master',
        title: 'Company Group Master API',
        description: 'Company group master module endpoints',
        include: [company_group_master_module_1.CompanyGroupMasterModule],
    },
    {
        path: 'employee-department-master',
        title: 'Employee Department Master API',
        description: 'Employee department master module endpoints',
        include: [employee_department_master_module_1.EmployeeDepartmentMasterModule],
    },
    {
        path: 'employee-designation-master',
        title: 'Employee Designation Master API',
        description: 'Employee designation master module endpoints',
        include: [employee_designation_master_module_1.EmployeeDesignationMasterModule],
    },
    {
        path: 'employee-masters',
        title: 'Employee Master API',
        description: 'Employee master module endpoints',
        include: [employee_master_module_1.EmployeeMasterModule],
    },
    {
        path: 'user-administration',
        title: 'User Administration API',
        description: 'User administration module endpoints — manages UserMaster and UserMenus in a single call',
        include: [user_administration_module_1.UserAdministrationModule],
    },
    {
        path: 'configs',
        title: 'Configs API',
        description: 'Configs module endpoints',
        include: [configs_module_1.ConfigsModule],
    },
    {
        path: 'app-settings',
        title: 'App Settings API',
        description: 'Setting overrides (app_setting_value) and the GLOBAL < COMPANY < BRANCH < DEVICE < USER ' +
            'resolver. The catalog (app_setting_def) is maintained in SQL and has no endpoints',
        include: [app_settings_module_1.AppSettingsModule],
    },
    {
        path: 'print-template-assignments',
        title: 'Print Template Assignments API',
        description: 'Which print design wins, and where. One row IS one choice \u2014 there is no is_default ' +
            'flag \u2014 so changing the design for a scope is an update of a single row. Resolution ' +
            'walks narrowest first: counter, then branch, then company, then the every-company ' +
            'default a shipped design may hold',
        include: [print_template_assignment_module_1.PrintTemplateAssignmentModule],
    },
    {
        path: 'print-template',
        title: 'Print Template API',
        description: 'Print template endpoints. One payload carries the design whole — the template, its ' +
            "versions array, and each version's nested datasets array — because a dataset hangs off " +
            'the VERSION, not the template. A published version is never updated: revisions are ' +
            "appended, and publishing moves the template's published pointer",
        include: [print_template_module_1.PrintTemplateModule],
    },
    {
        path: 'print-render',
        title: 'Print Render API',
        description: 'Print render endpoints: preview resolves a template against live data and returns the ' +
            'rendered output, print sends it to a configured provider, and providers lists the ' +
            'output targets available to the caller',
        include: [print_render_module_1.PrintRenderModule],
    },
    {
        path: 'tender-master',
        title: 'Tender Master API',
        description: 'Tender master module endpoints',
        include: [tender_master_module_1.TenderMasterModule],
    },
    {
        path: 'tender-type-masters',
        title: 'Tender Type Master API',
        description: 'Tender type master module endpoints',
        include: [tender_type_master_module_1.TenderTypeMasterModule],
    },
    {
        path: 'tender-details',
        title: 'Tender Detail API',
        description: 'Per-document tender lines (acc_tender_detail) endpoints',
        include: [tender_detail_module_1.TenderDetailModule],
    },
    {
        path: 'transactions',
        title: 'Transaction API',
        description: 'Settlement reads over acc_bill_balance — the unspent credits (ADVANCE / SALES_RETURN) a ' +
            'party holds, which the adjustment panel offers and acc_bill_adjustment is posted from',
        include: [transaction_module_1.TransactionModule],
    },
    {
        path: 'sequences',
        title: 'Sequence API',
        description: 'Sequence module endpoints',
        include: [sequence_module_1.SequenceModule],
    },
    {
        path: 'gsp-provider-masters',
        title: 'GSP Provider Master API',
        description: 'GSP provider master module endpoints',
        include: [gsp_provider_master_module_1.GspProviderMasterModule],
    },
    {
        path: 'gsp-company-services',
        title: 'GSP Company Service API',
        description: 'GSP company service module endpoints',
        include: [gsp_company_service_module_1.GspCompanyServiceModule],
    },
    {
        path: 'items-ean-code-master',
        title: 'Item EAN Code API',
        description: 'Item EAN code module endpoints',
        include: [items_ean_code_master_module_1.ItemsEanCodeMasterModule],
    },
    {
        path: 'items-gst-units-master',
        title: 'Item GST Units API',
        description: 'Item GST units module endpoints',
        include: [items_gst_units_master_module_1.ItemsGstUnitsMasterModule],
    },
    {
        path: 'godowns-master',
        title: 'Godowns API',
        description: 'Godowns module endpoints',
        include: [godowns_master_module_1.GodownsMasterModule],
    },
    {
        path: 'item-stock-balance',
        title: 'Item Stock Balance API',
        description: 'Item stock balance lookup endpoints',
        include: [itemStockBalanceModule_1.ItemStockBalanceModule],
    },
    {
        path: 'item-batch-stock',
        title: 'Item Batch Stock API',
        description: 'Item batch stock lookup endpoints',
        include: [itemBatchStockModule_1.ItemBatchStockModule],
    },
    {
        path: 'physical-stock',
        title: 'Physical Stock API',
        description: 'Physical stock (stock take) document endpoints: create/update by ps_id presence, ' +
            'list and fetch by ps_id or header id, and soft delete',
        include: [physical_stock_module_1.PhysicalStockModule],
    },
    {
        path: 'promotion-loyalty-points',
        title: 'Promotion Loyalty Points API',
        description: 'Single-call loyalty scheme endpoints with nested parties, points, and gifts',
        include: [promotion_loyalty_points_module_1.PromotionLoyaltyPointsModule],
    },
    {
        path: 'promotion-scheme',
        title: 'Promotion Scheme API',
        description: 'Promotion scheme header endpoints plus the branch, party, item and slab scope grids saved ' +
            'a page of rows at a time',
        include: [promotion_scheme_module_1.PromotionSchemeModule],
    },
    {
        path: 'grid-details',
        title: 'Grid Details API',
        description: 'Grid details module endpoints',
        include: [grid_details_module_1.GridDetailsModule],
    },
    {
        path: 'configured-grid-sql',
        title: 'Configured Grid SQL API',
        description: "Configured grid endpoints: fetch a grid's columns by grid id, and run its stored base " +
            'SQL to return rows plus column styles',
        include: [configured_grid_sql_module_1.ConfiguredGridSqlModule],
    },
    {
        path: 'widget-masters',
        title: 'Widget Master API',
        description: 'Dashboard widget master endpoints: create (single and bulk), fetch, per-user config, ' +
            'visibility toggle, and delete',
        include: [widget_master_module_1.WidgetMasterModule],
    },
    {
        path: 'dropdown-details',
        title: 'Dropdown Details API',
        description: 'Dropdown details module endpoints',
        include: [dropdown_details_module_1.DropdownDetailsModule],
    },
    {
        path: 'master-lookups',
        title: 'Master Lookup API',
        description: 'Centralized id-name lookup endpoints for accounts and master modules',
        include: [master_lookup_module_1.MasterLookupModule],
    },
    {
        path: 'supplier-groups',
        title: 'Supplier Groups API',
        description: 'Supplier groups module endpoints',
        include: [supplier_group_module_1.SupplierGroupModule],
    },
    {
        path: 'suppliers',
        title: 'Suppliers API',
        description: 'Suppliers module endpoints',
        include: [suppliers_module_1.SuppliersModule],
    },
    {
        path: 'areas',
        title: 'Areas API',
        description: 'Areas module endpoints',
        include: [area_module_1.AreaModule],
    },
    {
        path: 'sale-freight-charges',
        title: 'Sale Freight Charges API',
        description: 'Sale freight charges module endpoints',
        include: [sale_freight_charges_module_1.SaleFreightChargeModule],
    },
    {
        path: 'sale-loading-charges',
        title: 'Sale Loading Charges API',
        description: 'Sale loading charges module endpoints',
        include: [sale_loading_charges_module_1.SaleLoadingChargeModule],
    },
    {
        path: 'cities',
        title: 'Cities API',
        description: 'Cities module endpoints',
        include: [city_module_1.CityModule],
    },
    {
        path: 'sale-agents',
        title: 'Sale Agents API',
        description: 'Sale agents module endpoints',
        include: [sale_agent_module_1.SaleAgentModule],
    },
    {
        path: 'states',
        title: 'States API',
        description: 'States module endpoints',
        include: [state_module_1.StateModule],
    },
    {
        path: 'customers',
        title: 'Customers API',
        description: 'Customers module endpoints',
        include: [customer_module_1.CustomerModule],
    },
    {
        path: 'customer-groups',
        title: 'Customer Groups API',
        description: 'Customer groups module endpoints',
        include: [customer_group_module_1.CustomerGroupModule],
    },
    {
        path: 'quotations',
        title: 'Quotations API',
        description: 'Single-call sale quotation endpoints with nested line items',
        include: [quotation_module_1.QuotationModule],
    },
    {
        path: 'bills',
        title: 'Bills API',
        description: 'Single-call sale bill (tax invoice) endpoints with nested line items',
        include: [bill_module_1.BillModule],
    },
    {
        path: 'sale-orders',
        title: 'Sale Orders API',
        description: 'Single-call sale order endpoints with nested line items, applied charges, tendered ' +
            'advances and advance allocations',
        include: [sale_order_module_1.SaleOrderModule],
    },
    {
        path: 'txn-holds',
        title: 'Transaction Hold API',
        description: 'Parked (held) transaction endpoints for public.txn_hold',
        include: [txn_hold_module_1.TxnHoldModule],
    },
    {
        path: 'bank-lists',
        title: 'Bank List API',
        description: 'Bank list module endpoints',
        include: [bank_list_module_1.BankListModule],
    },
    {
        path: 'device-list-masters',
        title: 'Device List Master API',
        description: 'Device list master module endpoints',
        include: [device_list_master_module_1.DeviceListMasterModule],
    },
    {
        path: 'menu-master',
        title: 'Menu Master API',
        description: 'Menu hierarchy endpoints for fixed.menu_master',
        include: [menu_master_module_1.MenuMasterModule],
    },
    {
        path: 'price-level-master',
        title: 'Price Level Master API',
        description: 'Price level endpoints for fixed.price_levels',
        include: [price_level_master_module_1.PriceLevelMasterModule],
    },
    {
        path: 'hsn-code-master',
        title: 'HSN Code Master API',
        description: 'HSN code endpoints for fixed.hsn_master',
        include: [hsn_code_master_module_1.HsnCodeMasterModule],
    },
    {
        path: 'state-code-masters',
        title: 'State Code Master API',
        description: 'State code master module endpoints',
        include: [state_code_master_module_1.StateCodeMasterModule],
    },
    {
        path: 'ui-table-master',
        title: 'UI Table Master API',
        description: 'UI table master and columns endpoints',
        include: [ui_table_master_module_1.UiTableMasterModule],
    },
    {
        path: 'user-login-sessions',
        title: 'User Login Sessions API',
        description: 'User login sessions module endpoints',
        include: [user_login_sessions_module_1.UserLoginSessionsModule],
    },
    {
        path: 'stock-adj-reasons',
        title: 'Stock Adj Reasons API',
        description: 'Stock adjustment reasons endpoints for fixed.stock_adj_reasons',
        include: [stock_adj_reasons_module_1.StockAdjReasonsModule],
    },
    {
        path: 'audit-logs',
        title: 'Audit Log API',
        description: 'Audit log module endpoints',
        include: [audit_log_module_1.AuditLogModule],
    },
];
//# sourceMappingURL=swaggerDocs.js.map