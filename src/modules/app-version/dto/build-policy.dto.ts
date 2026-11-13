import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CLIENT_PLATFORMS,
  MAX_CLIENT_BUILD,
  type ClientPlatform,
} from '../../../common/client-info/client-info';
import { lowerTrim } from './check-update.dto';

const trimToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

const URL_OPTIONS = { require_tld: false, require_protocol: true, protocols: ['http', 'https'] };

/** /app-version/policy/:platform */
export class PolicyPlatformParamsDto {
  @ApiProperty({ enum: CLIENT_PLATFORMS, example: 'desktop' })
  @Transform(lowerTrim)
  @IsIn(CLIENT_PLATFORMS)
  platform!: ClientPlatform;
}

/**
 * PATCH /app-version/policy/:platform (Rev 2 §5.4). Only the fields sent
 * change; `null` clears expectedBuild / message / downloadUrl. The row becomes
 * abp_source = 'manual': a later backend update leaves it alone until
 * POST …/use-manifest hands it back. `enforce: false` is the emergency switch.
 */
export class UpdateBuildPolicyDto {
  @ApiPropertyOptional({ description: 'false = no build check for this platform' })
  @IsOptional()
  @IsBoolean()
  enforce?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    nullable: true,
    example: 12,
    description: 'The one build a client must send while enforce is true',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CLIENT_BUILD)
  expectedBuild?: number | null;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    example: 'Please update VK Nex Desktop to continue.',
    description: 'Shown to the user on 426; null = the default wording',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  message?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, example: 'https://…/setup.exe' })
  @IsOptional()
  @Transform(trimToNull)
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  downloadUrl?: string | null;
}

export class BuildPolicyResponseDto {
  @ApiProperty({ enum: CLIENT_PLATFORMS })
  platform!: ClientPlatform;

  @ApiProperty()
  enforce!: boolean;

  @ApiProperty({ nullable: true, type: Number })
  expectedBuild!: number | null;

  @ApiProperty({ nullable: true, type: String })
  message!: string | null;

  @ApiProperty({ nullable: true, type: String })
  downloadUrl!: string | null;

  @ApiProperty({ enum: ['manifest', 'manual'] })
  source!: 'manifest' | 'manual';

  @ApiProperty({ nullable: true, format: 'date-time', type: String })
  changedOn!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'user id, system-update or migration' })
  changedBy!: string | null;
}
