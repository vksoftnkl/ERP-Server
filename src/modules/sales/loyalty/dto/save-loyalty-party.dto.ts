import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, ValidateIf } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from './loyalty-dto.helpers';

const LOYALTY_PARTY_SCOPE_TYPES = ['CUSTOMER_GROUP', 'CUSTOMER'] as const;

export class SaveLoyaltyPartyDto {
  @ApiPropertyOptional({
    description: 'When provided, updates an existing loyalty party scope row',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @OptionalUuid()
  lps_id?: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @OptionalUuid()
  lps_ls_id?: string;

  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @OptionalInteger(1)
  lps_slno?: number;

  @ApiProperty({ example: 'CUSTOMER_GROUP', enum: LOYALTY_PARTY_SCOPE_TYPES })
  @ValidateIf(
    (object: SaveLoyaltyPartyDto) =>
      object.lps_id === undefined || object.lps_scope_type !== undefined,
  )
  @TrimmedString(30)
  @IsIn(LOYALTY_PARTY_SCOPE_TYPES)
  lps_scope_type?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf(
    (object: SaveLoyaltyPartyDto) =>
      object.lps_id === undefined || object.lps_scope_id !== undefined,
  )
  @RequiredUuid()
  lps_scope_id?: string;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  lps_is_exclude?: boolean;

  @ApiPropertyOptional({ maxLength: 65535, nullable: true })
  @NullableString(65535)
  lps_notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lps_is_active?: boolean;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lps_created_by?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @NullableUuid()
  lps_updated_by?: string | null;
}
