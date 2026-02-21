 import { AuditLogModule } from '../src/modules/audit-log/audit-log.module';
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
      path: 'audit-log',
      title: 'Audit Log API',
      description: 'Audit log module endpoints',
      include: [AuditLogModule],
    },
  ];
