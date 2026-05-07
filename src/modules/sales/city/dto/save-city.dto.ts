import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NullableString, OptionalBoolean, OptionalNumber } from '../../dto/dtoDecorators';

export class SaveCityDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing city',
  })
  @IsOptional()
  @IsUUID('all')
  ctmId?: string;

  @ApiProperty({ maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ctmName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ctmAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  ctmShort?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  ctmStateId!: string;

  @ApiPropertyOptional({ default: 0 })
  @OptionalNumber()
  ctmOrder?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ctmIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ctmCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ctmModifiedBy?: string | null;
}
