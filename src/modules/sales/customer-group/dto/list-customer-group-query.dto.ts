import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { OptionalQueryBoolean } from '../../dto/dtoDecorators';
import { SalesListQueryBaseDto } from '../../utils/sales-list-query.base.dto';

export class ListCustomerGroupQueryDto extends SalesListQueryBaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  cgrCompanyId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  cgrIsActive?: boolean;
}
