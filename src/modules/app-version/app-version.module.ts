import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppVersionController } from './app-version.controller';
import { OpsKeyGuard } from './guards/ops-key.guard';
import { AppUpdateService } from './services/app-update.service';
import { ClientInstallationService } from './services/client-installation.service';
import { ClientTrackingService } from './services/client-tracking.service';
import { LegacyUsageService } from './services/legacy-usage.service';

/**
 * Part B Step 2: version tracking + the optional update notice (README.md).
 * AuthModule imports it for ClientTrackingService. The client-info middleware
 * that reads the headers lives in src/common/client-info and is registered in
 * main.ts.
 */
@Module({
  imports: [ConfigModule],
  controllers: [AppVersionController],
  providers: [
    AppUpdateService,
    ClientInstallationService,
    LegacyUsageService,
    ClientTrackingService,
    OpsKeyGuard,
  ],
  exports: [ClientTrackingService, LegacyUsageService],
})
export class AppVersionModule implements OnModuleInit {
  private readonly logger = new Logger('AppVersion');

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const key = (this.configService.get<string>('OPS_API_KEY') ?? '').trim();
    this.logger.log(
      key
        ? 'Release / support APIs enabled (X-Ops-Key)'
        : 'Release / support APIs disabled: OPS_API_KEY is not set',
    );
  }
}
