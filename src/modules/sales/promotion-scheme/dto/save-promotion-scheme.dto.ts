import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalDateString,
  OptionalInteger,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalTimeString,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from './promotion-scheme-dto.helpers';
import {
  PRM_APPLY_ON,
  PRM_BENEFITS,
  PRM_BILL_TYPES,
  PRM_CALC_ON,
  PRM_SCOPES,
  PRM_STACK_MODES,
  PRM_STATUSES,
} from '../utils/promotion-scheme.utils';

/**
 * The campaign header — a PLAIN OBJECT body, unlike the four child endpoints
 * which each take an array.
 *
 * Send prm_id to update, omit it to create. On update every field is optional
 * and only the keys actually present are written, so a screen can PATCH one
 * switch without resending the campaign. That is why the required-on-create
 * fields carry a ValidateIf instead of a bare @ApiProperty.
 *
 * Vocabulary values (status, apply_on, benefit, …) are checked in the service
 * rather than here, so one list governs both paths.
 */
export class SavePromotionSchemeDto {
  @ApiPropertyOptional({
    description: 'When provided, updates the existing scheme instead of creating one',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @OptionalUuid()
  prm_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf((o: SavePromotionSchemeDto) => o.prm_id === undefined || o.prm_comp_id !== undefined)
  @RequiredUuid()
  prm_comp_id?: string;

  @ApiPropertyOptional({ nullable: true, description: 'NULL = the whole company' })
  @NullableUuid()
  prm_branch_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableUuid()
  prm_tenant_id?: string | null;

  @ApiProperty({ maxLength: 30, example: 'DIWALI25', description: 'Letters, digits, _ and - only' })
  @ValidateIf((o: SavePromotionSchemeDto) => o.prm_id === undefined || o.prm_code !== undefined)
  @TrimmedString(30)
  prm_code?: string;

  @ApiProperty({ maxLength: 150, example: 'Diwali 2025 — 10% off own brand' })
  @ValidateIf((o: SavePromotionSchemeDto) => o.prm_id === undefined || o.prm_name !== undefined)
  @TrimmedString(150)
  prm_name?: string;

  @ApiPropertyOptional({ enum: PRM_STATUSES, default: 'DRAFT' })
  @OptionalTrimmedString(20)
  prm_status?: string;

  @ApiPropertyOptional({ enum: PRM_APPLY_ON, default: 'ITEM_QTY' })
  @OptionalTrimmedString(20)
  prm_apply_on?: string;

  @ApiPropertyOptional({ enum: PRM_BENEFITS, default: 'DISC_PERC' })
  @OptionalTrimmedString(20)
  prm_benefit?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 9, default: 1 })
  @OptionalInteger(1, 9)
  prm_priority?: number;

  @ApiPropertyOptional({ enum: PRM_STACK_MODES, default: 'EXCLUSIVE' })
  @OptionalTrimmedString(10)
  prm_stack_mode?: string;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  prm_auto_apply?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Does the scheme still fire on a line the operator already discounted by hand?',
  })
  @OptionalQueryBoolean()
  prm_allow_with_manual_disc?: boolean;

  @ApiPropertyOptional({ enum: PRM_CALC_ON, default: 'NET_AMOUNT' })
  @OptionalTrimmedString(20)
  prm_calc_on_amount_type?: string;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  prm_include_tax?: boolean;

  @ApiPropertyOptional({ enum: PRM_BILL_TYPES, default: 'ALL' })
  @OptionalTrimmedString(20)
  prm_bill_type?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @OptionalNumber(0)
  prm_min_bill_amount?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @OptionalNumber(0)
  prm_min_qty?: number;

  @ApiPropertyOptional({ enum: PRM_SCOPES, default: 'ALL' })
  @OptionalTrimmedString(10)
  prm_branch_scope?: string;

  @ApiPropertyOptional({ enum: PRM_SCOPES, default: 'ALL' })
  @OptionalTrimmedString(10)
  prm_cust_scope?: string;

  @ApiPropertyOptional({ enum: PRM_SCOPES, default: 'ALL' })
  @OptionalTrimmedString(10)
  prm_item_scope?: string;

  @ApiPropertyOptional({ nullable: true, description: 'NULL = every price level' })
  @OptionalInteger(1)
  prm_price_level_id?: number | null;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = uncapped' })
  @OptionalNumber(0)
  prm_max_benefit_per_bill?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = uncapped' })
  @OptionalInteger(0)
  prm_max_uses_total?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = uncapped' })
  @OptionalInteger(0)
  prm_max_uses_per_cust?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = uncapped' })
  @OptionalNumber(0)
  prm_budget_amount?: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'sales.loyalty_coupon_batch(lcb_id). NULL = applies automatically, no code needed. ' +
      'Stored without a foreign key until that table exists.',
  })
  @NullableUuid()
  prm_coupon_batch_id?: string | null;

  @ApiProperty({ example: '2025-10-01' })
  @ValidateIf(
    (o: SavePromotionSchemeDto) => o.prm_id === undefined || o.prm_start_date !== undefined,
  )
  @OptionalDateString()
  prm_start_date?: string;

  @ApiProperty({ example: '2025-10-31' })
  @ValidateIf((o: SavePromotionSchemeDto) => o.prm_id === undefined || o.prm_end_date !== undefined)
  @OptionalDateString()
  prm_end_date?: string;

  @ApiPropertyOptional({
    example: '22:00',
    nullable: true,
    description: 'Both time bounds or neither. from > to legitimately means "spans midnight".',
  })
  @OptionalTimeString()
  prm_valid_from_time?: string | null;

  @ApiPropertyOptional({ example: '04:00', nullable: true })
  @OptionalTimeString()
  prm_valid_to_time?: string | null;

  @ApiPropertyOptional({
    example: 'MON,TUE,WED',
    nullable: true,
    description: 'Three-letter day names, comma separated. NULL = every day.',
  })
  @NullableString(30)
  prm_valid_weekdays?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(65535)
  prm_remarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  prm_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prm_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  prm_modified_by?: string;

  @ApiPropertyOptional({ nullable: true, example: '2025-09-28T09:30:00.000Z' })
  @NullableString(40)
  prm_approved_on?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'public.user_master(usr_id). Required once prm_status is APPROVED.',
  })
  @NullableUuid()
  prm_approved_by?: string | null;
}
