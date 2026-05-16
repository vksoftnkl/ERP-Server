import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUuid,
  toTrimmedString,
} from '../../utils/inventory-dto.decorators';

export class SaveItemReorderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item reorder row',
  })
  @OptionalUuid()
  ir_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ir_branch_id?: string | null;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @IsUUID('all')
  ir_item_id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ir_unit_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ir_godown_id?: string | null;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ir_min_level?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ir_max_level?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ir_reorder_level?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  ir_reorder_qty?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  ir_lead_time_days?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  ir_review_cycle_days?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  ir_reorder_days?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  ir_expiry_buffer_days?: number;

  @ApiPropertyOptional({ maxLength: 20, default: 'MIN_MAX' })
  @OptionalTrimmedString(20)
  ir_reorder_type?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ir_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ir_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ir_modified_by?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  ir_remarks?: string | null;
}
