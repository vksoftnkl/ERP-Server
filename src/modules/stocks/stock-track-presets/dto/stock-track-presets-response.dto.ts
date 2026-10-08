import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class StockTrackPresetsErrorFieldDto {
  @ApiProperty()
  field!: string;
  @ApiProperty()
  message!: string;
}
export class StockTrackPresetsErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: StockTrackPresetsErrorFieldDto, isArray: true })
  errors!: StockTrackPresetsErrorFieldDto[];
}
export class StockTrackPresetsPayloadDto {
  @ApiProperty({ example: '01930000-0000-7000-0000-000000000001' })
  spt_id!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: null,
    description: 'null = shared with every company',
  })
  spt_company_id!: string | null;
  @ApiProperty({ example: 'PHARMA' })
  spt_code!: string;
  @ApiProperty({ example: 'Pharma (batch + expiry + MRP + supplier)' })
  spt_name!: string;
  @ApiPropertyOptional({ nullable: true })
  spt_description!: string | null;
  @ApiProperty({ example: true })
  spt_track_batch!: boolean;
  @ApiProperty({ example: true })
  spt_track_mrp!: boolean;
  @ApiProperty({ example: false })
  spt_track_sale_price!: boolean;
  @ApiProperty({ example: true })
  spt_track_expiry!: boolean;
  @ApiProperty({ example: false })
  spt_track_serial!: boolean;
  @ApiProperty({ example: true })
  spt_track_supplier!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    example: 'BMEP',
    description:
      "B/M/S/E/R/P in that order, 'N' when nothing is tracked. Compare with stp_track_signature to tell which preset a saved policy matches.",
  })
  spt_track_signature!: string | null;
  @ApiProperty({ example: 'WAVG' })
  spt_valuation_method!: string;
  @ApiProperty({ example: 'FEFO' })
  spt_issue_strategy!: string;
  @ApiProperty({ example: 'ALLOW' })
  spt_allow_negative!: string;
  @ApiPropertyOptional({ nullable: true, example: null })
  spt_shelf_life_days!: number | null;
  @ApiProperty({ example: 90 })
  spt_near_expiry_days!: number;
  @ApiProperty({ example: true })
  spt_block_expired_sale!: boolean;
  @ApiProperty({ example: 'INWARD_DATE' })
  spt_ageing_basis!: string;
  @ApiProperty({ example: 70 })
  spt_sort_order!: number;
  @ApiPropertyOptional({ nullable: true })
  spt_remarks!: string | null;
  @ApiProperty({
    example: false,
    description: 'true when this row overrides a shared preset of the same code',
  })
  spt_is_company_override!: boolean;
}
export class StockTrackPresetsGetMetaDto {
  @ApiPropertyOptional({ nullable: true })
  company_id!: string | null;
  @ApiPropertyOptional()
  spt_id?: string;
  @ApiPropertyOptional({ example: 'PHARMA' })
  spt_code?: string;
  @ApiProperty({ example: 8 })
  count!: number;
}
export class StockTrackPresetsSuccessGetDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Stock track presets fetched successfully' })
  message!: string;
  @ApiProperty({ type: StockTrackPresetsPayloadDto, isArray: true })
  data!: StockTrackPresetsPayloadDto[];
  @ApiProperty({ type: StockTrackPresetsGetMetaDto })
  meta!: StockTrackPresetsGetMetaDto;
}
