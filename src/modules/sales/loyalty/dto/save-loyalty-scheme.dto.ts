import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import { LoyaltySchemeBranchRowDto } from './save-loyalty-scheme-branch.dto';
import { LoyaltySchemeGiftRowDto } from './save-loyalty-scheme-gift.dto';
import { LoyaltySchemeItemRowDto } from './save-loyalty-scheme-item.dto';
import { LoyaltySchemePartyRowDto } from './save-loyalty-scheme-party.dto';
import { LoyaltySchemeSlabRowDto } from './save-loyalty-scheme-slab.dto';
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
} from './loyalty-dto.helpers';
import {
  LSC_APPLY_ON,
  LSC_BILL_TYPES,
  LSC_CALC_ON,
  LSC_EXPIRY_BASES,
  LSC_POOL_MODES,
  LSC_RETURN_MODES,
  LSC_ROUNDING,
  LSC_SCOPES,
  LSC_STATUSES,
  LSC_TYPES,
} from '../utils/loyalty.utils';

/**
 * The loyalty campaign header — a PLAIN OBJECT body carrying its five grids
 * along with it, so one call saves the whole campaign in one transaction.
 *
 * Send lsc_id to update, omit it to create. On update every field is optional
 * and only the keys actually present are written, so a screen can PATCH one
 * switch without resending the campaign. That is why the required-on-create
 * fields carry a ValidateIf instead of a bare @ApiProperty.
 *
 * Vocabulary values (type, status, apply_on, …) are checked in the service
 * rather than here, so one list governs both paths — and the table's own CHECK
 * constraints stand behind that.
 */
export class SaveLoyaltySchemeDto {
  @ApiPropertyOptional({
    description: 'When provided, updates the existing scheme instead of creating one',
    example: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  })
  @OptionalUuid()
  lsc_id?: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @ValidateIf((o: SaveLoyaltySchemeDto) => o.lsc_id === undefined || o.lsc_comp_id !== undefined)
  @RequiredUuid()
  lsc_comp_id?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Single-shop shorthand. NULL = the whole company.',
  })
  @NullableUuid()
  lsc_branch_id?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @NullableUuid()
  lsc_tenant_id?: string | null;

  @ApiProperty({ maxLength: 30, example: 'DIWALI25', description: 'Letters, digits, _ and - only' })
  @ValidateIf((o: SaveLoyaltySchemeDto) => o.lsc_id === undefined || o.lsc_code !== undefined)
  @TrimmedString(30)
  lsc_code?: string;

  @ApiProperty({ maxLength: 150, example: 'Diwali 2025 — 2x points on own brand' })
  @ValidateIf((o: SaveLoyaltySchemeDto) => o.lsc_id === undefined || o.lsc_name !== undefined)
  @TrimmedString(150)
  lsc_name?: string;

  @ApiPropertyOptional({ enum: LSC_TYPES, default: 'BOTH' })
  @OptionalTrimmedString(20)
  lsc_type?: string;

  @ApiPropertyOptional({ enum: LSC_STATUSES, default: 'DRAFT' })
  @OptionalTrimmedString(20)
  lsc_status?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 9,
    default: 1,
    description:
      'Which scheme wins when several match one bill. 1 = primary, and only one APPROVED, ' +
      'active primary may exist per company/branch/type.',
  })
  @OptionalInteger(1, 9)
  lsc_priority?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lsc_auto_apply?: boolean;

  // ── What it earns on ──────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: LSC_APPLY_ON, default: 'BILL_AMOUNT' })
  @OptionalTrimmedString(20)
  lsc_apply_on?: string;

  @ApiPropertyOptional({ enum: LSC_CALC_ON, default: 'NET_AMOUNT' })
  @OptionalTrimmedString(20)
  lsc_calc_on_amount_type?: string;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  lsc_include_tax?: boolean;

  @ApiPropertyOptional({ enum: LSC_BILL_TYPES, default: 'ALL' })
  @OptionalTrimmedString(20)
  lsc_bill_type?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'The earn floor' })
  @OptionalNumber(0)
  lsc_min_bill_amount?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'Per bill. 0 = uncapped.' })
  @OptionalNumber(0)
  lsc_max_earn_points?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lsc_earn_on_discounted?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  lsc_earn_on_charges?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Does a bill that spent points still earn on what was left to pay?',
  })
  @OptionalQueryBoolean()
  lsc_earn_with_redeem?: boolean;

  @ApiPropertyOptional({ enum: LSC_ROUNDING, default: 'FLOOR' })
  @OptionalTrimmedString(10)
  lsc_rounding_method?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 4, default: 2 })
  @OptionalInteger(0, 4)
  lsc_points_decimals?: number;

  // ── Scope switches ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: LSC_SCOPES, default: 'ALL' })
  @OptionalTrimmedString(10)
  lsc_branch_scope?: string;

  @ApiPropertyOptional({ enum: LSC_SCOPES, default: 'ALL' })
  @OptionalTrimmedString(10)
  lsc_cust_scope?: string;

  @ApiPropertyOptional({ enum: LSC_SCOPES, default: 'ALL' })
  @OptionalTrimmedString(10)
  lsc_item_scope?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'inventory.item_price_levels(ipl_id). NULL = every price level.',
  })
  @OptionalInteger(1)
  lsc_price_level_id?: number | null;

  // ── Chain store ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    enum: LSC_POOL_MODES,
    default: 'COMPANY',
    description:
      'COMPANY = one wallet, earned anywhere and spent anywhere. BRANCH = a franchisee honours ' +
      'only the points it issued.',
  })
  @OptionalTrimmedString(10)
  lsc_pool_mode?: string;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lsc_allow_cross_branch_redeem?: boolean;

  // ── Redemption ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  lsc_allow_point_redeem?: boolean;

  @ApiPropertyOptional({ default: false })
  @OptionalQueryBoolean()
  lsc_allow_gift_redeem?: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'accounts.acc_tender_master(tnd_id) — the LOYALTY tender (type 10)',
  })
  @NullableUuid()
  lsc_redeem_tender_id?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description:
      'Rupees per point. WINS over acc_tender_master.tnd_conversion_rate whenever this scheme ' +
      'matches. Required (> 0) once lsc_allow_point_redeem is true.',
  })
  @OptionalNumber(0)
  lsc_redeem_value_per_point?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @OptionalNumber(0)
  lsc_min_redeem_points?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'Per bill. 0 = uncapped.' })
  @OptionalNumber(0)
  lsc_max_redeem_points?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    default: 100,
    description: 'Per bill: the percentage of it points may settle',
  })
  @OptionalNumber(0)
  lsc_max_redeem_perc?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @OptionalNumber(0)
  lsc_redeem_min_bill_amount?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '0 = any quantity' })
  @OptionalNumber(0)
  lsc_redeem_multiple?: number;

  // ── Expiry and the return window ──────────────────────────────────────────

  @ApiPropertyOptional({
    enum: LSC_EXPIRY_BASES,
    default: 'EARN_DATE',
    description:
      'NONE = never lapses. SCHEME_END_DATE takes the date from lsc_end_date. The rest are ' +
      'computed from the earn date.',
  })
  @OptionalTrimmedString(20)
  lsc_expiry_basis?: string;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Must be greater than 0 when lsc_expiry_basis is EARN_DATE',
  })
  @OptionalInteger(0)
  lsc_points_valid_days?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 365,
    default: 0,
    description:
      'THE CLAW-BACK DEFENCE. Days a lot must age before it may be REDEEMED — long enough for ' +
      'the return window to close. Points still earn on bill save. 0 = redeemable immediately.',
  })
  @OptionalInteger(0, 365)
  lsc_activation_days?: number;

  @ApiPropertyOptional({ enum: LSC_RETURN_MODES, default: 'REVERSE' })
  @OptionalTrimmedString(10)
  lsc_return_mode?: string;

  // ── When it runs ──────────────────────────────────────────────────────────

  @ApiProperty({ example: '2025-10-01' })
  @ValidateIf((o: SaveLoyaltySchemeDto) => o.lsc_id === undefined || o.lsc_start_date !== undefined)
  @OptionalDateString()
  lsc_start_date?: string;

  @ApiProperty({ example: '2025-10-31' })
  @ValidateIf((o: SaveLoyaltySchemeDto) => o.lsc_id === undefined || o.lsc_end_date !== undefined)
  @OptionalDateString()
  lsc_end_date?: string;

  @ApiPropertyOptional({
    example: '22:22',
    type: String,
    nullable: true,
    description: 'Both time bounds or neither. from > to legitimately means "spans midnight".',
  })
  @OptionalTimeString()
  lsc_valid_from_time?: string | null;

  @ApiPropertyOptional({ example: '04:44', type: String, nullable: true })
  @OptionalTimeString()
  lsc_valid_to_time?: string | null;

  @ApiPropertyOptional({
    example: 'MON,TUE,WED',
    type: String,
    nullable: true,
    description: 'Three-letter day names, comma separated. NULL = every day.',
  })
  @NullableString(30)
  lsc_valid_weekdays?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @NullableString(65535)
  lsc_remarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  lsc_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lsc_created_by?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @OptionalTrimmedString(50)
  lsc_modified_by?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2025-09-28T09:30:00.000Z' })
  @NullableString(40)
  lsc_approved_on?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'public.user_master(usr_id). Required once lsc_status is APPROVED.',
  })
  @NullableUuid()
  lsc_approved_by?: string | null;

  // ─── the five child grids ───────────────────────────────────────────────────
  //
  // Each array REPLACES that grid: a row carrying its own id is updated, a row
  // without one is inserted, and a row already on the scheme but missing from
  // the array is soft deleted. That is what lets one POST save a grid the user
  // edited — including the lines they removed — without a second call.
  //
  // OMIT the key entirely to leave that grid untouched. A header-only save must
  // send no `slabs` key at all; `"slabs": []` means "delete every band".

  @ApiPropertyOptional({
    type: LoyaltySchemeBranchRowDto,
    isArray: true,
    description: 'Branch scope grid. Read only when lsc_branch_scope is LIST.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => LoyaltySchemeBranchRowDto)
  branches?: LoyaltySchemeBranchRowDto[];

  @ApiPropertyOptional({
    type: LoyaltySchemePartyRowDto,
    isArray: true,
    description: 'Customer / customer-group scope grid. Read only when lsc_cust_scope is LIST.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => LoyaltySchemePartyRowDto)
  parties?: LoyaltySchemePartyRowDto[];

  @ApiPropertyOptional({
    type: LoyaltySchemeItemRowDto,
    isArray: true,
    description: 'Item scope grid. Read only when lsc_item_scope is LIST.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => LoyaltySchemeItemRowDto)
  items?: LoyaltySchemeItemRowDto[];

  @ApiPropertyOptional({
    type: LoyaltySchemeSlabRowDto,
    isArray: true,
    description: 'Earn rate bands. One row = one band; bands are rows, not columns.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => LoyaltySchemeSlabRowDto)
  slabs?: LoyaltySchemeSlabRowDto[];

  @ApiPropertyOptional({
    type: LoyaltySchemeGiftRowDto,
    isArray: true,
    description: 'The catalogue of what points may be exchanged for.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => LoyaltySchemeGiftRowDto)
  gifts?: LoyaltySchemeGiftRowDto[];
}
