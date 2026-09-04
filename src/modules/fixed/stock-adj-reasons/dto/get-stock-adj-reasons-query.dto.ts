import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalTrimmedString, OptionalUuid } from 'src/common/dto/dtoDecorators';

export class GetStockAdjReasonsQueryDto {
  @ApiPropertyOptional({
    description: 'Fetch a specific stock adjustment reason by ID.',
    example: '01930000-0000-7000-0000-000000000001',
  })
  @OptionalUuid()
  sarId?: string;

  @ApiPropertyOptional({
    description: 'Filter by reason code.',
    example: 'DAMAGE',
  })
  @OptionalTrimmedString(30)
  sarCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by reason kind.',
    example: 'LOSS',
  })
  @OptionalTrimmedString(30)
  sarReasonKind?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Return only active records.',
  })
  @OptionalQueryBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Include soft-deleted records.',
  })
  @OptionalQueryBoolean()
  includeDeleted?: boolean;
}
