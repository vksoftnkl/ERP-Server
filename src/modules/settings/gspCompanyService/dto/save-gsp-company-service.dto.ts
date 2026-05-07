import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableString,
  OptionalBoolean,
  UpperMaxString,
} from '../../dto/dtoDecorators';

export class SaveGspCompanyServiceDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing GSP company service',
  })
  @IsOptional()
  @IsUUID('all')
  csgCompanyServiceId?: string;

  @ApiProperty({ type: String, example: 'c7f8c0c0-0000-0000-0000-000000000001' })
  @IsString()
  csgCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  csgGspProviderId!: string;

  @ApiProperty({ maxLength: 20 })
  @UpperMaxString(20)
  @IsNotEmpty()
  csgServiceType!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  csgEuserName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  csgEuserPassword!: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  csgAuthToken?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableDate()
  csgAuthTokenValidTill?: Date | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  csgIsActive?: boolean;
}
