import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { SalesListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListStateQueryDto extends SalesListQueryBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  stmIsActive?: boolean;
}
