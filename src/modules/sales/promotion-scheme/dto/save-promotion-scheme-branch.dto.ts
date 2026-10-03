import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';
import {
  NullableString,
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from './promotion-scheme-dto.helpers';

/**
 * One row of the `branches` array on POST /create.
 *
 * Read only when the header says prm_branch_scope = 'LIST'.
 */
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

  @ApiPropertyOptional({ type: String, nullable: true })
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
