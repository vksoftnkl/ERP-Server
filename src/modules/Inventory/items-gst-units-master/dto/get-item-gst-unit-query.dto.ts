import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalTrimmedString } from 'src/common/dto/dtoDecorators';

export class GetItemGstUnitQueryDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @OptionalTrimmedString(200)
  search?: string;
}
