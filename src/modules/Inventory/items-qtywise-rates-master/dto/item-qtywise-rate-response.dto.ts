import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from 'src/common/configured-grid-sql/dto/configured-grid-style.dto';
export class ItemQtywiseRateErrorFieldDto {
  @ApiProperty({ example: 'iqr_unit_rate_id' })
  field!: string;

  @ApiProperty({ example: 'iqr_unit_rate_id is required' })
  message!: string;
}

export class ItemQtywiseRateErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemQtywiseRateErrorFieldDto, isArray: true })
  errors!: ItemQtywiseRateErrorFieldDto[];
}

export class ItemQtywiseRatePayloadDto {
  @ApiProperty({ format: 'uuid' })
  iqr_id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  iqr_branch_id!: string | null;

  @ApiProperty({ format: 'uuid' })
  iqr_unit_rate_id!: string;

  @ApiProperty({ example: 1 })
  iqr_price_level!: number;

  @ApiProperty({ example: 1 })
  iqr_start_qty!: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  iqr_end_qty!: number | null;

  @ApiProperty({ example: 1 })
  iqr_each_qty!: number;

  @ApiProperty({ example: 0 })
  iqr_sales_price!: number;

  @ApiProperty({ example: 0 })
  iqr_price_wot!: number;

  @ApiProperty({ example: 0 })
  iqr_price_margin!: number;

  @ApiProperty({ example: 0 })
  iqr_disc_perc!: number;

  @ApiProperty({ example: 0 })
  iqr_disc_qty!: number;

  @ApiPropertyOptional({ nullable: true })
  iqr_valid_from!: string | null;

  @ApiPropertyOptional({ nullable: true })
  iqr_valid_to!: string | null;

  @ApiProperty({ example: 0 })
  iqr_priority!: number;

  @ApiProperty({ example: true })
  iqr_is_active!: boolean;

  @ApiProperty({ example: false })
  iqr_is_deleted!: boolean;

  @ApiProperty()
  iqr_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  iqr_created_by!: string | null;

  @ApiProperty()
  iqr_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  iqr_modified_by!: string | null;

  @ApiPropertyOptional({ nullable: true })
  iqr_remarks!: string | null;
}

export class ItemQtywiseRateListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemQtywiseRateDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  iqr_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemQtywiseRateSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item qty-wise rate fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemQtywiseRatePayloadDto })
  data!: ItemQtywiseRatePayloadDto;
}

export class ItemQtywiseRateSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item qty-wise rates fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemQtywiseRatePayloadDto, isArray: true })
  data!: ItemQtywiseRatePayloadDto[];

  @ApiProperty({ type: ItemQtywiseRateListMetaDto })
  meta!: ItemQtywiseRateListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class ItemQtywiseRateSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item qty-wise rate deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemQtywiseRateDeleteResultDto })
  data!: ItemQtywiseRateDeleteResultDto;
}
