import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested, IsBoolean } from 'class-validator';
import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { SaveItemDto } from './save-item.dto';
import { SaveItemUnitConversionDto } from '../../item-unit-conversion/dto/save-item-unit-conversion.dto';
import { SaveItemPriceDto } from '../../items-price-master/dto/save-item-price.dto';
import { SaveItemEanCodeDto } from '../../items-ean-code-master/dto/save-item-ean-code.dto';
import { SaveItemReorderDto } from '../../items-reorder-master/dto/save-item-reorder.dto';
import { OptionalUuid } from 'src/common/dto/dtoDecorators';

export class CompositeItemUnitConversionDto extends OmitType(SaveItemUnitConversionDto, [
  'iuc_item_id',
] as const) {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored when provided; server injects the parent item_id',
  })
  @OptionalUuid()
  iuc_item_id?: string;
}

export class CompositeItemPriceDto extends OmitType(SaveItemPriceDto, ['ipm_item_id'] as const) {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored when provided; server injects the parent item_id',
  })
  @OptionalUuid()
  ipm_item_id?: string;
}

export class CompositeItemEanCodeDto extends OmitType(SaveItemEanCodeDto, [
  'ean_item_id',
] as const) {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored when provided; server injects the parent item_id',
  })
  @OptionalUuid()
  ean_item_id?: string;
}

export class CompositeItemReorderDto extends OmitType(SaveItemReorderDto, ['ir_item_id'] as const) {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored when provided; server injects the parent item_id',
  })
  @OptionalUuid()
  ir_item_id?: string;
}

/**
 * Payload for POST /items/create. Extends the plain item payload with optional
 * child collections so a single call can save the item plus its unit
 * conversions, prices, EAN codes and reorders. Omitting the child arrays makes
 * the request behave exactly like a plain item create/update.
 */
export class SaveItemCompositeDto extends SaveItemDto {
  @ApiPropertyOptional({
    description:
      'The operator saw the HSN warning (ITEM_HSN_NOT_IN_LIST / ITEM_HSN_TOO_SHORT with confirmable: true, ' +
      'inventory.hsn_check = WARN) and chose to save anyway. Ignored under BLOCK. Never stored.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  item_hsn_confirmed?: boolean;

  @ApiPropertyOptional({ type: [CompositeItemUnitConversionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositeItemUnitConversionDto)
  unit_conversions?: CompositeItemUnitConversionDto[];

  @ApiPropertyOptional({ type: [CompositeItemPriceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositeItemPriceDto)
  prices?: CompositeItemPriceDto[];

  @ApiPropertyOptional({ type: [CompositeItemEanCodeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositeItemEanCodeDto)
  ean_codes?: CompositeItemEanCodeDto[];

  @ApiPropertyOptional({ type: [CompositeItemReorderDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositeItemReorderDto)
  reorders?: CompositeItemReorderDto[];
}
