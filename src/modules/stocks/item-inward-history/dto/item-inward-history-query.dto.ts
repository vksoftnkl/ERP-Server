import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryInt, RequiredUuid } from 'src/common/dto/dtoDecorators';

export class ItemInwardHistoryQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'The branch whose inward is listed.' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @OptionalQueryInt(1, 50)
  limit?: number;
}
