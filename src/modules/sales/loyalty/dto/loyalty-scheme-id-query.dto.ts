import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalTrimmedString, RequiredUuid } from './loyalty-dto.helpers';

export class LoyaltySchemeIdQueryDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @RequiredUuid()
  lsc_id!: string;
}

export class DeleteLoyaltySchemeQueryDto extends LoyaltySchemeIdQueryDto {
  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Stamped onto lsc_modified_by; falls back to the authenticated user',
  })
  @OptionalTrimmedString(50)
  lsc_modified_by?: string;
}

/** GET /eligibility — one customer against one scheme. */
export class LoyaltySchemeEligibilityQueryDto extends LoyaltySchemeIdQueryDto {
  @ApiProperty({
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
    description: 'sales.customers(cus_id) — the customer on the bill',
  })
  @RequiredUuid()
  cus_id!: string;
}
