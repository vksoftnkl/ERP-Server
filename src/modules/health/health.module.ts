import { Module } from '@nestjs/common';
import { AppVersionModule } from '../app-version/app-version.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  // Part B Step 2 Rev 2: tokenEpoch + expectedClientBuilds on /health.
  imports: [AppVersionModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
