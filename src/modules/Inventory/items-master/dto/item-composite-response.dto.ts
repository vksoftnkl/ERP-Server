import { ApiProperty } from '@nestjs/swagger';
import { ItemPayloadDto } from './item-response.dto';
import { ItemUnitConversionPayloadDto } from '../../item-unit-conversion/dto/item-unit-conversion-response.dto';
import { ItemPricePayloadDto } from '../../items-price-master/dto/item-price-response.dto';
import { ItemEanCodePayloadDto } from '../../items-ean-code-master/dto/item-ean-code-response.dto';
import { ItemReorderPayloadDto } from '../../items-reorder-master/dto/item-reorder-response.dto';
import {
  ItemCompositePayload,
  ItemCompositeSuccessResponse,
} from '../types/item-composite-api.types';

export class ItemCompositePayloadDto {
  @ApiProperty({ type: ItemPayloadDto })
  item!: ItemPayloadDto;
  @ApiProperty({ type: [ItemUnitConversionPayloadDto] })
  unit_conversions!: ItemUnitConversionPayloadDto[];
  @ApiProperty({ type: [ItemPricePayloadDto] })
  prices!: ItemPricePayloadDto[];
  @ApiProperty({ type: [ItemEanCodePayloadDto] })
  ean_codes!: ItemEanCodePayloadDto[];
  @ApiProperty({ type: [ItemReorderPayloadDto] })
  reorders!: ItemReorderPayloadDto[];
}

export class ItemCompositeSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item composite saved successfully' })
  message!: string;
  @ApiProperty({ type: ItemCompositePayloadDto })
  data!: ItemCompositePayloadDto;
}

export type ItemCompositeResponse = ItemCompositeSuccessResponse<ItemCompositePayload>;
