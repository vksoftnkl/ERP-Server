import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { ItemPayloadDto } from '../../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemTaxPayloadDto } from '../../items-tax-master/dto/item-tax-response.dto';

export class ItemPriceDetailErrorFieldDto {
  @ApiProperty({ example: 'item_id' })
  field!: string;

  @ApiProperty({ example: 'No active item found with id 019c6f6c-be87-7a11-8905-36092c46fd07' })
  message!: string;
}

export class ItemPriceDetailErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Item not found' })
  message!: string;

  @ApiProperty({ type: ItemPriceDetailErrorFieldDto, isArray: true })
  errors!: ItemPriceDetailErrorFieldDto[];
}

export class ItemPriceDetailPayloadDto {
  @ApiProperty({ type: ItemPayloadDto })
  item!: ItemPayloadDto;

  @ApiProperty({ type: ItemPricePayloadDto, isArray: true })
  item_prices!: ItemPricePayloadDto[];

  @ApiProperty({ type: ItemTaxPayloadDto, nullable: true })
  item_tax!: ItemTaxPayloadDto | null;
}

@ApiExtraModels(ItemPayloadDto, ItemPricePayloadDto, ItemTaxPayloadDto)
export class ItemPriceDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item price details fetched successfully' })
  message!: string;

  @ApiProperty({ type: ItemPriceDetailPayloadDto })
  data!: ItemPriceDetailPayloadDto;
}
