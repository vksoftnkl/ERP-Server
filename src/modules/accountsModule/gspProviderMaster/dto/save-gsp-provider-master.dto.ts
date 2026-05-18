import { IsIP, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalBoolean, OptionalUuid, TrimmedString } from '../../dto/dtoDecorators';

export class SaveGspProviderMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing GSP provider',
  })
  @OptionalUuid()
  gspProviderId?: string;

  @ApiProperty({ maxLength: 50 })
  @TrimmedString(50)
  @IsNotEmpty()
  gspProviderCode!: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  gspProviderName!: string;

  @ApiProperty({ description: 'Base URL for provider API' })
  @TrimmedString()
  @IsNotEmpty()
  gspBaseUrl!: string;

  @ApiProperty({ description: 'Route path for provider API' })
  @TrimmedString()
  @IsNotEmpty()
  gspRoute!: string;

  @ApiProperty({ description: 'Provider server IP address' })
  @TrimmedString()
  @IsNotEmpty()
  @IsIP()
  gspIpAddress!: string;

  @ApiProperty()
  @TrimmedString()
  @IsNotEmpty()
  gspUserName!: string;

  @ApiProperty()
  @TrimmedString()
  @IsNotEmpty()
  gspUserPassword!: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  gspIsActive?: boolean;
}
