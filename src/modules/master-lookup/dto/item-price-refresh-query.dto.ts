import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/**
 * Query of the unit-cycling refresh: the item and the unit currently on screen,
 * and nothing else. The lookup's remaining scopes (company, branch, customer,
 * godown, accounting year, price level) are not accepted here — the refresh
 * runs the lookup at its defaults, so the caller only has to hand back what the
 * screen already holds.
 */
export class ItemPriceRefreshQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  item_id!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      "The unit currently selected on screen. The response returns the NEXT unit in the item's conversion list, wrapping around after the last one.",
  })
  @RequiredUuid()
  unit_id!: string;
}
