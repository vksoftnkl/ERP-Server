import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  OptionalUuid,
  toTrimmedString,
} from '../../utils/inventory-dto.decorators';

export class SaveItemTaxHistoryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item tax history row',
  })
  @OptionalUuid()
  ith_id?: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ith_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ith_tax_id!: string;

  @ApiProperty({ type: String, format: 'date' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  ith_effective_from!: string;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableString()
  ith_effective_to?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  ith_reason?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ith_created_by?: string | null;
}
