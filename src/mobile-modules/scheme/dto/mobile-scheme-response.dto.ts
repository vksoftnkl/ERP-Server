import { ApiProperty } from '@nestjs/swagger';

/** An exact numeric as text at its column scale; `nullable` only where the column is. */
const num = (scale: number, example: string, nullable = false) =>
  ({
    type: String,
    nullable,
    example,
    description: `numeric(18,${scale}) as exact text${nullable ? '; null when NULL' : ''}`,
  }) as const;
const NULLABLE_UUID = { type: String, format: 'uuid', nullable: true } as const;
const NULLABLE_TEXT = { type: String, nullable: true } as const;

export class MobileSchemeBranchDto {
  @ApiProperty({ format: 'uuid' }) prb_id!: string;
  @ApiProperty({ format: 'uuid' }) prb_branch_id!: string;
  @ApiProperty({ ...NULLABLE_TEXT, description: 'br_name (display only)' })
  prb_branch_name!: string | null;
  @ApiProperty() prb_is_exclude!: boolean;
}

export class MobileSchemePartyDto {
  @ApiProperty({ format: 'uuid' }) prp_id!: string;
  @ApiProperty({ enum: ['CUSTOMER', 'CUSTOMER_GROUP', 'AREA', 'CITY'] }) prp_kind!: string;
  @ApiProperty({ format: 'uuid' }) prp_scope_id!: string;
  @ApiProperty({
    ...NULLABLE_TEXT,
    example: 'Retail',
    description: 'cus_name / cgr_name / arm_name / ctm_name by kind (display only)',
  })
  prp_scope_name!: string | null;
  @ApiProperty() prp_is_exclude!: boolean;
  @ApiProperty({ example: 1, description: 'CUSTOMER 4, AREA 3, CITY 2, CUSTOMER_GROUP 1 (seeded)' })
  prp_match_priority!: number;
}

export class MobileSchemeItemDto {
  @ApiProperty({ format: 'uuid' }) pri_id!: string;
  @ApiProperty({ enum: ['ITEM', 'ITEM_GROUP', 'ITEM_CATEGORY', 'ITEM_BRAND', 'ITEM_SECTION'] })
  pri_kind!: string;
  @ApiProperty({ format: 'uuid' }) pri_scope_id!: string;
  @ApiProperty({
    ...NULLABLE_TEXT,
    description: 'item_name_en / itg_name / category_name / brand_name / sec_name (display only)',
  })
  pri_scope_name!: string | null;
  @ApiProperty({
    ...NULLABLE_UUID,
    description: 'item_unit_conversion.iuc_id (soiItemUnitId); ITEM rows only',
  })
  pri_unit_id!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: 'PCS', description: 'unit_name (display only)' })
  pri_unit_name!: string | null;
  @ApiProperty() pri_is_exclude!: boolean;
  @ApiProperty(num(4, '0.0000')) pri_disc_perc!: string;
  @ApiProperty(num(4, '0.0000')) pri_disc_qty!: string;
  @ApiProperty(num(2, '0.00')) pri_disc_amt!: string;
  @ApiProperty(num(3, '0.000')) pri_min_qty!: string;
  @ApiProperty(num(4, '1.0000')) pri_factor!: string;
  @ApiProperty(num(2, '0.00')) pri_max_benefit!: string;
  @ApiProperty({ example: 4 }) pri_match_priority!: number;
}

export class MobileSchemeSlabDto {
  @ApiProperty({ format: 'uuid' }) prs_id!: string;
  @ApiProperty({ example: 1 }) prs_slno!: number;
  @ApiProperty({ example: 'FREE_ITEM' }) prs_benefit!: string;
  @ApiProperty(num(3, '5.000')) prs_exceeds!: string;
  @ApiProperty(num(3, '10.000', true)) prs_upto!: string | null;
  @ApiProperty(num(3, '1.000')) prs_each!: string;
  @ApiProperty() prs_is_repeat!: boolean;
  @ApiProperty({ example: 0, description: '0 = no limit' }) prs_max_repeats!: number;
  @ApiProperty(NULLABLE_UUID) prs_free_item_id!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, description: 'item_name_en (display only)' })
  prs_free_item_name!: string | null;
  @ApiProperty({ ...NULLABLE_UUID, description: 'item_unit_conversion.iuc_id of the free unit' })
  prs_free_unit_id!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, description: 'unit_name (display only)' })
  prs_free_unit_name!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '1.000000',
    description:
      'iuc_to_base_factor of the free unit, numeric(18,6) as text; null when no free unit',
  })
  prs_free_unit_factor!: string | null;
  @ApiProperty(num(3, '1.000')) prs_free_qty!: string;
  @ApiProperty() prs_free_stock_check!: boolean;
  @ApiProperty(num(4, '0.0000')) prs_disc_perc!: string;
  @ApiProperty(num(4, '0.0000')) prs_disc_qty!: string;
  @ApiProperty(num(2, '0.00')) prs_disc_amt!: string;
  @ApiProperty(num(4, '95.0000', true)) prs_fixed_price!: string | null;
  @ApiProperty(num(2, '0.00')) prs_max_benefit_amt!: string;
}

export class MobileSchemeDto {
  @ApiProperty({ format: 'uuid' }) prm_id!: string;
  @ApiProperty({ format: 'uuid' }) prm_comp_id!: string;
  @ApiProperty({ ...NULLABLE_UUID, description: 'null = every branch of the company' })
  prm_branch_id!: string | null;
  @ApiProperty({ example: 'FRRE' }) prm_code!: string;
  @ApiProperty() prm_name!: string;
  @ApiProperty({ example: 'APPROVED' }) prm_status!: string;
  @ApiProperty({ enum: ['BILL_AMOUNT', 'BILL_QTY', 'ITEM_AMOUNT', 'ITEM_QTY'] })
  prm_apply_on!: string;
  @ApiProperty({ enum: ['FREE_ITEM', 'DISC_PERC', 'DISC_AMT', 'FIXED_PRICE', 'DISC_PER_ITEM'] })
  prm_benefit!: string;
  @ApiProperty({ example: 2, description: '1 is applied first' }) prm_priority!: number;
  @ApiProperty({ enum: ['EXCLUSIVE', 'STACKABLE'] }) prm_stack_mode!: string;
  @ApiProperty({ example: true }) prm_auto_apply!: boolean;
  @ApiProperty() prm_allow_with_manual_disc!: boolean;
  @ApiProperty({ enum: ['GROSS_AMOUNT', 'NET_AMOUNT', 'TAXABLE_AMOUNT'] })
  prm_calc_on_amount_type!: string;
  @ApiProperty() prm_include_tax!: boolean;
  @ApiProperty({ enum: ['ALL', 'CASH', 'CREDIT'] }) prm_bill_type!: string;
  @ApiProperty(num(2, '0.00')) prm_min_bill_amount!: string;
  @ApiProperty(num(3, '0.000')) prm_min_qty!: string;
  @ApiProperty({ enum: ['ALL', 'LIST'] }) prm_branch_scope!: string;
  @ApiProperty({ enum: ['ALL', 'LIST'] }) prm_cust_scope!: string;
  @ApiProperty({ enum: ['ALL', 'LIST'] }) prm_item_scope!: string;
  @ApiProperty({ type: Number, nullable: true }) prm_price_level_id!: number | null;
  @ApiProperty(num(2, '0.00')) prm_max_benefit_per_bill!: string;
  @ApiProperty({ ...NULLABLE_UUID, description: 'Always null: coupon schemes are not sent' })
  prm_coupon_batch_id!: string | null;
  @ApiProperty({ format: 'date', example: '2026-08-24' }) prm_start_date!: string;
  @ApiProperty({ format: 'date', example: '2027-08-24' }) prm_end_date!: string;
  @ApiProperty({ ...NULLABLE_TEXT, example: '09:00:00' }) prm_valid_from_time!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: '18:00:00' }) prm_valid_to_time!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: 'MON,TUE,WED' }) prm_valid_weekdays!: string | null;
  @ApiProperty(NULLABLE_TEXT) prm_remarks!: string | null;
  @ApiProperty({ ...NULLABLE_TEXT, example: '2026-08-24T15:20:31.123+05:30' })
  prm_modified_on!: string | null;
  @ApiProperty({ type: [MobileSchemeBranchDto] }) branches!: MobileSchemeBranchDto[];
  @ApiProperty({ type: [MobileSchemePartyDto] }) parties!: MobileSchemePartyDto[];
  @ApiProperty({ type: [MobileSchemeItemDto] }) items!: MobileSchemeItemDto[];
  @ApiProperty({ type: [MobileSchemeSlabDto] }) slabs!: MobileSchemeSlabDto[];
}

export class MobileSchemesPayloadDto {
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({
    format: 'date',
    example: '2026-11-19',
    description: "The database's today (IST) that the end-date filter used",
  })
  asOf!: string;
  @ApiProperty({ type: [MobileSchemeDto] }) schemes!: MobileSchemeDto[];
}

export class MobileSchemesSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Active schemes fetched' }) message!: string;
  @ApiProperty({ type: MobileSchemesPayloadDto }) data!: MobileSchemesPayloadDto;
}
