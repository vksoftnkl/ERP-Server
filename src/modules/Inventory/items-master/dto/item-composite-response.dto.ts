import { ApiProperty } from '@nestjs/swagger';
import { ItemDeleteResultDto, ItemPayloadDto } from './item-response.dto';
import {
  ItemUnitConversionDeleteResultDto,
  ItemUnitConversionPayloadDto,
} from '../../item-unit-conversion/dto/item-unit-conversion-response.dto';
import {
  ItemPriceDeleteResultDto,
  ItemPricePayloadDto,
} from '../../items-price-master/dto/item-price-response.dto';
import {
  ItemEanCodeDeleteResultDto,
  ItemEanCodePayloadDto,
} from '../../items-ean-code-master/dto/item-ean-code-response.dto';
import {
  ItemReorderDeleteResultDto,
  ItemReorderPayloadDto,
} from '../../items-reorder-master/dto/item-reorder-response.dto';
import {
  ItemCompositeDeleteResult,
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
  @ApiProperty({ example: 'Item created successfully' })
  message!: string;
  @ApiProperty({ type: ItemCompositePayloadDto })
  data!: ItemCompositePayloadDto;
}

export type ItemCompositeResponse = ItemCompositeSuccessResponse<ItemCompositePayload>;

export class ItemCompositeDeleteResultDto {
  @ApiProperty({ type: ItemDeleteResultDto })
  item!: ItemDeleteResultDto;
  @ApiProperty({ type: [ItemUnitConversionDeleteResultDto] })
  unit_conversions!: ItemUnitConversionDeleteResultDto[];
  @ApiProperty({ type: [ItemPriceDeleteResultDto] })
  prices!: ItemPriceDeleteResultDto[];
  @ApiProperty({ type: [ItemEanCodeDeleteResultDto] })
  ean_codes!: ItemEanCodeDeleteResultDto[];
  @ApiProperty({ type: [ItemReorderDeleteResultDto] })
  reorders!: ItemReorderDeleteResultDto[];
}

export class ItemCompositeSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item deleted successfully' })
  message!: string;
  @ApiProperty({ type: ItemCompositeDeleteResultDto })
  data!: ItemCompositeDeleteResultDto;
}

export type ItemCompositeDeleteResponse = ItemCompositeSuccessResponse<ItemCompositeDeleteResult>;
