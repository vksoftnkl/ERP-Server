import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { ItemPayloadDto } from '../../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemTaxPayloadDto } from '../../items-tax-master/dto/item-tax-response.dto';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';
export { InventoryErrorFieldDto as ItemPriceDetailErrorFieldDto };
export { InventoryErrorResponseDto as ItemPriceDetailErrorResponseDto };
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
