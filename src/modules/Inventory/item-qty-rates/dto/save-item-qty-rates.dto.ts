import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { OptionalBoolean, RequiredUuid } from 'src/common/dto/dtoDecorators';
import { SaveSellingPriceRowDto } from '../../../stocks/selling-price-bulk/dto/save-selling-price-bulk.dto';
import { SaveItemQtyPriceDto } from '../../items-qty-price-master/dto/save-item-qty-price.dto';
import { MAX_QTY_RATES_CARD_ROWS, MAX_QTY_RATES_SLABS } from '../types/item-qty-rates.types';

/**
 * One card row: a /stock/price-bulk save row WITHOUT itemId (the form is one
 * item — the server sets it). OmitType, not a `declare`d narrowing: every
 * inherited rule stays (house rule).
 */
export class SaveQtyRatesCardRowDto extends OmitType(SaveSellingPriceRowDto, ['itemId'] as const) {}

/** The card band's changed rows. */
export class SaveQtyRatesCardDto {
  @ApiProperty({
    type: SaveQtyRatesCardRowDto,
    isArray: true,
    description:
      'CHANGED rows only, each as get-with-rates loaded it (uomId, bucketId, priceScope, mrp and ' +
      'salePrice echoed) with what was typed. On a Plain-stock row send costPrice always (typed, ' +
      'or as loaded — C4). maxPrice (a typed MRP) and costPrice on a Plain-stock item only. Saved ' +
      'at THIS branch from today, as Quick Rate saves (D3).',
  })
  @IsArray()
  @ArrayMaxSize(MAX_QTY_RATES_CARD_ROWS)
  @ValidateNested({ each: true })
  @Type(() => SaveQtyRatesCardRowDto)
  rows!: SaveQtyRatesCardRowDto[];
}

/** §4.2 — POST /item-qty-prices/save-with-rates: card + slabs + slab deletes, one transaction. */
export class SaveItemQtyRatesDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The one item the form saves; every slab must be its.',
  })
  @RequiredUuid()
  itemId!: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'The popup\'s "Save anyway": answers every ASK problem (below cost under "warning", By User ' +
      'prices kept) at once (C8). Every check runs again; refusals are never confirmable.',
  })
  @OptionalBoolean()
  confirmed?: boolean;

  @ApiPropertyOptional({
    type: SaveQtyRatesCardDto,
    nullable: true,
    description:
      'Null / absent when no card cell changed. Needs menu 30 EDIT (STOCK_PRICE_RIGHT_EDIT).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveQtyRatesCardDto)
  rates?: SaveQtyRatesCardDto | null;

  @ApiPropertyOptional({
    type: SaveItemQtyPriceDto,
    isArray: true,
    description:
      "CHANGED or NEW slabs only, exactly /item-qty-prices/create's keys; iqp_item_id = itemId. A " +
      'row without iqp_id needs menu 244 CREATE, with one EDIT.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_QTY_RATES_SLABS)
  @ValidateNested({ each: true })
  @Type(() => SaveItemQtyPriceDto)
  slabs?: SaveItemQtyPriceDto[];

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    isArray: true,
    description: 'Slabs removed by this Save (C2), soft-deleted first. Needs menu 244 DELETE.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_QTY_RATES_SLABS)
  @IsUUID('all', { each: true })
  deleteSlabIds?: string[];
}
