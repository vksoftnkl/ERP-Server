import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';

/**
 * §3's paging. A group filter over a 40,000-row item master with four buckets
 * each is not a grid, it is a denial of service against the Qt table — which is
 * what F8's bulk-load filter dialog exists to prevent, by making the operator
 * narrow before loading.
 */
export const DEFAULT_PRICE_GRID_LIMIT = 200;
export const MAX_PRICE_GRID_LIMIT = 1000;

export class ListSellingPriceQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The branch whose effective prices are resolved. Required even at CHAIN scope: ' +
      'the price resolver answers "what does this branch see", and the Src chip is the answer.',
  })
  @RequiredUuid()
  branchId!: string;

  // The four F8 filters. Every one is a column on inventory.item_master.
  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_group_id' })
  @OptionalUuid()
  itemGroupId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_brand_id' })
  @OptionalUuid()
  itemBrandId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_section_id' })
  @OptionalUuid()
  itemSectionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_supplier_id' })
  @OptionalUuid()
  supplierId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "ONE item: every unit × live bucket of it, with stock — the screen's Add item (notes 74). " +
      'ANDed with the four filters above.',
  })
  @OptionalUuid()
  itemId?: string;

  // Notes 76 — the filter popup. All optional, ANDed with everything above.
  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Contains, case-insensitive, on item code, name, alias or default barcode. % and _ match ' +
      'themselves.',
  })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'item_master.item_category_id' })
  @OptionalUuid()
  itemCategoryId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The EFFECTIVE stock track preset: the item's own item_track_preset_id, else its group's " +
      '(the "Tracked as" the item entry shows).',
  })
  @OptionalUuid()
  trackPresetId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "item_master.item_default_tax_id — the item entry's tax (dropdown 36).",
  })
  @OptionalUuid()
  taxId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Only active items (default). false lists inactive ones too; deleted never.',
  })
  @OptionalQueryBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ default: DEFAULT_PRICE_GRID_LIMIT, maximum: MAX_PRICE_GRID_LIMIT })
  @OptionalQueryInt(1, MAX_PRICE_GRID_LIMIT)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}
