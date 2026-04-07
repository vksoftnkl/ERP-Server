import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromotionLoyaltyPointsErrorFieldDto {
  @ApiProperty({ example: 'ls_name' })
  field!: string;

  @ApiProperty({ example: 'ls_name is required' })
  message!: string;
}

export class PromotionLoyaltyPointsErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: PromotionLoyaltyPointsErrorFieldDto, isArray: true })
  errors!: PromotionLoyaltyPointsErrorFieldDto[];
}

export class PromotionLoyaltyPointsListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class LoyaltyPointPayloadDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lspt_id!: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lspt_ls_id!: string;

  @ApiProperty({ example: 1 })
  lspt_slno!: number;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  lspt_item_id!: string | null;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  lspt_unit_id!: string | null;

  @ApiProperty({ example: 0 })
  lspt_exceeds!: number;

  @ApiProperty({ example: 1 })
  lspt_each!: number;

  @ApiProperty({ example: 1 })
  lspt_factor!: number;

  @ApiProperty({ example: 10 })
  lspt_points!: number;

  @ApiPropertyOptional({ example: 'Bill amount slab', nullable: true })
  lspt_notes!: string | null;

  @ApiProperty({ example: true })
  lspt_is_active!: boolean;

  @ApiProperty({ example: false })
  lspt_is_deleted!: boolean;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  lspt_sync_date!: string | null;

  @ApiProperty({ example: '2026-04-06T12:00:00.000Z' })
  lspt_created_on!: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  lspt_created_by!: string | null;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  lspt_updated_on!: string | null;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  lspt_updated_by!: string | null;
}

export class LoyaltyGiftPayloadDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lsg_id!: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lsg_ls_id!: string;

  @ApiProperty({ example: 1 })
  lsg_slno!: number;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lsg_item_id!: string;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lsg_unit_id!: string;

  @ApiProperty({ example: 1 })
  lsg_item_qty!: number;

  @ApiProperty({ example: 100 })
  lsg_redeem_points!: number;

  @ApiProperty({ example: false })
  lsg_repeat!: boolean;

  @ApiPropertyOptional({ example: 'Festival gift', nullable: true })
  lsg_notes!: string | null;

  @ApiProperty({ example: true })
  lsg_is_active!: boolean;

  @ApiProperty({ example: false })
  lsg_is_deleted!: boolean;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  lsg_sync_date!: string | null;

  @ApiProperty({ example: '2026-04-06T12:00:00.000Z' })
  lsg_created_on!: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  lsg_created_by!: string | null;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  lsg_updated_on!: string | null;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  lsg_updated_by!: string | null;
}

export class LoyaltySchemeSummaryPayloadDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  ls_id!: string;

  @ApiPropertyOptional({ example: 'LS001', nullable: true })
  ls_code!: string | null;

  @ApiProperty({ example: 'Summer Rewards' })
  ls_name!: string;

  @ApiProperty({ example: 'REDEEM' })
  ls_type!: string;

  @ApiProperty({ example: 'ACTIVE' })
  ls_status!: string;

  @ApiProperty({ example: true })
  ls_auto_apply!: boolean;

  @ApiProperty({ example: 'BILL_AMOUNT' })
  ls_apply_on!: string;

  @ApiProperty({ example: 'NET_AMOUNT' })
  ls_calc_on_amount_type!: string;

  @ApiProperty({ example: 'ALL' })
  ls_bill_type!: string;

  @ApiProperty({ example: 'ALL' })
  ls_cust_type!: string;

  @ApiProperty({ example: 'ALL' })
  ls_item_type!: string;

  @ApiProperty({ example: '2026-04-01' })
  ls_start_date!: string;

  @ApiProperty({ example: '2026-04-30' })
  ls_end_date!: string;

  @ApiPropertyOptional({ example: '09:00:00', nullable: true })
  ls_valid_from_time!: string | null;

  @ApiPropertyOptional({ example: '18:00:00', nullable: true })
  ls_valid_to_time!: string | null;

  @ApiPropertyOptional({ example: '1,2,3,4,5', nullable: true })
  ls_valid_weekdays!: string | null;

  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  ls_comp_id!: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  ls_branch_id!: string | null;

  @ApiProperty({ example: false })
  ls_include_tax_for_points!: boolean;

  @ApiProperty({ example: 'FLOOR' })
  ls_rounding_method!: string;

  @ApiProperty({ example: false })
  ls_recur_apl!: boolean;

  @ApiProperty({ example: false })
  ls_bal_apl!: boolean;

  @ApiProperty({ example: false })
  ls_allow_point_redeem!: boolean;

  @ApiProperty({ example: false })
  ls_allow_gift_redeem!: boolean;

  @ApiProperty({ example: 1 })
  ls_redeem_value_per_point!: number;

  @ApiProperty({ example: 100 })
  ls_min_redeem_points!: number;

  @ApiProperty({ example: 500 })
  ls_max_redeem_points_per_bill!: number;

  @ApiProperty({ example: 50 })
  ls_max_redeem_percent_per_bill!: number;

  @ApiProperty({ example: 2500 })
  ls_redeem_min_bill_amount!: number;

  @ApiProperty({ example: 180 })
  ls_points_valid_days!: number;

  @ApiProperty({ example: 'EARN_DATE' })
  ls_expiry_basis!: string;

  @ApiPropertyOptional({ example: 'Approved for summer promotion', nullable: true })
  ls_remarks!: string | null;

  @ApiProperty({ example: true })
  ls_is_active!: boolean;

  @ApiProperty({ example: false })
  ls_is_deleted!: boolean;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  ls_sync_date!: string | null;

  @ApiProperty({ example: '2026-04-06T12:00:00.000Z' })
  ls_created_on!: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  ls_created_by!: string | null;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  ls_updated_on!: string | null;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  ls_updated_by!: string | null;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  ls_approved_on!: string | null;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e', nullable: true })
  ls_approved_by!: string | null;
}

export class LoyaltySchemePayloadDto extends LoyaltySchemeSummaryPayloadDto {
  @ApiProperty({ type: LoyaltyPointPayloadDto, isArray: true })
  points!: LoyaltyPointPayloadDto[];

  @ApiProperty({ type: LoyaltyGiftPayloadDto, isArray: true })
  gifts!: LoyaltyGiftPayloadDto[];
}

export class LoyaltySchemeDeleteResultDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  ls_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class LoyaltyPointDeleteResultDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lspt_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class LoyaltyGiftDeleteResultDto {
  @ApiProperty({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  lsg_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class LoyaltySchemeSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty scheme fetched successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltySchemePayloadDto })
  data!: LoyaltySchemePayloadDto;
}

export class LoyaltySchemeSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty schemes fetched successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltySchemeSummaryPayloadDto, isArray: true })
  data!: LoyaltySchemeSummaryPayloadDto[];

  @ApiProperty({ type: PromotionLoyaltyPointsListMetaDto })
  meta!: PromotionLoyaltyPointsListMetaDto;
}

export class LoyaltySchemeSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty scheme deleted successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltySchemeDeleteResultDto })
  data!: LoyaltySchemeDeleteResultDto;
}

export class LoyaltyPointSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty point fetched successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltyPointPayloadDto })
  data!: LoyaltyPointPayloadDto;
}

export class LoyaltyPointSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty points fetched successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltyPointPayloadDto, isArray: true })
  data!: LoyaltyPointPayloadDto[];

  @ApiProperty({ type: PromotionLoyaltyPointsListMetaDto })
  meta!: PromotionLoyaltyPointsListMetaDto;
}

export class LoyaltyPointSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty point deleted successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltyPointDeleteResultDto })
  data!: LoyaltyPointDeleteResultDto;
}

export class LoyaltyGiftSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty gift fetched successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltyGiftPayloadDto })
  data!: LoyaltyGiftPayloadDto;
}

export class LoyaltyGiftSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty gifts fetched successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltyGiftPayloadDto, isArray: true })
  data!: LoyaltyGiftPayloadDto[];

  @ApiProperty({ type: PromotionLoyaltyPointsListMetaDto })
  meta!: PromotionLoyaltyPointsListMetaDto;
}

export class LoyaltyGiftSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Loyalty gift deleted successfully' })
  message!: string;

  @ApiProperty({ type: LoyaltyGiftDeleteResultDto })
  data!: LoyaltyGiftDeleteResultDto;
}
