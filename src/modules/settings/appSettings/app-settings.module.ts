import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AppSettingValueController } from './app-setting-value.controller';
import { AppSettingValueService } from './app-setting-value.service';
import { AppSettingsExceptionFilter } from './app-settings-exception.filter';

/**
 * The settings feature: the overrides in `app_setting_value`, and the resolver
 * that reads them back through the catalog.
 *
 * The CATALOG (`app_setting_def`) has no CRUD endpoints on purpose — it is
 * maintained in SQL, which is what "a new setting is an INSERT, not a client
 * release" means in practice. This module still reads it on every write: an
 * override is checked against the setting's data type, allowed values, bounds
 * and asd_max_scope before it is stored.
 */
@Module({
  controllers: [AppSettingValueController],
  imports: [AuditLogModule],
  providers: [AppSettingValueService, AppSettingsExceptionFilter],
  // Exported for the server-side rules that have to ask what a setting comes to
  // before they act (may this bill exceed the order? is this discount allowed?)
  // — `resolveEffective` answers for a caller, rather than each rule rebuilding
  // the five-layer merge.
  exports: [AppSettingValueService],
})
export class AppSettingsModule {}
