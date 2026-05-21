import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIP, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
const toOptionalTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};
export class LoginAuthDto {
  @ApiProperty({ example: 'john.doe', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  usrLoginName!: string;
  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @IsNotEmpty()
  usrPassword!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Stable client device identifier for the login session row',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID('all')
  device_id?: string;
  @ApiPropertyOptional({
    maxLength: 40,
    description: 'Client application version for the login session row',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(40)
  app_version?: string;
  @ApiPropertyOptional({
    example: '192.168.1.1',
    description: 'Client IP address; server-detected IP is used when omitted',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsIP()
  ip_address?: string;
  @ApiPropertyOptional({
    example: 'Mobile',
    maxLength: 30,
    description: 'Device type (e.g. Desktop, Mobile, Tablet)',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(30)
  device_type?: string;
  @ApiPropertyOptional({
    example: "John's iPhone",
    maxLength: 120,
    description: 'Human-readable device name',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  device_name?: string;
  @ApiPropertyOptional({
    example: 'Android',
    maxLength: 30,
    description: 'Device platform (e.g. Android, iOS, Windows)',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(30)
  platform?: string;
}
