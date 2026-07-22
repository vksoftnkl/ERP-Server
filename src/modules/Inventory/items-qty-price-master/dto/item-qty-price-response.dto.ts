import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
  InventoryListMetaDto,
} from 'src/common/utils/module-response.dto';
export { InventoryErrorFieldDto as ItemQtyPriceErrorFieldDto };
export { InventoryErrorResponseDto as ItemQtyPriceErrorResponseDto };
export { InventoryListMetaDto as ItemQtyPriceListMetaDto };

export class ItemQtyPricePayloadDto {
  @ApiProperty({ format: 'uuid' })
  iqp_id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  iqp_company_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  iqp_branch_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  iqp_party_id!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 1 })
  iqp_price_level!: number | null;
  @ApiProperty({ format: 'uuid' })
  iqp_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  iqp_item_unit_id!: string;
  @ApiProperty({ example: 0, description: 'Slab lower bound (inclusive)' })
  iqp_from_qty!: number;
  @ApiPropertyOptional({
    example: 0,
    nullable: true,
    description: 'Slab upper bound (exclusive); null = "& above"',
  })
  iqp_to_qty!: number | null;
  @ApiProperty({
    maxLength: 1,
    example: 'P',
    description: 'P = by % | R = by qty (flat off) | F = fixed price',
  })
  iqp_price_mode!: string;
  @ApiPropertyOptional({ example: 0, nullable: true })
  iqp_disc_pct!: number | null;
  @ApiPropertyOptional({ example: 0, nullable: true })
  iqp_flat_off!: number | null;
  @ApiPropertyOptional({ example: 0, nullable: true })
  iqp_price!: number | null;
  @ApiProperty({ example: false })
  iqp_is_tax_incl!: boolean;
  @ApiProperty({ description: 'Slab effective-from date (inclusive)' })
  iqp_effective_from!: string;
  @ApiPropertyOptional({ nullable: true })
  iqp_effective_to!: string | null;
  @ApiProperty({ example: true })
  iqp_is_active!: boolean;
  @ApiProperty({ example: false })
  iqp_is_deleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  iqp_sync_date!: string | null;
  @ApiProperty()
  iqp_created_on!: string;
  @ApiPropertyOptional({ nullable: true })
  iqp_created_by!: string | null;
  @ApiProperty()
  iqp_modified_on!: string;
  @ApiPropertyOptional({ nullable: true })
  iqp_modified_by!: string | null;
}

export class ItemQtyPriceDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  iqp_id!: string;
  @ApiProperty({
    example: true,
    description: 'true when the item qty price was soft deleted, false when it was restored',
  })
  deleted!: boolean;
}

export class ItemQtyPriceSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item qty price fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemQtyPricePayloadDto })
  data!: ItemQtyPricePayloadDto;
}

@ApiExtraModels(ItemQtyPricePayloadDto)
export class ItemQtyPriceSuccessSaveDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item qty price created successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemQtyPricePayloadDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemQtyPricePayloadDto) },
      },
    ],
  })
  data!: ItemQtyPricePayloadDto | ItemQtyPricePayloadDto[];
}

export class ItemQtyPriceSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item qty prices fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemQtyPricePayloadDto, isArray: true })
  data!: ItemQtyPricePayloadDto[];
  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;
}

export class ItemQtyPriceSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item qty price deleted successfully' })
  message!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(ItemQtyPriceDeleteResultDto) },
      {
        type: 'array',
        items: { $ref: getSchemaPath(ItemQtyPriceDeleteResultDto) },
      },
    ],
  })
  data!: ItemQtyPriceDeleteResultDto | ItemQtyPriceDeleteResultDto[];
}
