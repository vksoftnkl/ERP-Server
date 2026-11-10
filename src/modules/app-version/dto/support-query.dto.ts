import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  CLIENT_PLATFORMS,
  MAX_CLIENT_BUILD,
  type ClientPlatform,
} from '../../../common/client-info/client-info';
import { LEGACY_USAGE_PLATFORMS, type LegacyUsagePlatform } from '../app-version.constants';
import { lowerTrim } from './check-update.dto';

/** GET /app-version/installations: who runs which build, newest seen first. */
export class ListInstallationsQueryDto {
  @ApiPropertyOptional({ enum: CLIENT_PLATFORMS })
  @IsOptional()
  @Transform(lowerTrim)
  @IsIn(CLIENT_PLATFORMS)
  platform?: ClientPlatform;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CLIENT_BUILD)
  build?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/** GET /app-version/installations/summary: per platform, which builds are in use. */
export class InstallationSummaryQueryDto {
  @ApiPropertyOptional({ enum: CLIENT_PLATFORMS })
  @IsOptional()
  @Transform(lowerTrim)
  @IsIn(CLIENT_PLATFORMS)
  platform?: ClientPlatform;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3650,
    default: 30,
    description: 'An installation is active when it was last seen within this many days',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  activeDays?: number;
}

/** GET /app-version/legacy-usage: how often each legacy field is still used, per build. */
export class LegacyUsageQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'Part of the field name, any case' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: LEGACY_USAGE_PLATFORMS })
  @IsOptional()
  @Transform(lowerTrim)
  @IsIn(LEGACY_USAGE_PLATFORMS)
  platform?: LegacyUsagePlatform;

  @ApiPropertyOptional({ description: '-1 = the client sent no build' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(MAX_CLIENT_BUILD)
  build?: number;
}
