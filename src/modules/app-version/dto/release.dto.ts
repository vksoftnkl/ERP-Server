import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CLIENT_PLATFORMS,
  MAX_CLIENT_BUILD,
  type ClientPlatform,
} from '../../../common/client-info/client-info';
import { RELEASE_SEVERITIES, type ReleaseSeverity } from '../app-version.constants';
import { lowerTrim } from './check-update.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const URL_OPTIONS = { require_tld: false, require_protocol: true, protocols: ['http', 'https'] };

/** POST /app-version/releases: CI registers a build it has just published. */
export class CreateReleaseDto {
  @ApiProperty({ enum: CLIENT_PLATFORMS, example: 'desktop' })
  @Transform(lowerTrim)
  @IsIn(CLIENT_PLATFORMS)
  platform!: ClientPlatform;

  @ApiProperty({ minimum: 1, example: 12, description: 'The CI build number; unique per platform' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CLIENT_BUILD)
  build!: number;

  @ApiProperty({ maxLength: 32, example: '1.2.0', description: 'Display label only' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  version!: string;

  @ApiPropertyOptional({ maxLength: 40, example: 'aa10be0d' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  commit?: string | null;

  @ApiPropertyOptional({ enum: RELEASE_SEVERITIES, default: 'normal' })
  @IsOptional()
  @Transform(lowerTrim)
  @IsIn(RELEASE_SEVERITIES)
  severity?: ReleaseSeverity;

  @ApiPropertyOptional({ maxLength: 10000, description: 'Release notes' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @ApiPropertyOptional({ maxLength: 500, example: 'https://downloads.example.com/nexerp-12.exe' })
  @IsOptional()
  @Transform(trim)
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  downloadUrl?: string | null;

  @ApiPropertyOptional({ format: 'date-time', description: 'Defaults to now' })
  @IsOptional()
  @IsISO8601({ strict: true })
  releasedAt?: string;
}

/**
 * PATCH /app-version/releases/:platform/:build. Only the fields sent change.
 * `isDeleted: true` yanks a bad release: it stops being offered, and its build
 * number stays taken. `isDeleted: false` restores it.
 */
export class UpdateReleaseDto {
  @ApiPropertyOptional({ maxLength: 32 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  version?: string;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  commit?: string | null;

  @ApiPropertyOptional({ enum: RELEASE_SEVERITIES })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(lowerTrim)
  @IsIn(RELEASE_SEVERITIES)
  severity?: ReleaseSeverity;

  @ApiPropertyOptional({ maxLength: 10000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  downloadUrl?: string | null;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  releasedAt?: string;

  @ApiPropertyOptional({ description: 'false = keep the row but stop offering it' })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'true = yank (never offered), false = restore' })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isDeleted?: boolean;
}

export class ReleaseKeyParamsDto {
  @ApiProperty({ enum: CLIENT_PLATFORMS })
  @Transform(lowerTrim)
  @IsIn(CLIENT_PLATFORMS)
  platform!: ClientPlatform;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CLIENT_BUILD)
  build!: number;
}

export class ListReleasesQueryDto {
  @ApiPropertyOptional({ enum: CLIENT_PLATFORMS })
  @IsOptional()
  @Transform(lowerTrim)
  @IsIn(CLIENT_PLATFORMS)
  platform?: ClientPlatform;
}

export class ReleaseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: CLIENT_PLATFORMS })
  platform!: string;
  @ApiProperty()
  build!: number;
  @ApiProperty()
  version!: string;
  @ApiProperty({ nullable: true })
  commit!: string | null;
  @ApiProperty({ enum: RELEASE_SEVERITIES })
  severity!: string;
  @ApiProperty({ nullable: true })
  notes!: string | null;
  @ApiProperty({ nullable: true })
  downloadUrl!: string | null;
  @ApiProperty({ format: 'date-time' })
  releasedAt!: string;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty()
  isDeleted!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdOn!: string;
  @ApiProperty({ nullable: true })
  createdBy!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  modifiedOn!: string | null;
  @ApiProperty({ nullable: true })
  modifiedBy!: string | null;
}
