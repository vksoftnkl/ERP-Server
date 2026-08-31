import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { SequenceModule } from '../common/Sequence/sequence.module';
import { AccountLedgerMastersModule } from '../modules/accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { AccGroupMasterModule } from '../modules/accountsModule/accGroupMaster/acc-group-master.module';
import { LedgerBankAccountModule } from '../modules/accountsModule/ledgerBankAccount/ledger-bank-account.module';
import { BranchMasterModule } from '../modules/settings/branchMaster/branch-master.module';
import { CompanyGroupMasterModule } from '../modules/accountsModule/companyGroupMaster/company-group-master.module';
import { CompanyMasterModule } from '../modules/settings/companyMaster/company-master.module';
import { EmployeeDepartmentMasterModule } from '../modules/settings/employeeDepartmentMaster/employee-department-master.module';
import { EmployeeDesignationMasterModule } from '../modules/settings/employeeDesignationMaster/employee-designation-master.module';
import { EmployeeMasterModule } from '../modules/settings/employeeMaster/employee-master.module';
import { UserAdministrationModule } from '../modules/settings/userAdministration/user-administration.module';
import { ConfigsModule } from '../modules/settings/configs/configs.module';
import { AppSettingsModule } from '../modules/settings/appSettings/app-settings.module';
import { PrintTemplateAssignmentModule } from '../modules/settings/print-template-assignment/print-template-assignment.module';
import { PrintTemplateModule } from '../modules/settings/print-template/print-template.module';
import { GspCompanyServiceModule } from '../modules/settings/gspCompanyService/gsp-company-service.module';
import { GspProviderMasterModule } from '../modules/accountsModule/gspProviderMaster/gsp-provider-master.module';
import { LedgerShippingAddressModule } from '../modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.module';
import { TenderMasterModule } from '../modules/accountsModule/tenderMaster/tender-master.module';
import { TenderTypeMasterModule } from '../modules/accountsModule/tenderTypeMaster/tender-type-master.module';
import { TenderDetailModule } from '../modules/accountsModule/tenderDetail/tender-detail.module';
import { TransactionModule } from '../modules/accountsModule/transaction/transaction.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AreaModule } from '../modules/sales/area/area.module';
import { SaleFreightChargeModule } from '../modules/sales/sale-freight-charges/sale-freight-charges.module';
import { SaleLoadingChargeModule } from '../modules/sales/sale-loading-charges/sale-loading-charges.module';
import { CityModule } from '../modules/sales/city/city.module';
import { SaleAgentModule } from '../modules/sales/sale-agent/sale-agent.module';
import { CustomerGroupModule } from '../modules/sales/customer-group/customer-group.module';
import { CustomerModule } from '../modules/sales/customer/customer.module';
import { QuotationModule } from '../modules/sales/quotation/quotation.module';
import { BillModule } from '../modules/sales/bill/bill.module';
import { SaleOrderModule } from '../modules/sales/sale-order/sale-order.module';
import { TxnHoldModule } from '../modules/sales/txn-hold/txn-hold.module';
import { GridDetailsModule } from '../modules/grid-details/grid-details.module';
import { DropdownDetailsModule } from '../modules/dropdown-details/dropdown-details.module';
import { HealthModule } from '../modules/health/health.module';
import { ItemsCustRatesMasterModule } from '../modules/items-cust-rates-master/items-cust-rates-master.module';
import { ItemPriceDetailsModule } from '../modules/Inventory/item-price-details/item-price-details.module';
import { UsersModule } from '../modules/users/users.module';
import { MasterLookupModule } from '../modules/master-lookup/master-lookup.module';
import { BatchPrefixModule } from '../modules/master/batch-prefix/batch-prefix.module';
import { ChargeMasterModule } from '../modules/master/charge-master/charge-master.module';
import { ChargeDetailModule } from '../modules/master/charge-detail/charge-detail.module';
import { SupplierGroupModule } from '../modules/purchase/supplier-group/supplier-group.module';
import { SuppliersModule } from '../modules/purchase/suppliers/suppliers.module';
import { StateModule } from '../modules/sales/state/state.module';
import { BankListModule } from '../modules/fixed/bank-list/bank-list.module';
import { DeviceListMasterModule } from '../modules/fixed/device-list-master/device-list-master.module';
import { MenuMasterModule } from '../modules/fixed/menu-master/menu-master.module';
import { PriceLevelMasterModule } from '../modules/fixed/price-level-master/price-level-master.module';
import { HsnCodeMasterModule } from '../modules/fixed/hsn-code-master/hsn-code-master.module';
import { StateCodeMasterModule } from '../modules/fixed/state-code-master/state-code-master.module';
import { UiTableMasterModule } from '../modules/fixed/ui-table-master/ui-table-master.module';
import { UserLoginSessionsModule } from '../modules/fixed/user-login-sessions/user-login-sessions.module';
import { StockAdjReasonsModule } from '../modules/fixed/stock-adj-reasons/stock-adj-reasons.module';
import { PromotionLoyaltyPointsModule } from '../modules/sales/loyalty/promotion-loyalty-points.module';
import { PromotionSchemeModule } from '../modules/sales/promotion-scheme/promotion-scheme.module';
import { ItemsGroupMasterModule } from 'src/modules/Inventory/items-group-master/items-group-master.module';
import { ItemsBrandMasterModule } from 'src/modules/Inventory/items-brand-master/items-brand-master.module';
import { ItemsSectionMasterModule } from 'src/modules/Inventory/items-section-master/items-section-master.module';
import { ItemsCategoryMasterModule } from 'src/modules/Inventory/items-category-master/items-category-master.module';
import { UnitsMasterModule } from 'src/modules/Inventory/units-master/units-master.module';
import { ItemsTaxMasterModule } from 'src/modules/Inventory/items-tax-master/items-tax-master.module';
import { ItemsPriceMasterModule } from 'src/modules/Inventory/items-price-master/items-price-master.module';
import { ItemUnitConversionModule } from 'src/modules/Inventory/item-unit-conversion/item-unit-conversion.module';
import { ItemsReorderMasterModule } from 'src/modules/Inventory/items-reorder-master/items-reorder-master.module';
import { ItemsQtyPriceMasterModule } from 'src/modules/Inventory/items-qty-price-master/items-qty-price-master.module';
import { ItemsTaxHistoryMasterModule } from 'src/modules/Inventory/items-tax-history-master/items-tax-history-master.module';
import { ItemsMasterModule } from 'src/modules/Inventory/items-master/items-master.module';
import { ItemsEanCodeMasterModule } from 'src/modules/Inventory/items-ean-code-master/items-ean-code-master.module';
import { ItemsGstUnitsMasterModule } from 'src/modules/Inventory/items-gst-units-master/items-gst-units-master.module';
import { GodownsMasterModule } from 'src/modules/Inventory/godowns-master/godowns-master.module';
// import { OpeningStockModule } from 'src/modules/stocks/opening-stock/opening-stock.module';
import { ItemStockBalanceModule } from 'src/modules/stocks/itemstockbalance/itemStockBalanceModule';
import { ItemBatchStockModule } from 'src/modules/stocks/itembatchstock/itemBatchStockModule';
import { PhysicalStockModule } from 'src/modules/stocks/physical-stock/physical-stock.module';
import { PrintRenderModule } from 'src/modules/settings/print-render/print-render.module';
import { WidgetMasterModule } from 'src/modules/master/widget-master/widget-master.module';
import { ConfiguredGridSqlModule } from 'src/common/configured-grid-sql/configured-grid-sql.module';
export const swaggerModuleDocuments = [
  {
    path: 'auth',
    title: 'Auth API',
    description: 'Auth module endpoints',
    include: [AuthModule],
  },
  {
    path: 'health',
    title: 'Health API',
    description: 'Health module endpoints',
    include: [HealthModule],
  },
  {
    path: 'users',
    title: 'Users API',
    description: 'Users module endpoints',
    include: [UsersModule],
  },
  {
    path: 'batch-prefixes',
    title: 'Batch Prefix API',
    description: 'Batch prefix module endpoints',
    include: [BatchPrefixModule],
  },
  {
    path: 'charges',
    title: 'Charge Master API',
    description: 'Charge master (shared sales/purchase additional charges) endpoints',
    include: [ChargeMasterModule],
  },
  {
    path: 'charge-details',
    title: 'Charge Detail API',
    description: 'Per-document applied charge lines (txn_charge_detail) endpoints',
    include: [ChargeDetailModule],
  },
  {
    path: 'items-group-master',
    title: 'Item Group API',
    description: 'Item group module endpoints',
    include: [ItemsGroupMasterModule],
  },
  {
    path: 'items-brand-master',
    title: 'Item Brand API',
    description: 'Item brand module endpoints',
    include: [ItemsBrandMasterModule],
  },
  {
    path: 'items-section-master',
    title: 'Item Section API',
    description: 'Item section module endpoints',
    include: [ItemsSectionMasterModule],
  },
  {
    path: 'items-category-master',
    title: 'Item Category API',
    description: 'Item category module endpoints',
    include: [ItemsCategoryMasterModule],
  },
  {
    path: 'units-master',
    title: 'Units API',
    description: 'Units module endpoints',
    include: [UnitsMasterModule],
  },
  {
    path: 'items-tax-master',
    title: 'Item Tax API',
    description: 'Item tax module endpoints',
    include: [ItemsTaxMasterModule],
  },
  {
    path: 'item-cust-rates',
    title: 'Item Customer Rates API',
    description: 'Item customer rates module endpoints',
    include: [ItemsCustRatesMasterModule],
  },
  {
    path: 'item-prices',
    title: 'Item Prices API',
    description: 'Item prices module endpoints',
    include: [ItemsPriceMasterModule],
  },
  {
    path: 'item-unit-conversions',
    title: 'Item Unit Conversions API',
    description: 'Item unit conversion module endpoints',
    include: [ItemUnitConversionModule],
  },
  {
    path: 'item-price-details',
    title: 'Item Price Details API',
    description: 'Item price details module endpoints',
    include: [ItemPriceDetailsModule],
  },
  {
    path: 'item-reorders',
    title: 'Item Reorders API',
    description: 'Item reorders module endpoints',
    include: [ItemsReorderMasterModule],
  },
  {
    path: 'item-qty-prices',
    title: 'Item Qty Prices API',
    description: 'Item qty prices module endpoints',
    include: [ItemsQtyPriceMasterModule],
  },
  {
    path: 'item-tax-histories',
    title: 'Item Tax History API',
    description: 'Item tax history module endpoints',
    include: [ItemsTaxHistoryMasterModule],
  },
  {
    path: 'items',
    title: 'Items API',
    description: 'Items module endpoints',
    include: [ItemsMasterModule],
  },
  {
    path: 'accounts-group',
    title: 'Account Group API',
    description: 'Account group module endpoints',
    include: [AccGroupMasterModule],
  },
  {
    path: 'account-ledger-masters',
    title: 'Account Ledger Masters API',
    description: 'Account ledger masters module endpoints',
    include: [AccountLedgerMastersModule],
  },
  {
    path: 'ledger-bank-accounts',
    title: 'Ledger Bank Accounts API',
    description: 'Ledger bank accounts module endpoints',
    include: [LedgerBankAccountModule],
  },
  {
    path: 'ledger-shipping-addresses',
    title: 'Ledger Shipping Addresses API',
    description: 'Ledger shipping address module endpoints',
    include: [LedgerShippingAddressModule],
  },
  {
    path: 'branch-master',
    title: 'Branch Master API',
    description: 'Branch master module endpoints',
    include: [BranchMasterModule],
  },
  {
    path: 'company-master',
    title: 'Company Master API',
    description: 'Company master module endpoints',
    include: [CompanyMasterModule],
  },
  {
    path: 'company-group-master',
    title: 'Company Group Master API',
    description: 'Company group master module endpoints',
    include: [CompanyGroupMasterModule],
  },
  {
    path: 'employee-department-master',
    title: 'Employee Department Master API',
    description: 'Employee department master module endpoints',
    include: [EmployeeDepartmentMasterModule],
  },
  {
    path: 'employee-designation-master',
    title: 'Employee Designation Master API',
    description: 'Employee designation master module endpoints',
    include: [EmployeeDesignationMasterModule],
  },
  {
    path: 'employee-masters',
    title: 'Employee Master API',
    description: 'Employee master module endpoints',
    include: [EmployeeMasterModule],
  },
  {
    path: 'user-administration',
    title: 'User Administration API',
    description:
      'User administration module endpoints — manages UserMaster and UserMenus in a single call',
    include: [UserAdministrationModule],
  },
  {
    path: 'configs',
    title: 'Configs API',
    description: 'Configs module endpoints',
    include: [ConfigsModule],
  },
  {
    path: 'app-settings',
    title: 'App Settings API',
    description:
      'Setting overrides (app_setting_value) and the GLOBAL < COMPANY < BRANCH < DEVICE < USER ' +
      'resolver. The catalog (app_setting_def) is maintained in SQL and has no endpoints',
    include: [AppSettingsModule],
  },
  {
    path: 'print-template-assignments',
    title: 'Print Template Assignments API',
    description:
      'Which print design wins, and where. One row IS one choice \u2014 there is no is_default ' +
      'flag \u2014 so changing the design for a scope is an update of a single row. Resolution ' +
      'walks narrowest first: counter, then branch, then company, then the every-company ' +
      'default a shipped design may hold',
    include: [PrintTemplateAssignmentModule],
  },
  {
    path: 'print-template',
    title: 'Print Template API',
    description:
      'Print template endpoints. One payload carries the design whole — the template, its ' +
      "versions array, and each version's nested datasets array — because a dataset hangs off " +
      'the VERSION, not the template. A published version is never updated: revisions are ' +
      "appended, and publishing moves the template's published pointer",
    include: [PrintTemplateModule],
  },
  {
    path: 'print-render',
    title: 'Print Render API',
    description:
      'Print render endpoints: preview resolves a template against live data and returns the ' +
      'rendered output, print sends it to a configured provider, and providers lists the ' +
      'output targets available to the caller',
    include: [PrintRenderModule],
  },
  {
    path: 'tender-master',
    title: 'Tender Master API',
    description: 'Tender master module endpoints',
    include: [TenderMasterModule],
  },
  {
    path: 'tender-type-masters',
    title: 'Tender Type Master API',
    description: 'Tender type master module endpoints',
    include: [TenderTypeMasterModule],
  },
  {
    path: 'tender-details',
    title: 'Tender Detail API',
    description: 'Per-document tender lines (acc_tender_detail) endpoints',
    include: [TenderDetailModule],
  },
  {
    path: 'transactions',
    title: 'Transaction API',
    description:
      'Settlement reads over acc_bill_balance — the unspent credits (ADVANCE / SALES_RETURN) a ' +
      'party holds, which the adjustment panel offers and acc_bill_adjustment is posted from',
    include: [TransactionModule],
  },
  {
    path: 'sequences',
    title: 'Sequence API',
    description: 'Sequence module endpoints',
    include: [SequenceModule],
  },
  {
    path: 'gsp-provider-masters',
    title: 'GSP Provider Master API',
    description: 'GSP provider master module endpoints',
    include: [GspProviderMasterModule],
  },
  {
    path: 'gsp-company-services',
    title: 'GSP Company Service API',
    description: 'GSP company service module endpoints',
    include: [GspCompanyServiceModule],
  },
  {
    path: 'items-ean-code-master',
    title: 'Item EAN Code API',
    description: 'Item EAN code module endpoints',
    include: [ItemsEanCodeMasterModule],
  },
  {
    path: 'items-gst-units-master',
    title: 'Item GST Units API',
    description: 'Item GST units module endpoints',
    include: [ItemsGstUnitsMasterModule],
  },
  {
    path: 'godowns-master',
    title: 'Godowns API',
    description: 'Godowns module endpoints',
    include: [GodownsMasterModule],
  },
  // OpeningStockModule is not registered in AppModule, so it has no routes to document.
  // Re-enable this entry together with the AppModule import; leaving it here without an
  // `include` makes SwaggerModule fall back to every controller in the app.
  // {
  //   path: 'opening-stocks',
  //   title: 'Opening Stock API',
  //   description: 'Opening stock module endpoints',
  //   include: [OpeningStockModule],
  // },
  {
    path: 'item-stock-balance',
    title: 'Item Stock Balance API',
    description: 'Item stock balance lookup endpoints',
    include: [ItemStockBalanceModule],
  },
  {
    path: 'item-batch-stock',
    title: 'Item Batch Stock API',
    description: 'Item batch stock lookup endpoints',
    include: [ItemBatchStockModule],
  },
  {
    path: 'physical-stock',
    title: 'Physical Stock API',
    description:
      'Physical stock (stock take) document endpoints: create/update by ps_id presence, ' +
      'list and fetch by ps_id or header id, and soft delete',
    include: [PhysicalStockModule],
  },
  {
    path: 'promotion-loyalty-points',
    title: 'Promotion Loyalty Points API',
    description:
      'Single-call loyalty scheme endpoints with nested branches, parties, items, earn slabs ' +
      'and gifts',
    include: [PromotionLoyaltyPointsModule],
  },
  {
    path: 'promotion-scheme',
    title: 'Promotion Scheme API',
    description:
      'Promotion scheme header endpoints plus the branch, party, item and slab scope grids saved ' +
      'a page of rows at a time',
    include: [PromotionSchemeModule],
  },
  {
    path: 'grid-details',
    title: 'Grid Details API',
    description: 'Grid details module endpoints',
    include: [GridDetailsModule],
  },
  {
    path: 'configured-grid-sql',
    title: 'Configured Grid SQL API',
    description:
      "Configured grid endpoints: fetch a grid's columns by grid id, and run its stored base " +
      'SQL to return rows plus column styles',
    include: [ConfiguredGridSqlModule],
  },
  {
    path: 'widget-masters',
    title: 'Widget Master API',
    description:
      'Dashboard widget master endpoints: create (single and bulk), fetch, per-user config, ' +
      'visibility toggle, and delete',
    include: [WidgetMasterModule],
  },
  {
    path: 'dropdown-details',
    title: 'Dropdown Details API',
    description: 'Dropdown details module endpoints',
    include: [DropdownDetailsModule],
  },
  {
    path: 'master-lookups',
    title: 'Master Lookup API',
    description: 'Centralized id-name lookup endpoints for accounts and master modules',
    include: [MasterLookupModule],
  },
  {
    path: 'supplier-groups',
    title: 'Supplier Groups API',
    description: 'Supplier groups module endpoints',
    include: [SupplierGroupModule],
  },
  {
    path: 'suppliers',
    title: 'Suppliers API',
    description: 'Suppliers module endpoints',
    include: [SuppliersModule],
  },
  {
    path: 'areas',
    title: 'Areas API',
    description: 'Areas module endpoints',
    include: [AreaModule],
  },
  {
    path: 'sale-freight-charges',
    title: 'Sale Freight Charges API',
    description: 'Sale freight charges module endpoints',
    include: [SaleFreightChargeModule],
  },
  {
    path: 'sale-loading-charges',
    title: 'Sale Loading Charges API',
    description: 'Sale loading charges module endpoints',
    include: [SaleLoadingChargeModule],
  },
  {
    path: 'cities',
    title: 'Cities API',
    description: 'Cities module endpoints',
    include: [CityModule],
  },
  {
    path: 'sale-agents',
    title: 'Sale Agents API',
    description: 'Sale agents module endpoints',
    include: [SaleAgentModule],
  },
  {
    path: 'states',
    title: 'States API',
    description: 'States module endpoints',
    include: [StateModule],
  },
  {
    path: 'customers',
    title: 'Customers API',
    description: 'Customers module endpoints',
    include: [CustomerModule],
  },
  {
    path: 'customer-groups',
    title: 'Customer Groups API',
    description: 'Customer groups module endpoints',
    include: [CustomerGroupModule],
  },
  {
    path: 'quotations',
    title: 'Quotations API',
    description: 'Single-call sale quotation endpoints with nested line items',
    include: [QuotationModule],
  },
  {
    path: 'bills',
    title: 'Bills API',
    description: 'Single-call sale bill (tax invoice) endpoints with nested line items',
    include: [BillModule],
  },
  {
    path: 'sale-orders',
    title: 'Sale Orders API',
    description:
      'Single-call sale order endpoints with nested line items, applied charges, tendered ' +
      'advances and advance allocations',
    include: [SaleOrderModule],
  },
  {
    path: 'txn-holds',
    title: 'Transaction Hold API',
    description: 'Parked (held) transaction endpoints for public.txn_hold',
    include: [TxnHoldModule],
  },
  {
    path: 'bank-lists',
    title: 'Bank List API',
    description: 'Bank list module endpoints',
    include: [BankListModule],
  },
  {
    path: 'device-list-masters',
    title: 'Device List Master API',
    description: 'Device list master module endpoints',
    include: [DeviceListMasterModule],
  },
  {
    path: 'menu-master',
    title: 'Menu Master API',
    description: 'Menu hierarchy endpoints for fixed.menu_master',
    include: [MenuMasterModule],
  },
  {
    path: 'price-level-master',
    title: 'Price Level Master API',
    description: 'Price level endpoints for fixed.price_levels',
    include: [PriceLevelMasterModule],
  },
  {
    path: 'hsn-code-master',
    title: 'HSN Code Master API',
    description: 'HSN code endpoints for fixed.hsn_master',
    include: [HsnCodeMasterModule],
  },
  {
    path: 'state-code-masters',
    title: 'State Code Master API',
    description: 'State code master module endpoints',
    include: [StateCodeMasterModule],
  },
  {
    path: 'ui-table-master',
    title: 'UI Table Master API',
    description: 'UI table master and columns endpoints',
    include: [UiTableMasterModule],
  },
  {
    path: 'user-login-sessions',
    title: 'User Login Sessions API',
    description: 'User login sessions module endpoints',
    include: [UserLoginSessionsModule],
  },
  {
    path: 'stock-adj-reasons',
    title: 'Stock Adj Reasons API',
    description: 'Stock adjustment reasons endpoints for fixed.stock_adj_reasons',
    include: [StockAdjReasonsModule],
  },
  {
    path: 'audit-logs',
    title: 'Audit Log API',
    description: 'Audit log module endpoints',
    include: [AuditLogModule],
  },
];
