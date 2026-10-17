import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AppThemeController } from './app-theme.controller';
import { AppThemeExceptionFilter } from './app-theme-exception.filter';
import { AppThemeService } from './app-theme.service';

/** Company themes — theme/plan-app-theme.md §3. */
@Module({
  imports: [AuditLogModule],
  controllers: [AppThemeController],
  providers: [AppThemeService, AppThemeExceptionFilter],
  exports: [AppThemeService],
})
export class AppThemeModule {}
