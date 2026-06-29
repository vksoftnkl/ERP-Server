import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalInteger, OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
export class GetPriceLevelMasterQueryDto {
  @ApiPropertyOptional({
    description:
      'Fetch a specific price level id. If omitted, all matching price levels are returned.',
    minimum: 1,
    example: 1,
  })
  @OptionalInteger(1)
  priceLvlId?: number;
  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Return only active price levels',
  })
  @OptionalQueryBoolean()
  activeOnly?: boolean;
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Include soft-deleted price levels',
  })
  @OptionalQueryBoolean()
  includeDeleted?: boolean;
}