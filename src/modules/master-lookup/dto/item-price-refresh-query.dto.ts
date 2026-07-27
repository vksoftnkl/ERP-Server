import { ApiProperty, OmitType } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';
import { ItemPriceLookupQueryDto } from './item-price-lookup-query.dto';

/**
 * Query of the unit-cycling refresh. It is the item-price lookup query with
 * `unit_id` made required: the refresh needs the unit currently on screen to
 * know which one comes next, and every other parameter is passed straight
 * through so the refreshed row carries the same company / branch / customer /
 * godown / price-level context the screen was already showing.
 */
export class ItemPriceRefreshQueryDto extends OmitType(ItemPriceLookupQueryDto, [
  'unit_id',
] as const) {
  @ApiProperty({
    format: 'uuid',
    description:
      "The unit currently selected on screen. The response returns the NEXT unit in the item's conversion list, wrapping around after the last one.",
  })
  @RequiredUuid()
  unit_id!: string;
}
