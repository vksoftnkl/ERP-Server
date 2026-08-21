import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateIf, ValidateNested } from 'class-validator';
import {
  NullableString,
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from './promotion-scheme-dto.helpers';

export class PromotionSchemeBranchRowDto {
  @ApiPropertyOptional({ description: 'Present = update that row, absent = insert a new one' })
  @OptionalUuid()
  prb_id?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  prb_slno?: number;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (o: PromotionSchemeBranchRowDto) => o.prb_id === undefined || o.prb_branch_id !== undefined,
  )
  @RequiredUuid()
  prb_branch_id?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'An EXCLUDE row always beats an INCLUDE row for the same branch',
  })
  @OptionalQueryBoolean()
  prb_is_exclude?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(65535)
  prb_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  prb_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prb_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prb_modified_by?: string;
}

/**
 * Read only when the header says prm_branch_scope = 'LIST'.
 *
 * The array is an UPSERT, not a replace: rows carrying prb_id are updated, rows
 * without one are inserted, and rows already on the scheme but absent from the
 * array are left alone. Deleting is an explicit call to branches/delete — a
 * half-built grid POST must never wipe branches the user cannot see.
 */
export class SavePromotionSchemeBranchesDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  prm_id!: string;

  @ApiProperty({ type: [PromotionSchemeBranchRowDto] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PromotionSchemeBranchRowDto)
  branches!: PromotionSchemeBranchRowDto[];
}
