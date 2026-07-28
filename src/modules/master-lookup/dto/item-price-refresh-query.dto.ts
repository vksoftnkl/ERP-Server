import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';
/**
 * Query of the unit-cycling refresh: the item and the unit conversion currently
 * on screen, and nothing else. No lookup scope (company, branch, customer,
 * godown, accounting year, price level) is accepted — the refresh only steps
 * along the item's unit list and hands back the conversion it lands on.
 */
export class ItemPriceRefreshQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  item_id!: string;
  @ApiProperty({
    format: 'uuid',
    description:
      "item_unit_conversion PK (iuc_id) of the unit currently selected on screen. The response returns the NEXT iuc_id in the item's conversion list, wrapping around after the last one.",
  })
  @RequiredUuid()
  iuc_id!: string;
}
