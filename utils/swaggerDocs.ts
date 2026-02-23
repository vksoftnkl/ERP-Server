import { AuditLogModule } from '../src/modules/audit-log/audit-log.module';
import { AccountLedgerMastersModule } from '../src/modules/accountsModule/accountLedgerMasters/account-ledger-masters.module';
import { AccountsGroupModule } from '../src/modules/accountsModule/accountsGroup/accounts-group.module';
import { BranchMasterModule } from '../src/modules/accountsModule/branchMaster/branch-master.module';
import { CompanyGroupMasterModule } from '../src/modules/accountsModule/companyGroupMaster/company-group-master.module';
import { CompanyMasterModule } from '../src/modules/accountsModule/companyMaster/company-master.module';
import { EmployeeDesignationMasterModule } from '../src/modules/accountsModule/employeeDesignationMaster/employee-designation-master.module';
import { TenderMasterModule } from '../src/modules/accountsModule/tenderMaster/tender-master.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { GridColumnsModule } from '../src/modules/grid-columns/grid-columns.module';
import { GridDetailsModule } from '../src/modules/grid-details/grid-details.module';
import { GodownsMasterModule } from '../src/modules/godowns-master/godowns-master.module';
import { HealthModule } from '../src/modules/health/health.module';
import { ItemsBrandMasterModule } from '../src/modules/items-brand-master/items-brand-master.module';
import { ItemsCategoryMasterModule } from '../src/modules/items-category-master/items-category-master.module';
import { ItemsEanCodeMasterModule } from '../src/modules/items-ean-code-master/items-ean-code-master.module';
import { ItemsGroupMasterModule } from '../src/modules/items-group-master/items-group-master.module';
import { ItemsSectionMasterModule } from '../src/modules/items-section-master/items-section-master.module';
import { ItemsTaxMasterModule } from '../src/modules/items-tax-master/items-tax-master.module';
import { UnitsMasterModule } from '../src/modules/units-master/units-master.module';
import { UsersModule } from '../src/modules/users/users.module';
import { MasterLookupModule } from '../src/modules/master-lookup/master-lookup.module';
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
      path: 'employee-designation-master',
      title: 'Employee Designation Master API',
      description: 'Employee designation master module endpoints',
      include: [EmployeeDesignationMasterModule],
    },
    {
      path: 'tender-master',
      title: 'Tender Master API',
      description: 'Tender master module endpoints',
      include: [TenderMasterModule],
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
      path: 'master-lookups',
      title: 'Master Lookup API',
      description: 'Centralized id-name lookup endpoints for accounts and master modules',
      include: [MasterLookupModule],
    },
    {
      path: 'audit-log',
      title: 'Audit Log API',
      description: 'Audit log module endpoints',
      include: [AuditLogModule],
    },
  ];
