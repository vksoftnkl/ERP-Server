import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
  InventoryListMetaDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as ItemEanCodeErrorFieldDto };
export { InventoryErrorResponseDto as ItemEanCodeErrorResponseDto };
export { InventoryListMetaDto as ItemEanCodeListMetaDto };
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

  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;

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
