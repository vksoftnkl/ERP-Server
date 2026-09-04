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

/** GET /eligibility — one customer against one scheme. */
export class PromotionSchemeEligibilityQueryDto extends PromotionSchemeIdQueryDto {
  @ApiProperty({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description: 'sales.customers(cus_id) — the customer on the bill',
  })
  @RequiredUuid()
  cus_id!: string;
}
