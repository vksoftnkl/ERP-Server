import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { ItemPayloadDto } from '../../items-master/dto/item-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemTaxPayloadDto } from '../../items-tax-master/dto/item-tax-response.dto';
import { ItemUnitConversionPayloadDto } from '../../item-unit-conversion/dto/item-unit-conversion-response.dto';
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
  @ApiProperty({
    type: ItemUnitConversionPayloadDto,
    isArray: true,
    description:
      "The item's live unit conversions; each price row points at one through ipm_uc_unit_id and carries none of its shape",
  })
  item_unit_conversions!: ItemUnitConversionPayloadDto[];
  @ApiProperty({ type: ItemTaxPayloadDto, nullable: true })
  item_tax!: ItemTaxPayloadDto | null;
}
@ApiExtraModels(
  ItemPayloadDto,
  ItemPricePayloadDto,
  ItemUnitConversionPayloadDto,
  ItemTaxPayloadDto,
)
export class ItemPriceDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price details fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemPriceDetailPayloadDto })
  data!: ItemPriceDetailPayloadDto;
}
