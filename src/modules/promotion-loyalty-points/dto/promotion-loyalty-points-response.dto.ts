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
  @ApiProperty({ example: 1 })
  lspt_id!: number;

  @ApiProperty({ example: 1 })
  lspt_ls_id!: number;

  @ApiProperty({ example: 1 })
  lspt_slno!: number;

  @ApiPropertyOptional({ example: 100, nullable: true })
  lspt_item_id!: number | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  lspt_unit_id!: number | null;

  @ApiProperty({ example: 0 })
  lspt_exceeds!: number;

  @ApiProperty({ example: 1 })
  lspt_each!: number;

  @ApiProperty({ example: 1 })
  lspt_factor!: number;

  @ApiProperty({ example: 10 })
  lspt_points!: number;

  @ApiProperty({ example: true })
  lspt_is_active!: boolean;

  @ApiProperty({ example: false })
  lspt_is_deleted!: boolean;

  @ApiProperty({ example: '2026-04-06T12:00:00.000Z' })
  created_on!: string;

  @ApiPropertyOptional({ example: 1001, nullable: true })
  created_by!: number | null;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  modified_on!: string | null;

  @ApiPropertyOptional({ example: 1001, nullable: true })
  modified_by!: number | null;
}

export class LoyaltyGiftPayloadDto {
  @ApiProperty({ example: 1 })
  gift_ls_id!: number;

  @ApiProperty({ example: 1 })
  gift_slno!: number;

  @ApiProperty({ example: 100 })
  gift_item_id!: number;

  @ApiProperty({ example: 1 })
  gift_unit_id!: number;

  @ApiProperty({ example: 1 })
  gift_qty!: number;

  @ApiProperty({ example: 100 })
  gift_points!: number;

  @ApiProperty({ example: false })
  gift_repeat!: boolean;

  @ApiProperty({ example: true })
  gift_is_active!: boolean;

  @ApiProperty({ example: false })
  gift_is_deleted!: boolean;

  @ApiProperty({ example: '2026-04-06T12:00:00.000Z' })
  created_on!: string;

  @ApiPropertyOptional({ example: 1001, nullable: true })
  created_by!: number | null;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  modified_on!: string | null;

  @ApiPropertyOptional({ example: 1001, nullable: true })
  modified_by!: number | null;
}

export class LoyaltySchemeSummaryPayloadDto {
  @ApiProperty({ example: 1 })
  ls_id!: number;

  @ApiPropertyOptional({ example: 'LS001', nullable: true })
  ls_code!: string | null;

  @ApiProperty({ example: 'Summer Rewards' })
  ls_name!: string;

  @ApiProperty({ example: 'GENERAL' })
  ls_type!: string;

  @ApiProperty({ example: 'BILL_AMOUNT' })
  ls_apply_on!: string;

  @ApiProperty({ example: 'ALL' })
  ls_bill_type!: string;

  @ApiProperty({ example: 'ALL' })
  ls_cust_type!: string;

  @ApiProperty({ example: 'ALL' })
  ls_item_type!: string;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  ls_start_date!: string;

  @ApiProperty({ example: '2026-04-30T00:00:00.000Z' })
  ls_end_date!: string;

  @ApiProperty({ example: 1 })
  ls_comp_id!: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  ls_branch_id!: number | null;

  @ApiProperty({ example: 1 })
  ls_points_per_inr!: number;

  @ApiProperty({ example: 0 })
  ls_points_per_qty!: number;

  @ApiProperty({ example: 100 })
  ls_min_bill_amount!: number;

  @ApiProperty({ example: 500 })
  ls_max_points_per_bill!: number;

  @ApiProperty({ example: false })
  ls_recur_apl!: boolean;

  @ApiProperty({ example: false })
  ls_bal_apl!: boolean;

  @ApiProperty({ example: true })
  ls_allow_point_earn!: boolean;

  @ApiProperty({ example: false })
  ls_allow_point_redeem!: boolean;

  @ApiProperty({ example: false })
  ls_allow_gift_redeem!: boolean;

  @ApiProperty({ example: true })
  ls_is_active!: boolean;

  @ApiProperty({ example: false })
  ls_is_deleted!: boolean;

  @ApiProperty({ example: '2026-04-06T12:00:00.000Z' })
  created_on!: string;

  @ApiPropertyOptional({ example: 1001, nullable: true })
  created_by!: number | null;

  @ApiPropertyOptional({ example: '2026-04-06T12:00:00.000Z', nullable: true })
  modified_on!: string | null;

  @ApiPropertyOptional({ example: 1001, nullable: true })
  modified_by!: number | null;
}

export class LoyaltySchemePayloadDto extends LoyaltySchemeSummaryPayloadDto {
  @ApiProperty({ type: LoyaltyPointPayloadDto, isArray: true })
  points!: LoyaltyPointPayloadDto[];

  @ApiProperty({ type: LoyaltyGiftPayloadDto, isArray: true })
  gifts!: LoyaltyGiftPayloadDto[];
}

export class LoyaltySchemeDeleteResultDto {
  @ApiProperty({ example: 1 })
  ls_id!: number;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class LoyaltyPointDeleteResultDto {
  @ApiProperty({ example: 1 })
  lspt_id!: number;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class LoyaltyGiftDeleteResultDto {
  @ApiProperty({ example: 1 })
  gift_ls_id!: number;

  @ApiProperty({ example: 1 })
  gift_slno!: number;

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
