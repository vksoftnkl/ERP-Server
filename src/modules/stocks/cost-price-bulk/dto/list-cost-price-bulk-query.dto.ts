import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import {
  DEFAULT_COST_BULK_PAGE,
  MAX_COST_BULK_PAGE,
  PROFIT_TYPES,
} from '../types/cost-price-bulk.types';

/**
 * GET /stock/cost-bulk — plan §3's query. Always active Plain stock items
 * (fixed, not a filter); every other key is optional and ANDed.
 */
export class ListCostPriceBulkQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The branch whose price in force today is loaded: its own row, else the all-branches row.',
  })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_group_id (dropdown 17)' })
  @OptionalUuid()
  groupId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'item_master.item_category_id (dropdown 20)',
  })
  @OptionalUuid()
  itemCategoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_brand_id (dropdown 18)' })
  @OptionalUuid()
  brandId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_section_id (dropdown 19)' })
  @OptionalUuid()
  sectionId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "item_master.item_supplier_id — the same meaning as Change Selling Price's supplierId (dropdown 35).",
  })
  @OptionalUuid()
  supplierId?: string;

  @ApiPropertyOptional({
    enum: PROFIT_TYPES,
    description: "The unit's rule (ipm_profit_type of the row in force). Not applied to leftOut.",
  })
  @IsOptional()
  @IsIn(PROFIT_TYPES)
  profitType?: (typeof PROFIT_TYPES)[number];

  @ApiPropertyOptional({
    default: false,
    description: 'Only items with item_master.item_price_list on.',
  })
  @OptionalQueryBoolean()
  priceListOnly?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'ONE item — the blank-row add. Every priced unit of it, ANDed with the filters above. An item ' +
      'that may not be on the grid answers 422 with its reason: COST_BULK_INACTIVE, ' +
      'COST_BULK_NOT_PLAIN_STOCK (preset or old batch tick) or COST_BULK_NO_PRICE_ROW (no unit ' +
      'priced); not there at all, 404 LOOKUP_ITEM_NOT_FOUND.',
  })
  @OptionalUuid()
  itemId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, description: '1-based.' })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ default: DEFAULT_COST_BULK_PAGE, minimum: 1, maximum: MAX_COST_BULK_PAGE })
  @OptionalQueryInt(1, MAX_COST_BULK_PAGE)
  limit?: number;
}
