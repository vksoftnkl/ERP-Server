import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';

/**
 * Notes 140 B — the scheduled prices a branch can see: its own and the chain's,
 * every live row that starts after today. `itemId` narrows to one item.
 */
export class PriceScheduleQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  itemId?: string;
}
