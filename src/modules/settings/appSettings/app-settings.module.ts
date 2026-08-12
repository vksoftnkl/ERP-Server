import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AppSettingDefController } from './app-setting-def.controller';
import { AppSettingDefService } from './app-setting-def.service';
import { AppSettingValueController } from './app-setting-value.controller';
import { AppSettingValueService } from './app-setting-value.service';
import { AppSettingsExceptionFilter } from './app-settings-exception.filter';

/**
 * The settings feature: one catalog (`app_setting_def`), its overrides
 * (`app_setting_value`), and the resolver that turns the two into an answer.
 *
 * Two tables, two controllers, one module — they are one feature and every
 * write to either is judged against the other.
 */
@Module({
  controllers: [AppSettingDefController, AppSettingValueController],
  imports: [AuditLogModule],
  providers: [AppSettingDefService, AppSettingValueService, AppSettingsExceptionFilter],
  // AppSettingValueService is exported for the server-side rules that have to
  // ask what a setting resolves to before they act (may this bill exceed the
  // order? is this discount allowed?), rather than each of them rebuilding the
  // five-layer merge.
  exports: [AppSettingValueService],
})
export class AppSettingsModule {}
