import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryInt, OptionalUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';

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
      'fn_smp_effective answers "what does this branch see", and the Src chip is the answer.',
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

  @ApiPropertyOptional({ default: DEFAULT_PRICE_GRID_LIMIT, maximum: MAX_PRICE_GRID_LIMIT })
  @OptionalQueryInt(1, MAX_PRICE_GRID_LIMIT)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}
