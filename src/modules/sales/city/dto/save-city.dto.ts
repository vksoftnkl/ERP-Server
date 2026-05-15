import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalNumber,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from '../../dto/dtoDecorators';

export class SaveCityDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing city',
  })
  @OptionalUuid()
  ctmId?: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  ctmName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ctmAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  ctmShort?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
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
