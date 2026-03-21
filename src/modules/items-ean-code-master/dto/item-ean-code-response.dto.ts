import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class ItemEanCodeErrorFieldDto {
  @ApiProperty({ example: 'ean_code' })
  field!: string;

  @ApiProperty({ example: 'Duplicate ean_code is not allowed' })
  message!: string;
}

export class ItemEanCodeErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: ItemEanCodeErrorFieldDto, isArray: true })
  errors!: ItemEanCodeErrorFieldDto[];
}

export class ItemEanCodePayloadDto {
  @ApiProperty({ format: 'uuid' })
  ean_id!: string;

  @ApiProperty({ format: 'uuid' })
  ean_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  ean_unit_id!: string;

  @ApiProperty({ maxLength: 64 })
  ean_code!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ean_godown_id!: string | null;

  @ApiProperty({ example: false })
  ean_is_default!: boolean;

  @ApiProperty({ example: true })
  ean_is_active!: boolean;

  @ApiProperty({ example: false })
  ean_is_deleted!: boolean;

  @ApiProperty()
  ean_created_on!: string;

  @ApiPropertyOptional({ nullable: true })
  ean_created_by!: string | null;

  @ApiProperty()
  ean_modified_on!: string;

  @ApiPropertyOptional({ nullable: true })
  ean_modified_by!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ean_remarks!: string | null;
}

export class ItemEanCodeListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class ItemEanCodeDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ean_id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class ItemEanCodeSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item EAN code fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemEanCodePayloadDto })
  data!: ItemEanCodePayloadDto;
}

@ApiExtraModels(ItemEanCodePayloadDto)
export class ItemEanCodeSuccessSaveDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item EAN code created successfully' })
  message!: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemEanCodePayloadDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemEanCodePayloadDto) },
      },
    ],
  })
  data!: ItemEanCodePayloadDto | ItemEanCodePayloadDto[];
}

export class ItemEanCodeSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item EAN codes fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemEanCodePayloadDto, isArray: true })
  data!: ItemEanCodePayloadDto[];

  @ApiProperty({ type: ItemEanCodeListMetaDto })
  meta!: ItemEanCodeListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class ItemEanCodeSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item EAN code deleted successfully' })
  message!: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemEanCodeDeleteResultDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemEanCodeDeleteResultDto) },
      },
    ],
  })
  data!: ItemEanCodeDeleteResultDto | ItemEanCodeDeleteResultDto[];
}
