import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalTrimmedString, RequiredUuid } from './promotion-scheme-dto.helpers';

export class PromotionSchemeIdQueryDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  prm_id!: string;
}

export class DeletePromotionSchemeQueryDto extends PromotionSchemeIdQueryDto {
  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Stamped onto prm_modified_by; falls back to the authenticated user',
  })
  @OptionalTrimmedString(50)
  prm_modified_by?: string;
}

/** Every child row is deleted the same way: its own id, plus who did it. */
export class DeletePromotionChildQueryDto {
  @ApiProperty({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description: 'prb_id / prp_id / pri_id / prs_id, depending on the endpoint',
  })
  @RequiredUuid()
  row_id!: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  modified_by?: string;
}
