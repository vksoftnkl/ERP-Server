import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toTrimmedString } from 'src/common/dto/dto-transforms';


export class SaveGspProviderMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing GSP provider',
  })
  @IsOptional()
  @IsUUID('all')
  gspProviderId?: string;

  @ApiProperty({ maxLength: 50 })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  gspProviderCode!: string;

  @ApiProperty({ maxLength: 150 })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  gspProviderName!: string;

  @ApiProperty({ description: 'Base URL for provider API' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  gspBaseUrl!: string;

  @ApiProperty({ description: 'Route path for provider API' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  gspRoute!: string;

  @ApiProperty({ description: 'Provider server IP address' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsIP()
  gspIpAddress!: string;

  @ApiProperty()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  gspUserName!: string;

  @ApiProperty()
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  gspUserPassword!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gspIsActive?: boolean;
}
