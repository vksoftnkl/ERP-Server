import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppVersionController } from './app-version.controller';
import { AppVersionAdminGuard } from './guards/app-version-admin.guard';
import { AppUpdateService } from './services/app-update.service';
import { AppVersionStateStore } from './services/app-version-state.store';
import { AuthEpochService } from './services/auth-epoch.service';
import { BackendUpdateService } from './services/backend-update.service';
import { BuildPolicyService } from './services/build-policy.service';
import { ClientInstallationService } from './services/client-installation.service';
import { ClientTrackingService } from './services/client-tracking.service';
import { LegacyUsageService } from './services/legacy-usage.service';

/**
 * Part B Step 2: version tracking, the update notice, and (Rev 2) logout after
 * a backend update + the enforced frontend build match (README.md).
 *
 * Exports what other modules call:
 *   AuthModule        ClientTrackingService, BuildPolicyService (login / refresh
 *                     build check), AuthEpochService (the `ep` claim)
 *   AppModule         AuthEpochService, for the global AccessTokenGuard
 *   HealthModule      AuthEpochService + BuildPolicyService for /health
 * The client-info middleware that reads the headers lives in
 * src/common/client-info and is registered in main.ts.
 */
@Module({
  imports: [ConfigModule],
  controllers: [AppVersionController],
  providers: [
    AppUpdateService,
    ClientInstallationService,
    LegacyUsageService,
    ClientTrackingService,
    AppVersionStateStore,
    AuthEpochService,
    BuildPolicyService,
    BackendUpdateService,
    AppVersionAdminGuard,
  ],
  exports: [ClientTrackingService, LegacyUsageService, AuthEpochService, BuildPolicyService],
})
export class AppVersionModule {}
