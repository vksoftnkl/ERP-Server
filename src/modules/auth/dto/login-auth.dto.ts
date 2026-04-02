import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

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
  user_name!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @IsNotEmpty()
  user_password!: string;

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
}
