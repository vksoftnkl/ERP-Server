import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemTaxHistoryErrorFieldDto {
  @ApiProperty({ example: 'ith_item_id' })
  field!: string;

  @ApiProperty({ example: 'ith_item_id is required' })
  message!: string;
}

export class ItemTaxHistoryErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemTaxHistoryErrorFieldDto, isArray: true })
  errors!: ItemTaxHistoryErrorFieldDto[];
}

export class ItemTaxHistoryPayloadDto {
  @ApiProperty({ format: 'uuid' })
  ith_id!: string;

  @ApiProperty({ format: 'uuid' })
  ith_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  ith_tax_id!: string;

  @ApiProperty()
  ith_effective_from!: string;

  @ApiPropertyOptional({ nullable: true })
  ith_effective_to!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ith_reason!: string | null;

  @ApiProperty()
  ith_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  ith_created_by!: string | null;
}

export class ItemTaxHistoryListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemTaxHistoryDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ith_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemTaxHistorySuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item tax history fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemTaxHistoryPayloadDto })
  data!: ItemTaxHistoryPayloadDto;
}

export class ItemTaxHistorySuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item tax histories fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemTaxHistoryPayloadDto, isArray: true })
  data!: ItemTaxHistoryPayloadDto[];

  @ApiProperty({ type: ItemTaxHistoryListMetaDto })
  meta!: ItemTaxHistoryListMetaDto;
}

export class ItemTaxHistorySuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item tax history deleted successfully' })
  message!: string;

  @ApiProperty({ type: ItemTaxHistoryDeleteResultDto })
  data!: ItemTaxHistoryDeleteResultDto;
}
