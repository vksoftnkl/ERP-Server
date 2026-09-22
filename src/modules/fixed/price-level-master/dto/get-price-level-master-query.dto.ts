import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalInteger } from 'src/common/dto/dtoDecorators';
export class GetPriceLevelMasterQueryDto {
  @ApiPropertyOptional({
    description:
      'Fetch a specific price level id. If omitted, all matching price levels are returned.',
    minimum: 1,
    example: 1,
  })
  @OptionalInteger(1)
  priceLvlId?: number;
}
