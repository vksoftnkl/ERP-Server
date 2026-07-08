import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableNumber,
  OptionalBoolean,
  OptionalNumber,
  OptionalUuid,
  NullableString,
} from 'src/common/dto/dtoDecorators';

export class SaveFreightChargesDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing freight charges',
  })
  @OptionalUuid()
  frId?: string;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frFromKm?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frToKm?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frFreightChrg?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frFromWeight?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frToWeight?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frLoadChrg?: number | null;

  @ApiPropertyOptional({ nullable: true, default: 0 })
  @NullableNumber()
  frUnloadChrg?: number | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  frIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  frCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  frModifiedBy?: string | null;
}
