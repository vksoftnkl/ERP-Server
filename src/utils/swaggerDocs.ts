import { AuditLogModule } from '../modules/audit-log/audit-log.module';
import { AccountLedgerMastersModule } from '../modules/accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { AccountsGroupModule } from '../modules/accountsModule/accountsGroup/accounts-group.module';
import { LedgerBankAccountModule } from '../modules/accountsModule/ledgerBankAccount/ledger-bank-account.module';
import { BranchMasterModule } from '../modules/accountsModule/branchMaster/branch-master.module';
import { CompanyGroupMasterModule } from '../modules/accountsModule/companyGroupMaster/company-group-master.module';
import { CompanyMasterModule } from '../modules/accountsModule/companyMaster/company-master.module';
import { EmployeeDepartmentMasterModule } from '../modules/accountsModule/employeeDepartmentMaster/employee-department-master.module';
import { EmployeeDesignationMasterModule } from '../modules/accountsModule/employeeDesignationMaster/employee-designation-master.module';
import { EmployeeMasterModule } from '../modules/accountsModule/employeeMaster/employee-master.module';
import { GspCompanyServiceModule } from '../modules/accountsModule/gspCompanyService/gsp-company-service.module';
import { GspProviderMasterModule } from '../modules/accountsModule/gspProviderMaster/gsp-provider-master.module';
import { LedgerShippingAddressModule } from '../modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.module';
import { TenderMasterModule } from '../modules/accountsModule/tenderMaster/tender-master.module';
import { TenderTypeMasterModule } from '../modules/accountsModule/tenderTypeMaster/tender-type-master.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AreaModule } from '../modules/sales/area/area.module';
import { CityModule } from '../modules/sales/city/city.module';
import { CustomerGroupModule } from '../modules/sales/customer-group/customer-group.module';
import { CustomerModule } from '../modules/sales/customer/customer.module';
import { GridColumnsModule } from '../modules/grid-columns/grid-columns.module';
import { GridDetailsModule } from '../modules/grid-details/grid-details.module';
import { DropdownDetailsModule } from '../modules/dropdown-details/dropdown-details.module';
import { DropdownColumnsModule } from '../modules/dropdown-columns/dropdown-columns.module';
import { GodownsMasterModule } from '../modules/godowns-master/godowns-master.module';
import { HealthModule } from '../modules/health/health.module';
import { ItemsBrandMasterModule } from '../modules/items-brand-master/items-brand-master.module';
import { ItemsCategoryMasterModule } from '../modules/items-category-master/items-category-master.module';
import { ItemsCustRatesMasterModule } from '../modules/items-cust-rates-master/items-cust-rates-master.module';
import { ItemsEanCodeMasterModule } from '../modules/items-ean-code-master/items-ean-code-master.module';
import { ItemsGroupMasterModule } from '../modules/items-group-master/items-group-master.module';
import { ItemsMasterModule } from '../modules/items-master/items-master.module';
import { ItemsPriceMasterModule } from '../modules/items-price-master/items-price-master.module';
import { ItemsQtywiseRatesMasterModule } from '../modules/items-qtywise-rates-master/items-qtywise-rates-master.module';
import { ItemsReorderMasterModule } from '../modules/items-reorder-master/items-reorder-master.module';
import { ItemsSectionMasterModule } from '../modules/items-section-master/items-section-master.module';
import { ItemsTaxHistoryMasterModule } from '../modules/items-tax-history-master/items-tax-history-master.module';
import { ItemsTaxMasterModule } from '../modules/items-tax-master/items-tax-master.module';
import { UnitsMasterModule } from '../modules/units-master/units-master.module';
import { UsersModule } from '../modules/users/users.module';
import { MasterLookupModule } from '../modules/master-lookup/master-lookup.module';
import { SupplierGroupModule } from '../modules/purchase/supplier-group/supplier-group.module';
import { SuppliersModule } from '../modules/purchase/suppliers/suppliers.module';
import { StateModule } from '../modules/sales/state/state.module';
import { BankListModule } from '../modules/fixed/bank-list/bank-list.module';
import { DeviceListMasterModule } from '../modules/fixed/device-list-master/device-list-master.module';
import { MenuMasterModule } from '../modules/fixed/menu-master/menu-master.module';
import { PriceLevelMasterModule } from '../modules/fixed/price-level-master/price-level-master.module';
import { HsnCodeMasterModule } from '../modules/fixed/hsn-code-master/hsn-code-master.module';
import { StateCodeMasterModule } from '../modules/fixed/state-code-master/state-code-master.module';
import { UiTableColumnsModule } from '../modules/fixed/ui-table-columns/ui-table-columns.module';
import { UiTableMasterModule } from '../modules/fixed/ui-table-master/ui-table-master.module';
import { UserLoginSessionsModule } from '../modules/fixed/user-login-sessions/user-login-sessions.module';
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
    path: 'item-qtywise-rates',
    title: 'Item Qtywise Rates API',
    description: 'Item qtywise rates module endpoints',
    include: [ItemsQtywiseRatesMasterModule],
  },
  {
    path: 'item-reorders',
    title: 'Item Reorders API',
    description: 'Item reorders module endpoints',
    include: [ItemsReorderMasterModule],
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
    include: [AccountsGroupModule],
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
    path: 'godowns-master',
    title: 'Godowns API',
    description: 'Godowns module endpoints',
    include: [GodownsMasterModule],
  },
  {
    path: 'grid-details',
    title: 'Grid Details API',
    description: 'Grid details module endpoints',
    include: [GridDetailsModule],
  },
  {
    path: 'grid-columns',
    title: 'Grid Columns API',
    description: 'Grid columns module endpoints',
    include: [GridColumnsModule],
  },
  {
    path: 'dropdown-details',
    title: 'Dropdown Details API',
    description: 'Dropdown details module endpoints',
    include: [DropdownDetailsModule],
  },
  {
    path: 'dropdown-columns',
    title: 'Dropdown Columns API',
    description: 'Dropdown columns module endpoints',
    include: [DropdownColumnsModule],
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
    path: 'cities',
    title: 'Cities API',
    description: 'Cities module endpoints',
    include: [CityModule],
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
    path: 'ui-table-columns',
    title: 'UI Table Columns API',
    description: 'UI table columns module endpoints',
    include: [UiTableColumnsModule],
  },
  {
    path: 'ui-table-master',
    title: 'UI Table Master API',
    description: 'UI table endpoints for fixed.ui_tables',
    include: [UiTableMasterModule],
  },
  {
    path: 'user-login-sessions',
    title: 'User Login Sessions API',
    description: 'User login sessions module endpoints',
    include: [UserLoginSessionsModule],
  },
  {
    path: 'audit-log',
    title: 'Audit Log API',
    description: 'Audit log module endpoints',
    include: [AuditLogModule],
  },
];
