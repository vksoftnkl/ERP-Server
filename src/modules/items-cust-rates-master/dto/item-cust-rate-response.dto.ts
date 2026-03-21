import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class ItemCustRateErrorFieldDto {
  @ApiProperty({ example: 'csr_customer_id' })
  field!: string;

  @ApiProperty({ example: 'csr_customer_id is required' })
  message!: string;
}

export class ItemCustRateErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemCustRateErrorFieldDto, isArray: true })
  errors!: ItemCustRateErrorFieldDto[];
}

export class ItemCustRatePayloadDto {
  @ApiProperty({ format: 'uuid' })
  csr_id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  csr_branch_id!: string | null;

  @ApiProperty({ format: 'uuid' })
  csr_customer_id!: string;

  @ApiProperty({ format: 'uuid' })
  csr_unit_rate_id!: string;

  @ApiProperty({ maxLength: 20, example: 'FIXED' })
  csr_rate_type!: string;

  @ApiProperty({ example: 0 })
  csr_item_rate!: number;

  @ApiProperty({ example: 0 })
  csr_disc_perc!: number;

  @ApiProperty({ example: 0 })
  csr_disc_qty!: number;

  @ApiPropertyOptional({ maxLength: 1, nullable: true, example: 'A' })
  csr_price_level!: string | null;

  @ApiPropertyOptional({ nullable: true })
  csr_valid_from!: string | null;

  @ApiPropertyOptional({ nullable: true })
  csr_valid_to!: string | null;

  @ApiProperty({ example: 0 })
  csr_priority!: number;

  @ApiProperty({ example: true })
  csr_is_active!: boolean;

  @ApiProperty({ example: false })
  csr_is_deleted!: boolean;

  @ApiProperty()
  csr_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  csr_created_by!: string | null;

  @ApiProperty()
  csr_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  csr_modified_by!: string | null;

  @ApiPropertyOptional({ nullable: true })
  csr_uploaded_at!: string | null;

  @ApiPropertyOptional({ nullable: true })
  csr_uploaded_by!: string | null;

  @ApiPropertyOptional({ nullable: true })
  csr_remarks!: string | null;
}

export class ItemCustRateListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemCustRateDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  csr_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemCustRateSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item customer rate fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemCustRatePayloadDto })
  data!: ItemCustRatePayloadDto;
}

export class ItemCustRateSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item customer rates fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemCustRatePayloadDto, isArray: true })
  data!: ItemCustRatePayloadDto[];

  @ApiProperty({ type: ItemCustRateListMetaDto })
  meta!: ItemCustRateListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class ItemCustRateSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item customer rate deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemCustRateDeleteResultDto })
  data!: ItemCustRateDeleteResultDto;
}
