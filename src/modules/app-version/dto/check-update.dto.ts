import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  CLIENT_PLATFORMS,
  MAX_CLIENT_BUILD,
  type ClientPlatform,
} from '../../../common/client-info/client-info';
import { RELEASE_SEVERITIES, type ReleaseSeverity } from '../app-version.constants';

export const lowerTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * GET /app-version/check. Each value falls back to its header (X-App-Platform /
 * X-App-Build), so a client can call it with no query string at all.
 */
export class CheckUpdateQueryDto {
  @ApiPropertyOptional({ enum: CLIENT_PLATFORMS, description: 'Defaults to X-App-Platform' })
  @IsOptional()
  @Transform(lowerTrim)
  @IsIn(CLIENT_PLATFORMS)
  platform?: ClientPlatform;

  @ApiPropertyOptional({ minimum: 1, example: 10, description: 'Defaults to X-App-Build' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CLIENT_BUILD)
  build?: number;
}

/**
 * "Is a newer build available?": the body of GET /app-version/check, and
 * `appUpdate` on the login response (present only when the client sent
 * X-App-Platform + X-App-Build). It is a notice only. Nothing is ever refused
 * because of it.
 */
export class AppUpdateInfoDto {
  @ApiProperty({ enum: CLIENT_PLATFORMS, example: 'desktop' })
  platform!: ClientPlatform;

  @ApiProperty({ example: 10, description: 'The build the client said it runs' })
  currentBuild!: number;

  @ApiProperty({ description: 'A live release newer than currentBuild exists' })
  updateAvailable!: boolean;

  @ApiProperty({
    enum: RELEASE_SEVERITIES,
    nullable: true,
    description:
      'The most urgent severity among ALL the builds the client missed, not just the latest ' +
      '(a critical 11 under a normal 12 reads critical). null when up to date.',
  })
  severity!: ReleaseSeverity | null;

  @ApiProperty({
    nullable: true,
    example: 12,
    description: 'Highest live build; null = none released',
  })
  latestBuild!: number | null;

  @ApiProperty({ nullable: true, example: '1.2.0' })
  latestVersion!: string | null;

  @ApiProperty({ nullable: true, description: 'Installer / store / updater link of latestBuild' })
  downloadUrl!: string | null;

  @ApiProperty({ nullable: true, description: 'Release notes of latestBuild' })
  notes!: string | null;

  @ApiProperty({ nullable: true, example: '2026-11-10T10:00:00.000Z' })
  releasedAt!: string | null;

  @ApiProperty({ example: 2, description: 'How many live builds are newer than currentBuild' })
  missedBuilds!: number;
}
