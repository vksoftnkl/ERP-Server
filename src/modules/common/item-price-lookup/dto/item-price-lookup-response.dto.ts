import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { ItemPayloadDto } from '../../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';
export { InventoryErrorFieldDto as ItemPriceLookupErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceLookupErrorResponseDto };
export class ItemPriceLookupPayloadDto {
  @ApiProperty({ type: ItemPayloadDto })
  item!: ItemPayloadDto;
  @ApiProperty({ type: ItemPricePayloadDto, isArray: true })
  item_prices!: ItemPricePayloadDto[];
}
@ApiExtraModels(ItemPayloadDto, ItemPricePayloadDto)
export class ItemPriceLookupSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price lookup fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemPriceLookupPayloadDto })
  data!: ItemPriceLookupPayloadDto;
}
