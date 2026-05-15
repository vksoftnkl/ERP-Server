import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalTrimmedString,
} from '../../../sales/dto/dtoDecorators';

export class GetHsnCodeMasterQueryDto {
  @ApiPropertyOptional({
    description: 'Fetch a specific HSN record by id.',
    minimum: 1,
    example: 1,
  })
  @OptionalInteger(1)
  hsnId?: number;

  @ApiPropertyOptional({
    description: 'Fetch HSN records by exact HSN code.',
    maxLength: 50,
    example: '3004',
  })
  @OptionalTrimmedString(50)
  hsnCode?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Return only active HSN records',
  })
  @OptionalQueryBoolean()
  activeOnly?: boolean;
}
