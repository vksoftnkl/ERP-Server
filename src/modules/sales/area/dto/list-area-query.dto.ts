import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { SalesListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListAreaQueryDto extends SalesListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  armCityId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  armIsActive?: boolean;
}
