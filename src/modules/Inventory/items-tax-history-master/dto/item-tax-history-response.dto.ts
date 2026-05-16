import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from 'src/common/configured-grid-sql/dto/configured-grid-style.dto';
import { InventoryErrorFieldDto, InventoryErrorResponseDto, InventoryListMetaDto } from '../../utils/inventory-response.dto';

export { InventoryErrorFieldDto as ItemTaxHistoryErrorFieldDto };
export { InventoryErrorResponseDto as ItemTaxHistoryErrorResponseDto };
export { InventoryListMetaDto as ItemTaxHistoryListMetaDto };

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
  @ApiProperty({ type: InventoryListMetaDto })
  meta!: InventoryListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class ItemTaxHistorySuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item tax history deleted successfully' })
  message!: string;
  @ApiProperty({ type: ItemTaxHistoryDeleteResultDto })
  data!: ItemTaxHistoryDeleteResultDto;
}
